import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
const localStorageStub = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', localStorageStub);
  vi.stubGlobal('window', { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {}, location: { origin: 'https://x.test', pathname: '/SongState/' } });
  vi.stubGlobal('navigator', { userAgent: 'Mozilla Chrome', onLine: true, requestMediaKeySystemAccess: () => {} });
});
afterEach(() => vi.unstubAllGlobals());

const expired = () => store.set('ss.spotify.tokens', JSON.stringify({ access: 'a', refresh: 'r', expires: Date.now() - 1000 }));
const res = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('Spotify: renovação do login', () => {
  it('sem internet na renovação, mantém o login salvo', async () => {
    const { getToken } = await import('../src/lib/spotify');
    expired();
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await getToken()).toBeNull();
    expect(store.has('ss.spotify.tokens')).toBe(true);
  });

  it('se o Spotify recusa a renovação, desconecta', async () => {
    const { getToken } = await import('../src/lib/spotify');
    expired();
    vi.stubGlobal('fetch', async () => res({ error: 'invalid_grant' }, 400));
    expect(await getToken()).toBeNull();
    expect(store.has('ss.spotify.tokens')).toBe(false);
  });

  it('renovação bem-sucedida guarda o novo token', async () => {
    const { getToken } = await import('../src/lib/spotify');
    expired();
    vi.stubGlobal('fetch', async () => res({ access_token: 'novo', expires_in: 3600 }));
    expect(await getToken()).toBe('novo');
    expect(JSON.parse(store.get('ss.spotify.tokens')!).refresh).toBe('r');
  });
});

describe('Spotify: autoteste', () => {
  const valid = () => store.set('ss.spotify.tokens', JSON.stringify({ access: 'a', refresh: 'r', expires: Date.now() + 3600_000 }));

  it('sem login, orienta a conectar', async () => {
    const { spotifyCheck } = await import('../src/lib/spotify');
    const r = await spotifyCheck();
    expect(r.ok).toBe(false);
    expect(r.steps[0]).toMatchObject({ label: 'Login', ok: false });
  });

  it('conta Premium em navegador de computador passa em tudo', async () => {
    const { spotifyCheck } = await import('../src/lib/spotify');
    valid();
    vi.stubGlobal('fetch', async () => res({ display_name: 'Lucas', product: 'premium' }));
    const r = await spotifyCheck();
    expect(r.ok).toBe(true);
    expect(r.steps.map((s) => s.label)).toEqual(['Login', 'Conta', 'Premium', 'Navegador', 'Áudio protegido (DRM)']);
  });

  it('conta gratuita aponta o Premium; e-mail fora do painel aponta o User Management', async () => {
    const { spotifyCheck } = await import('../src/lib/spotify');
    valid();
    vi.stubGlobal('fetch', async () => res({ display_name: 'L', product: 'free' }));
    const free = await spotifyCheck();
    expect(free.steps.find((s) => s.label === 'Premium')).toMatchObject({ ok: false });

    vi.stubGlobal('fetch', async () => res({ error: { message: 'User not registered in the Developer Dashboard' } }, 403));
    const blocked = await spotifyCheck();
    expect(blocked.ok).toBe(false);
    expect(blocked.steps.find((s) => s.label === 'Conta')?.detail).toMatch(/User Management/);
  });
});
