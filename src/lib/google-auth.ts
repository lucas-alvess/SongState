/**
 * Login com o Google (Google Identity Services, fluxo de token no navegador — sem servidor).
 *
 * - Pede só `drive.appdata` (pasta oculta do app no Drive) e o e-mail da conta.
 * - O token de acesso dura cerca de 1 hora e fica SÓ na memória (nunca em localStorage).
 * - Não existe "refresh token" sem servidor: quando o token vence, é preciso um toque em "Reconectar".
 */

export const SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid email';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken(o?: { prompt?: string; hint?: string }): void;
}
interface Gis {
  accounts: {
    oauth2: {
      initTokenClient(c: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type?: string }) => void; prompt?: string }): TokenClient;
      revoke(token: string, done?: () => void): void;
    };
  };
}

declare global {
  interface Window {
    google?: Gis;
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: 'cancelled' | 'blocked' | 'denied' | 'offline' | 'failed',
  ) {
    super(message);
  }
}

let loading: Promise<Gis> | null = null;

export function loadGis(): Promise<Gis> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (loading) return loading;
  loading = new Promise<Gis>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => (window.google?.accounts?.oauth2 ? resolve(window.google) : reject(new AuthError('O login do Google não carregou.', 'failed')));
    s.onerror = () => reject(new AuthError('Não foi possível carregar o login do Google (sem internet?).', 'offline'));
    document.head.appendChild(s);
  }).catch((e) => {
    loading = null; // permite tentar de novo
    throw e;
  });
  return loading;
}

let token: { value: string; expiresAt: number } | null = null;

/** Token válido por pelo menos mais 1 minuto, ou null. */
export function getToken(now = Date.now()): string | null {
  return token && token.expiresAt - now > 60_000 ? token.value : null;
}
export const tokenExpiresAt = () => token?.expiresAt ?? 0;

/**
 * Abre o login do Google. `prompt: ''` tenta entrar sem perguntar (se já houve consentimento);
 * isso pode ser bloqueado pelo navegador quando não vem de um toque do usuário.
 */
export async function requestToken(clientId: string, opts: { prompt?: '' | 'consent' | 'select_account'; hint?: string } = {}): Promise<string> {
  const gis = await loadGis();
  return new Promise<string>((resolve, reject) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (r) => {
        if (r.error || !r.access_token) {
          reject(new AuthError(r.error === 'access_denied' ? 'O acesso foi negado.' : r.error_description || 'Não foi possível entrar com o Google.', r.error === 'access_denied' ? 'denied' : 'failed'));
          return;
        }
        // o usuário pode desmarcar a permissão do Drive na tela de consentimento
        if (r.scope && !r.scope.includes('drive.appdata')) {
          reject(new AuthError('É preciso permitir o acesso aos dados do aplicativo no Drive para sincronizar.', 'denied'));
          return;
        }
        token = { value: r.access_token, expiresAt: Date.now() + (Number(r.expires_in) || 3600) * 1000 };
        resolve(r.access_token);
      },
      error_callback: (e) => {
        if (e.type === 'popup_closed') reject(new AuthError('A janela de login foi fechada.', 'cancelled'));
        else if (e.type === 'popup_failed_to_open') reject(new AuthError('O navegador bloqueou a janela de login. Toque em "Reconectar".', 'blocked'));
        else reject(new AuthError('Não foi possível entrar com o Google.', 'failed'));
      },
    });
    client.requestAccessToken({ prompt: opts.prompt ?? '', hint: opts.hint });
  });
}

export interface Profile {
  email: string;
  name: string;
}

export async function fetchProfile(accessToken: string): Promise<Profile> {
  let res: Response;
  try {
    res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch {
    throw new AuthError('Sem conexão com o Google.', 'offline');
  }
  if (!res.ok) throw new AuthError('Não foi possível ler a conta do Google.', 'failed');
  const body = (await res.json()) as { email?: string; name?: string };
  if (!body.email) throw new AuthError('A conta do Google não informou o e-mail.', 'failed');
  return { email: body.email.slice(0, 200), name: (body.name ?? '').slice(0, 100) };
}

/** Esquece o token e o revoga no Google (melhor esforço). */
export function signOutGoogle() {
  const t = token?.value;
  token = null;
  if (t && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(t);
    } catch {
      /* sem problema */
    }
  }
}
