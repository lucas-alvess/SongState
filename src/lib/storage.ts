import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AccPref, Lang } from './music';

/**
 * Estado salvo em localStorage e **compartilhado** entre todos os componentes que usam a mesma
 * chave: quando um altera, os outros recebem a mudança na hora (ex.: Ajustes → página de Busca).
 */
function useSharedStorage<T>(key: string, read: () => T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(read);
  const self = useRef(Symbol(key));
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ key: string; source: symbol }>).detail;
      if (d.key === key && d.source !== self.current) setValue(read());
    };
    window.addEventListener('ss-storage', on);
    return () => window.removeEventListener('ss-storage', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(latest.current) : v;
      latest.current = next;
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* armazenamento indisponível */
      }
      window.dispatchEvent(new CustomEvent('ss-storage', { detail: { key, source: self.current } }));
    },
    [key],
  );
  return [value, set];
}

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  return useSharedStorage<T>(key, () => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? ({ ...(typeof initial === 'object' && !Array.isArray(initial) ? initial : {}), ...JSON.parse(raw) } as T) : initial;
    } catch {
      return initial;
    }
  });
}

/** Para listas (arrays) — sem o merge de objeto do useLocalStorage. */
export function useStoredList<T>(key: string): [T[], (v: T[] | ((p: T[]) => T[])) => void] {
  return useSharedStorage<T[]>(key, () => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '[]');
    } catch {
      return [];
    }
  });
}

// ---------- Configurações globais ----------

export interface Settings {
  lang: Lang;
  pref: AccPref;
  tuningId: string;
  leftHanded: boolean;
  orientation: 'auto' | 'h' | 'v';
}

export const DEFAULT_SETTINGS: Settings = { lang: 'letters', pref: 'sharp', tuningId: 'standard', leftHanded: false, orientation: 'auto' };

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}
export const SettingsContext = createContext<Ctx>({ settings: DEFAULT_SETTINGS, update: () => {} });
export const useSettings = () => useContext(SettingsContext);

export function useIsNarrow(breakpoint = 760) {
  const [narrow, setNarrow] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < breakpoint);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [breakpoint]);
  return narrow;
}

export function useVertical() {
  const { settings } = useSettings();
  const narrow = useIsNarrow();
  return settings.orientation === 'auto' ? narrow : settings.orientation === 'v';
}

// ---------- Estatísticas dos exercícios ----------

export interface ExerciseStat {
  attempts: number;
  correct: number;
  best: number; // melhor sequência
  last: number; // timestamp
}
export type StatsMap = Record<string, ExerciseStat>;

export function useStats() {
  const [stats, setStats] = useLocalStorage<StatsMap>('ss.stats', {});
  const record = useCallback(
    (id: string, ok: boolean, streak: number) =>
      setStats((s) => {
        const cur = s[id] ?? { attempts: 0, correct: 0, best: 0, last: 0 };
        return { ...s, [id]: { attempts: cur.attempts + 1, correct: cur.correct + (ok ? 1 : 0), best: Math.max(cur.best, streak), last: Date.now() } };
      }),
    [setStats],
  );
  return { stats, record };
}

// ---------- IndexedDB (arquivos de áudio) ----------

const DB = 'songstation';
const STORE = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const putFile = (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id));
export const getFile = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id));
export const delFile = (id: string) => tx('readwrite', (s) => s.delete(id));

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---------- Integrações (chaves ficam só neste navegador) ----------

export interface Integrations {
  spotifyClientId: string;
  youtubeKey: string;
}
export const useIntegrations = () => useLocalStorage<Integrations>('ss.integrations', { spotifyClientId: '', youtubeKey: '' });
