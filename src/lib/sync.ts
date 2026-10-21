/**
 * Gerenciador da sincronização: login, quando sincronizar e o estado mostrado na tela.
 *
 * O app funciona normalmente sem login e sem internet. Quando há conta ligada, cada alteração nos dados
 * agenda uma rodada (runSync) que só roda com internet e com o token do Google válido; sem isso, os dados
 * ficam no aparelho e vão para a nuvem na próxima oportunidade.
 */
import { useSyncExternalStore } from 'react';
import { isDataKey, wipeAll } from './backup';
import { delFile, dbKeys, getFile, putFile } from './db';
import { DriveError, createDrive } from './drive';
import { AuthError, fetchProfile, getToken, requestToken, signOutGoogle } from './google-auth';
import { STATE_KEY, newDevice, readState, runSync, writeState, type FileStore } from './sync-engine';
import { SyncDataError } from './sync-core';
import { notifyStorage } from './storage';

export const CFG_KEY = 'ss.sync.cfg';
const CLIENT_ID = /^[\w-]+(\.[\w-]+)*\.apps\.googleusercontent\.com$/;
const ENV_CLIENT_ID: string = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';
const DEBOUNCE_MS = 4000;
const POLL_MS = 5 * 60 * 1000;

interface Cfg {
  clientId: string;
  audio: boolean;
  email: string; // conta ligada a este aparelho ('' = sem login)
  name: string;
}

export type SyncStatus = 'off' | 'connecting' | 'login-needed' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncView {
  configured: boolean;
  clientId: string;
  usingBuiltInId: boolean;
  linked: boolean;
  email: string;
  name: string;
  audio: boolean;
  status: SyncStatus;
  lastSync: number;
  error: string;
  pending: boolean; // há alterações ainda não enviadas
  skipped: number; // arquivos grandes demais para enviar
}

function readCfg(): Cfg {
  try {
    const raw = JSON.parse(localStorage.getItem(CFG_KEY) ?? 'null') as Partial<Cfg> | null;
    return {
      clientId: typeof raw?.clientId === 'string' ? raw.clientId.trim().slice(0, 200) : '',
      audio: raw?.audio === true,
      email: typeof raw?.email === 'string' ? raw.email.slice(0, 200) : '',
      name: typeof raw?.name === 'string' ? raw.name.slice(0, 100) : '',
    };
  } catch {
    return { clientId: '', audio: false, email: '', name: '' };
  }
}

function writeCfg(patch: Partial<Cfg>) {
  const next = { ...readCfg(), ...patch };
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(next));
  } catch {
    /* armazenamento indisponível */
  }
  return next;
}

const effectiveId = (cfg: Cfg) => cfg.clientId || ENV_CLIENT_ID;

function build(cfg: Cfg, prev?: SyncView): SyncView {
  const id = effectiveId(cfg);
  const linked = !!cfg.email;
  return {
    configured: CLIENT_ID.test(id),
    clientId: cfg.clientId,
    usingBuiltInId: !cfg.clientId && !!ENV_CLIENT_ID,
    linked,
    email: cfg.email,
    name: cfg.name,
    audio: cfg.audio,
    status: linked ? (prev?.linked ? prev.status : 'login-needed') : 'off',
    lastSync: linked ? readState(localStorage).lastSync : 0,
    error: prev?.error ?? '',
    pending: prev?.pending ?? false,
    skipped: prev?.skipped ?? 0,
  };
}

let view: SyncView = build(readCfg());
const subs = new Set<() => void>();
function emit(patch: Partial<SyncView>) {
  view = { ...view, ...patch };
  subs.forEach((f) => f());
}
const reload = (patch: Partial<SyncView> = {}) => {
  view = { ...build(readCfg(), view), ...patch };
  subs.forEach((f) => f());
};

export const subscribeSync = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export const getSyncView = () => view;
export const useSync = () => useSyncExternalStore(subscribeSync, getSyncView);

// ---------- arquivos locais (IndexedDB) ----------

const localFiles: FileStore = {
  ids: async () => ((await dbKeys('files').catch(() => [])) as string[]).filter((k) => typeof k === 'string'),
  get: (id) => getFile(id),
  put: (id, blob) => putFile(id, blob),
  del: (id) => delFile(id),
};

// ---------- rodada de sincronização ----------

let running: Promise<void> | null = null;
let again = false;
let timer = 0;
let suppress = false; // ignora os avisos gerados pela própria sincronização
let dirtyAt = 0;
const drive = createDrive(() => getToken());

function describe(e: unknown): Partial<SyncView> {
  if (e instanceof DriveError) {
    if (e.kind === 'auth') return { status: 'login-needed', error: e.message };
    if (e.kind === 'network') return { status: 'offline', error: '' };
    return { status: 'error', error: e.message };
  }
  if (e instanceof SyncDataError) return { status: 'error', error: e.message };
  if (e instanceof TypeError) return { status: 'offline', error: '' }; // fetch sem rede
  return { status: 'error', error: e instanceof Error ? e.message : 'A sincronização falhou.' };
}

