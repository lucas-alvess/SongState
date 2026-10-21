import { useEffect, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Spotify?: any;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

const AUTH = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';
const SCOPES = ['streaming', 'user-read-email', 'user-read-private', 'user-read-playback-state', 'user-modify-playback-state'].join(' ');

const TOKENS = 'ss.spotify.tokens';
const VERIFIER = 'ss.spotify.verifier';
const RETURN = 'ss.spotify.return';
const CLIENT = 'ss.spotify.client';

/** O Spotify só aceita https ou o IP de loopback (http://127.0.0.1) como endereço de retorno. */
export const redirectUri = () => window.location.origin + window.location.pathname;
export const isMobileBrowser = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

interface Tokens {
  access: string;
  refresh: string;
  expires: number;
}

const readTokens = (): Tokens | null => {
  try {
    return JSON.parse(localStorage.getItem(TOKENS) ?? 'null');
  } catch {
    return null;
  }
};
const emit = () => window.dispatchEvent(new Event('ss-spotify-auth'));
const saveTokens = (t: Tokens | null) => {
  if (t) localStorage.setItem(TOKENS, JSON.stringify(t));
  else localStorage.removeItem(TOKENS);
  emit();
};

export function useSpotifyConnected() {
  const [connected, setConnected] = useState(() => !!readTokens());
  useEffect(() => {
    const on = () => setConnected(!!readTokens());
    window.addEventListener('ss-spotify-auth', on);
    return () => window.removeEventListener('ss-spotify-auth', on);
  }, []);
  return connected;
}

// ---------- OAuth (PKCE, sem servidor) ----------

const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomString = (n = 64) => b64url(crypto.getRandomValues(new Uint8Array(n)).buffer).slice(0, n);

export async function buildAuthUrl(clientId: string, returnHash: string) {
  const verifier = randomString(96);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  localStorage.setItem(VERIFIER, verifier);
  localStorage.setItem(RETURN, returnHash);
  localStorage.setItem(CLIENT, clientId);
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  return `${AUTH}/authorize?${p}`;
}

export async function loginSpotify(clientId: string) {
  window.location.href = await buildAuthUrl(clientId.trim(), window.location.hash || '#/backing/buscar');
}

export function logoutSpotify() {
  saveTokens(null);
  playerPromise = null;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(`${AUTH}/api/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description ?? json.error ?? 'Falha ao autenticar no Spotify');
  return json as { access_token: string; refresh_token?: string; expires_in: number };
}

/** Chamado antes de montar o app: troca o código devolvido pelo Spotify por tokens. */
export async function handleSpotifyRedirect() {
  const q = new URLSearchParams(window.location.search);
  const code = q.get('code');
  const err = q.get('error');
  if (!code && !err) return;
  const back = localStorage.getItem(RETURN) || '#/backing/buscar';
  const clean = () => window.history.replaceState(null, '', window.location.origin + window.location.pathname + back);
  if (err || !code) {
    clean();
    sessionStorage.setItem('ss.spotify.error', err === 'access_denied' ? 'Acesso negado no Spotify.' : `Erro do Spotify: ${err}`);
    return;
  }
  try {
    const t = await tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: localStorage.getItem(CLIENT) ?? '',
      code_verifier: localStorage.getItem(VERIFIER) ?? '',
    });
    saveTokens({ access: t.access_token, refresh: t.refresh_token ?? '', expires: Date.now() + t.expires_in * 1000 });
  } catch (e) {
    sessionStorage.setItem('ss.spotify.error', (e as Error).message);
  }
  clean();
}

export async function getToken(): Promise<string | null> {
  const t = readTokens();
  if (!t) return null;
  if (t.expires - 60_000 > Date.now()) return t.access;
  try {
    const n = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: localStorage.getItem(CLIENT) ?? '' });
    const next = { access: n.access_token, refresh: n.refresh_token ?? t.refresh, expires: Date.now() + n.expires_in * 1000 };
    saveTokens(next);
    return next.access;
  } catch {
    saveTokens(null);
    return null;
  }
}

async function api(path: string, init?: RequestInit) {
  const token = await getToken();
  if (!token) throw new Error('Conecte sua conta do Spotify primeiro.');
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? `Spotify respondeu ${res.status}`);
  return json;
}

// ---------- Busca ----------

export interface SpotifyResult {
  kind: 'track' | 'playlist';
  id: string;
  uri: string;
  title: string;
  subtitle: string;
  thumb?: string;
}

export async function spotifySearch(q: string, limit = 12): Promise<SpotifyResult[]> {
  const json = await api(`/search?${new URLSearchParams({ q, type: 'track,playlist', limit: String(limit) })}`);
  const tracks: SpotifyResult[] = (json.tracks?.items ?? []).filter(Boolean).map((t: any) => ({
    kind: 'track',
    id: t.id,
    uri: t.uri,
    title: t.name,
    subtitle: `${t.artists.map((a: any) => a.name).join(', ')} · ${t.album?.name ?? ''}`,
    thumb: t.album?.images?.[1]?.url ?? t.album?.images?.[0]?.url,
  }));
  const lists: SpotifyResult[] = (json.playlists?.items ?? []).filter(Boolean).map((p: any) => ({
    kind: 'playlist',
    id: p.id,
    uri: p.uri,
    title: p.name,
    subtitle: `Playlist · ${p.owner?.display_name ?? ''}`,
    thumb: p.images?.[0]?.url,
  }));
  return [...tracks, ...lists];
}

export async function spotifyOembed(url: string): Promise<{ title: string; thumb?: string } | null> {
  try {
    const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
    if (!r.ok) return null;
    const j = await r.json();
    return { title: j.title, thumb: j.thumbnail_url };
  } catch {
    return null;
  }
}

// ---------- Web Playback SDK ----------

export interface SpotifyState {
  paused: boolean;
  position: number; // ms
  duration: number;
  title: string;
  artist: string;
  thumb?: string;
}

export interface SpotifyHandle {
  player: any;
  deviceId: string;
}

let playerPromise: Promise<SpotifyHandle> | null = null;

function loadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Spotify) return resolve();
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    s.onerror = () => reject(new Error('Não foi possível carregar o SDK do Spotify.'));
    document.head.appendChild(s);
  });
}

export function getSpotifyPlayer(onError: (msg: string) => void): Promise<SpotifyHandle> {
  if (playerPromise) return playerPromise;
  playerPromise = (async () => {
    await loadSdk();
    return new Promise<SpotifyHandle>((resolve, reject) => {
      const player = new window.Spotify.Player({
        name: 'SongState',
        volume: 0.8,
        getOAuthToken: (cb: (t: string) => void) => {
          getToken().then((t) => cb(t ?? ''));
        },
      });
      const fail = (msg: string) => {
        onError(msg);
        playerPromise = null;
        reject(new Error(msg));
      };
      player.addListener('ready', ({ device_id }: { device_id: string }) => resolve({ player, deviceId: device_id }));
      player.addListener('initialization_error', () => fail('Este navegador não suporta o player do Spotify. Use um navegador de computador (Chrome, Edge ou Firefox).'));
      player.addListener('authentication_error', () => fail('Falha de autenticação. Reconecte sua conta do Spotify nos ajustes.'));
      player.addListener('account_error', () => fail('O player do Spotify exige uma conta Premium.'));
      player.addListener('playback_error', ({ message }: { message: string }) => onError(`Erro de reprodução: ${message}`));
      player.connect().then((ok: boolean) => {
        if (!ok) fail('Não foi possível conectar ao Spotify.');
      });
    });
  })();
  playerPromise.catch(() => {
    playerPromise = null;
  });
  return playerPromise;
}

export async function startSpotifyPlayback(deviceId: string, uri: string) {
  const body = uri.startsWith('spotify:track:') ? { uris: [uri] } : { context_uri: uri };
  await api(`/me/player/play?device_id=${deviceId}`, { method: 'PUT', body: JSON.stringify(body) });
}
