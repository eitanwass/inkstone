import { describe, expect, it } from 'vitest';
import { LOCAL_RELAY_HOST, resolveRelayHost } from '../../src/relay-host';

describe('resolveRelayHost', () => {
  it('uses the configured relay, in dev and in production', () => {
    expect(resolveRelayHost({ VITE_RELAY_HOST: 'relay.example.workers.dev', DEV: false })).toBe(
      'relay.example.workers.dev',
    );
    expect(resolveRelayHost({ VITE_RELAY_HOST: 'relay.example.workers.dev', DEV: true })).toBe(
      'relay.example.workers.dev',
    );
  });

  it('falls back to the local relay on the dev server', () => {
    expect(resolveRelayHost({ DEV: true })).toBe(LOCAL_RELAY_HOST);
    expect(resolveRelayHost({ VITE_RELAY_HOST: '', DEV: true })).toBe(LOCAL_RELAY_HOST);
  });

  it('never falls back to localhost in a production build', () => {
    expect(resolveRelayHost({ DEV: false })).toBeNull();
    expect(resolveRelayHost({ VITE_RELAY_HOST: undefined, DEV: false })).toBeNull();
    expect(resolveRelayHost({ VITE_RELAY_HOST: '', DEV: false })).toBeNull();
  });

  it('treats a blank value as not configured', () => {
    expect(resolveRelayHost({ VITE_RELAY_HOST: '   ', DEV: false })).toBeNull();
    expect(resolveRelayHost({ VITE_RELAY_HOST: '   ', DEV: true })).toBe(LOCAL_RELAY_HOST);
  });

  it('trims surrounding whitespace from a configured host', () => {
    expect(resolveRelayHost({ VITE_RELAY_HOST: '  relay.example.dev \n', DEV: false })).toBe(
      'relay.example.dev',
    );
  });
});
