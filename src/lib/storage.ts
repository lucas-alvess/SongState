import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AccPref, Lang } from './music';
import { bumpDay, type DaysMap, type SrsMap } from './srs';

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

/** Avisa os componentes abertos que essas chaves foram alteradas de fora (importação de backup etc.). */
export function notifyStorage(keys: string[]) {
  const source = Symbol('external');
  for (const key of keys) window.dispatchEvent(new CustomEvent('ss-storage', { detail: { key, source } }));
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

/** Resumo por dia (sequência de dias e estatísticas): alimentado pelos exercícios e pelo Treino. */
export const useDays = () => useLocalStorage<DaysMap>('ss.days', {});
/** Estado da revisão espaçada do Treino, por item. */
export const useSrs = () => useLocalStorage<SrsMap>('ss.srs', {});

export function useStats() {
  const [stats, setStats] = useLocalStorage<StatsMap>('ss.stats', {});
  const [, setDays] = useDays();
  const record = useCallback(
    (id: string, ok: boolean, streak: number) => {
      const now = Date.now();
      setStats((s) => {
        const cur = s[id] ?? { attempts: 0, correct: 0, best: 0, last: 0 };
        return { ...s, [id]: { attempts: cur.attempts + 1, correct: cur.correct + (ok ? 1 : 0), best: Math.max(cur.best, streak), last: now } };
      });
      setDays((d) => bumpDay(d, now, id, ok));
    },
    [setStats, setDays],
  );
  return { stats, record };
}

// ---------- IndexedDB (arquivos de áudio) ----------
// A implementação está em db.ts; as funções são reexportadas aqui para manter os imports existentes.
export { putFile, getFile, delFile } from './db';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---------- Integrações (chaves ficam só neste navegador) ----------

export interface Integrations {
  spotifyClientId: string;
  youtubeKey: string;
}
/**
 * IDs públicos embutidos no site pelo dono (variáveis VITE_SPOTIFY_CLIENT_ID e VITE_YOUTUBE_KEY no build).
 * Quando existem, os usuários só clicam em "Conectar"; sem eles, cada um pode informar o seu em Configurações.
 */
export const BUILT_IN: Integrations = {
  spotifyClientId: String(import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '').trim(),
  youtubeKey: String(import.meta.env.VITE_YOUTUBE_KEY ?? '').trim(),
};

export function useIntegrations(): [Integrations, (v: Integrations | ((p: Integrations) => Integrations)) => void] {
  const [stored, set] = useLocalStorage<Integrations>('ss.integrations', { spotifyClientId: '', youtubeKey: '' });
  return [{ spotifyClientId: BUILT_IN.spotifyClientId || stored.spotifyClientId, youtubeKey: BUILT_IN.youtubeKey || stored.youtubeKey }, set];
}
