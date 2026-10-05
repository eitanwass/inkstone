// ── Which relay live sharing talks to ──────────────────────────
// VITE_RELAY_HOST is baked in at build time. Only the dev server may fall back
// to the local relay (`npm run party:dev`): a deployed site that did the same
// would point every visitor's browser at *their own* machine, which looks
// alarming (Chrome asks to allow access to "apps and services on this
// device") and can never work, since nobody else can reach their localhost.

export const LOCAL_RELAY_HOST = 'localhost:8787';

// The relay's host, or null when this build has none (sharing is then off).
export function resolveRelayHost(env: { VITE_RELAY_HOST?: string; DEV: boolean }): string | null {
  const configured = env.VITE_RELAY_HOST?.trim();
  if (configured) return configured;
  return env.DEV ? LOCAL_RELAY_HOST : null;
}
