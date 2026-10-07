// ── Feedback: from the site and the editor to a Discord channel ──
// `POST /feedback` takes what a player typed in the feedback form (see src/core/feedback.ts, which keeps the same
// limits: this file can't import it) and posts it to a Discord channel only the site's owner can see, through a
// webhook. The webhook address is a secret of the Worker (`FEEDBACK_WEBHOOK`, set with `wrangler secret put`), never
// in the site: anyone who had it could post to the channel. Nothing is stored here but how often each visitor has
// sent something, so a bored visitor (or a script) can't flood the channel (`FeedbackGate`).
//
// What is sent to Discord: the message, the email if they gave one (so it can be answered), the app version, the
// screen size and which page it came from; and the player's map as a file if they chose to attach it.

const MAX_MESSAGE = 2000;
const MAX_EMAIL = 200;
const MAX_MAP = 2_000_000; // characters of the attached map file
const MAX_BODY = 2_300_000;
const PER_VISITOR_PER_HOUR = 5;
const PER_DAY = 300; // everyone together: the channel never gets more than this a day
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// What a request says, checked: { feedback } if it can be sent, { error } if not, or { spam: true } for a form a
// script filled in (the `website` field is hidden from people, so only a script writes in it).
export function parseFeedback(data) {
  if (typeof data !== 'object' || data === null) return { error: 'bad' };
  if (typeof data.website === 'string' && data.website !== '') return { spam: true };
  const message = text(data.message, MAX_MESSAGE);
  if (!message) return { error: 'empty' };
  const email = text(data.email, MAX_EMAIL);
  if (email && !EMAIL_RE.test(email)) return { error: 'email' };
  let map = null;
  if (data.map !== undefined && data.map !== null) {
    if (typeof data.map !== 'string' || data.map.length > MAX_MAP) return { error: 'map' };
    map = data.map;
  }
  return {
    feedback: {
      message,
      email,
      map,
      version: text(data.version, 20),
      screen: text(data.screen, 20),
      page: data.page === 'contact' ? 'contact' : 'editor',
    },
  };
}

// The request Discord's webhook takes: an embed, and the map as a file. Mentions are switched off, so nothing a
// visitor writes can ping anyone.
export function discordRequest(feedback, webhook, now = new Date()) {
  const embed = {
    title: feedback.page === 'contact' ? 'Feedback from the site' : 'Feedback from the editor',
    description: feedback.message,
    color: 0xc9a84c,
    fields: [
      { name: 'Email', value: feedback.email || 'not given', inline: true },
      { name: 'Version', value: feedback.version || 'unknown', inline: true },
      { name: 'Screen', value: feedback.screen || 'unknown', inline: true },
    ],
    timestamp: now.toISOString(),
  };
  const form = new FormData();
  form.append('payload_json', JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }));
  if (feedback.map) {
    form.append('files[0]', new Blob([feedback.map], { type: 'application/json' }), 'map.inkstone.json');
  }
  return { url: webhook, init: { method: 'POST', body: form } };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const reply = (status, body) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// A short fingerprint of a visitor (their address, hashed), so the gate never holds an address.
async function visitorKey(request) {
  const address = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address));
  return [...new Uint8Array(hash).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The whole request: `env.FEEDBACK_WEBHOOK` is where it goes, `env.FEEDBACK_GATE` the limiter.
export async function handleFeedback(request, env, send = fetch) {
  if (request.method === 'OPTIONS') return reply(204);
  if (request.method !== 'POST') return reply(405, { error: 'method' });
  if (!env.FEEDBACK_WEBHOOK) return reply(501, { error: 'not-set-up' });
  const length = Number(request.headers.get('Content-Length') ?? 0);
  if (length > MAX_BODY) return reply(413, { error: 'big' });
  const body = await request.text();
  if (body.length > MAX_BODY) return reply(413, { error: 'big' });
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return reply(400, { error: 'bad' });
  }
  const checked = parseFeedback(data);
  if (checked.spam) return reply(200, { ok: true }); // looks sent, goes nowhere
  if (checked.error) return reply(400, { error: checked.error });

  const gate = env.FEEDBACK_GATE.get(env.FEEDBACK_GATE.idFromName('gate'));
  const allowed = await gate.fetch(`https://gate/?key=${await visitorKey(request)}`);
  if (allowed.status === 429) return reply(429, { error: 'busy' });

  const { url, init } = discordRequest(checked.feedback, env.FEEDBACK_WEBHOOK);
  try {
    const posted = await send(url, init);
    return posted.ok ? reply(200, { ok: true }) : reply(502, { error: 'failed' });
  } catch {
    return reply(502, { error: 'failed' });
  }
}

// Counts what each visitor and everyone together have sent lately. One instance holds it all (the volume is small).
export class FeedbackGate {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const key = new URL(request.url).searchParams.get('key') ?? '';
    const now = Date.now();
    const mine = ((await this.state.storage.get(`k:${key}`)) ?? []).filter((t) => now - t < HOUR);
    const everyone = ((await this.state.storage.get('all')) ?? []).filter((t) => now - t < DAY);
    if (mine.length >= PER_VISITOR_PER_HOUR || everyone.length >= PER_DAY) {
      return new Response('busy', { status: 429 });
    }
    await this.state.storage.put({ [`k:${key}`]: [...mine, now], all: [...everyone, now] });
    await this.state.storage.setAlarm(now + DAY); // a day of quiet, and every count is stale: forgotten
    return new Response('ok');
  }

  async alarm() {
    await this.state.storage.deleteAll();
  }
}