async function once(): Promise<void> {
  if (!view.linked) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return emit({ status: 'offline' });
  if (!getToken()) return emit({ status: 'login-needed' });
  const started = Date.now();
  emit({ status: 'syncing', error: '' });
  const work = async () => {
    try {
      const report = await runSync({
        store: localStorage,
        drive,
        files: localFiles,
        audio: view.audio,
        onWritten: (keys) => {
          suppress = true;
          try {
            notifyStorage(keys);
          } finally {
            suppress = false;
          }
        },
      });
      emit({ status: 'idle', error: '', lastSync: readState(localStorage).lastSync, skipped: report.skipped.length, pending: dirtyAt > started });
    } catch (e) {
      emit(describe(e));
    }
  };
  // vários abas abertas: só uma sincroniza por vez
  if (navigator.locks) {
    let ran = false;
    await navigator.locks.request('songstate-sync', { ifAvailable: true }, async (lock) => {
      if (!lock) return;
      ran = true;
      await work();
    });
    if (!ran) emit({ status: 'idle' });
  } else await work();
}

export function syncNow(): Promise<void> {
  if (!view.linked) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await once();
    } while (again && view.status === 'idle');
  })().finally(() => {
    running = null;
  });
  return running;
}

function schedule(ms = DEBOUNCE_MS) {
  clearTimeout(timer);
  if (!view.linked) return;
  timer = window.setTimeout(() => void syncNow(), ms);
}

// ---------- login ----------

/** Chame a partir de um toque do usuário (o navegador só abre a janela de login assim). */
export async function connect(): Promise<void> {
  const cfg = readCfg();
  const id = effectiveId(cfg);
  if (!CLIENT_ID.test(id)) throw new AuthError('Falta configurar o Client ID do Google.', 'failed');
  emit({ status: 'connecting', error: '' });
  try {
    const token = await requestToken(id, { prompt: cfg.email ? '' : 'select_account', hint: cfg.email || undefined });
    const profile = await fetchProfile(token);
    if (cfg.email && cfg.email.toLowerCase() !== profile.email.toLowerCase()) {
      const ok = confirm(`Este aparelho estava ligado a ${cfg.email}. Ligar a ${profile.email}? Os dados daqui serão mesclados com os dessa conta.`);
      if (!ok) {
        signOutGoogle();
        reload({ status: 'login-needed', error: '' });
        return;
      }
      const st = readState(localStorage);
      writeState(localStorage, { ...st, base: {}, tombs: {}, lastSync: 0 }); // outra conta: recomeça sem inferir exclusões
    } else if (!cfg.email) {
      const st = readState(localStorage);
      writeState(localStorage, { ...st, base: {}, tombs: {}, lastSync: 0 });
    }
    writeCfg({ email: profile.email, name: profile.name });
    reload({ status: 'idle', error: '' });
    dirtyAt = Date.now();
    await syncNow();
  } catch (e) {
    const code = e instanceof AuthError ? e.code : '';
    if (code === 'cancelled') return reload({ status: view.linked ? 'login-needed' : 'off', error: '' });
    reload({ status: view.linked ? 'login-needed' : 'off', error: e instanceof Error ? e.message : 'Não foi possível entrar.' });
  }
}

/** Para de sincronizar. Com `wipe`, apaga também os dados deste aparelho (ficam só na nuvem). */
export async function disconnect(wipe: boolean): Promise<void> {
  if (wipe) {
    clearTimeout(timer);
    await syncNow(); // último envio, para não perder nada
    if (view.status !== 'idle' || view.pending) {
      if (!confirm('Não foi possível enviar as últimas alterações para a nuvem. Apagar os dados deste aparelho mesmo assim?')) return;
    }
  }
  clearTimeout(timer);
  signOutGoogle();
  if (wipe) {
    await wipeAll(localStorage);
    location.reload();
    return;
  }
  try {
    localStorage.removeItem(STATE_KEY);
  } catch {
    /* sem problema */
  }
  writeCfg({ email: '', name: '' });
  reload({ status: 'off', error: '', pending: false });
}

export function setAudio(audio: boolean) {
  writeCfg({ audio });
  reload();
  dirtyAt = Date.now();
  schedule(500);
}

export function setClientId(clientId: string) {
  writeCfg({ clientId: clientId.trim().slice(0, 200) });
  reload({ error: '' });
}

// ---------- gatilhos automáticos ----------

let started = false;

/** Liga os gatilhos (alterações nos dados, volta da internet, aba visível, relógio). Chame uma vez ao abrir o app. */
export function initSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const markDirty = (key: string) => {
    if (suppress || !view.linked || !isDataKey(key)) return;
    dirtyAt = Date.now();
    if (!view.pending) emit({ pending: true });
    schedule();
  };
  window.addEventListener('ss-storage', (e) => markDirty((e as CustomEvent<{ key: string }>).detail.key));
  window.addEventListener('storage', (e) => e.key && markDirty(e.key)); // outra aba alterou
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => view.linked && emit({ status: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && view.linked && Date.now() - view.lastSync > 60_000) schedule(500);
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible' && view.linked && view.status !== 'login-needed') void syncNow();
  }, POLL_MS);
  // O token do Google só vive na memória: ao reabrir o app, a conta continua ligada, mas é preciso um toque
  // em "Reconectar" (menu superior ou Configurações) para voltar a enviar. Nada é aberto sem o usuário pedir.
}

export { newDevice };
