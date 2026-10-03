import { afterEach, describe, expect, it, vi } from 'vitest';

// The image function must never answer with a server error: when the card can't be
// drawn (the renderer won't load, rendering throws, the name is unusable) it sends
// people to the plain site card, and says why in a header so a problem on the server
// can be read with `curl -i`.

const ORIGIN = 'https://inkstone.example';
const request = (query: string) => new Request(`${ORIGIN}/api/og${query}`);

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('../../api/_card');
});

async function loadOg() {
  return (await import('../../api/og')).GET;
}

describe('GET /api/og when something goes wrong', () => {
  it('redirects to the site card, with the reason, if the renderer cannot be loaded at all', async () => {
    vi.resetModules();
    vi.doMock('../../api/_card', () => {
      throw new Error('Cannot find module satori');
    });
    const GET = await loadOg();

    const response = await GET(request('?name=The%20Sunken%20Crypt'));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/og-image.png`);
    expect(response.headers.get('x-og-fallback')).toMatch(/^error: /); // (vitest wraps the factory's own message)
    expect(response.headers.get('cache-control')).toBe('no-store'); // a failure isn't remembered
  });

  it('redirects to the site card, with the reason, if drawing throws', async () => {
    vi.resetModules();
    vi.doMock('../../api/_card', () => ({
      isDrawable: () => true,
      renderCard: async () => {
        throw new Error('render exploded');
      },
    }));
    const GET = await loadOg();

    const response = await GET(request('?name=Anything'));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/og-image.png`);
    expect(response.headers.get('x-og-fallback')).toContain('render exploded');
  });

  it('keeps the reason to one short line of plain ASCII, whatever the error says', async () => {
    vi.resetModules();
    vi.doMock('../../api/_card', () => {
      throw new Error(`line one\nline two ${'x'.repeat(1000)} ünïcödé 🏰`);
    });
    const GET = await loadOg();

    const reason = (await GET(request('?name=Anything'))).headers.get('x-og-fallback') ?? '';
    expect(reason).not.toMatch(/[^\x20-\x7e]/);
    expect(reason.length).toBeLessThanOrEqual(300);
  });

  it('says why it used the site card when the name is missing or cannot be drawn', async () => {
    const GET = await loadOg();
    expect((await GET(request(''))).headers.get('x-og-fallback')).toBe('no-name');
    expect((await GET(request('?name=%20%20'))).headers.get('x-og-fallback')).toBe('no-name');
    expect((await GET(request(`?name=${encodeURIComponent('洞窟')}`))).headers.get('x-og-fallback')).toBe(
      'not-drawable',
    );
  });

  it('draws normally, with no fallback header, when all is well', async () => {
    const GET = await loadOg();
    const response = await GET(request('?name=The%20Sunken%20Crypt'));
    expect(response.status).toBe(200);
    expect(response.headers.get('x-og-fallback')).toBeNull();
  });
});
