// ── Sending feedback ───────────────────────────────────────────
// Posts the form's body to the relay's /feedback (party/feedback.js), which puts it in the owner's private channel.
// Shared by the editor's dialog and the Contact page. With no relay in this build (see collab/relay-host.ts) there is
// nowhere to send it, and the player is told so.

import { relayHttpUrl, resolveRelayHost } from './collab/relay-host';
import type { SendResult } from './core/feedback';

export async function sendFeedback(body: string): Promise<SendResult> {
  const host = resolveRelayHost({
    VITE_RELAY_HOST: import.meta.env.VITE_RELAY_HOST,
    DEV: import.meta.env.DEV,
  });
  if (!host) return 'not-set-up';
  try {
    const response = await fetch(relayHttpUrl(host, '/feedback'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (response.ok) return 'sent';
    if (response.status === 501) return 'not-set-up';
    if (response.status === 429) return 'busy';
    return 'failed';
  } catch {
    return 'failed';
  }
}
