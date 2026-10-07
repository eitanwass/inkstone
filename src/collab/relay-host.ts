// ── Which relay live sharing talks to ──────────────────────────
// VITE_RELAY_HOST is baked in at build time. Only the dev server may fall back
// to the local relay (`npm run party:dev`): a deployed site that did the same
// would point every visitor's browser at *their own* machine, which looks
// alarming (Chrome asks to allow access to "apps and services on this
// device") and can never work, since nobody else can reach their localhost.

export const LOCAL_RELAY_HOST = 'localhost:8787';

// An address on the relay for an ordinary request (the feedback form's): http for a relay on this machine, which has
// no certificate, https for any other.
export function relayHttpUrl(host: string, path: string): string {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  return `${local ? 'http' : 'https'}://${host}${path}`;
}

// Just the host, however it was typed: a scheme in front ("https://", "wss://", even a mistyped "https//") or a
// slash or path after it is dropped, since the sockets and the feedback form add their own.
export function cleanRelayHost(value: string): string {
  return value
    .trim()
    .replace(/^(?:https?|wss?):?\/\//i, '')
    .replace(/\/.*$/, '');
}

// The relay's host, or null when this build has none (sharing is then off).
export function resolveRelayHost(env: { VITE_RELAY_HOST?: string; DEV: boolean }): string | null {
  const configured = cleanRelayHost(env.VITE_RELAY_HOST ?? '');
  if (configured) return configured;
  return env.DEV ? LOCAL_RELAY_HOST : null;
}
