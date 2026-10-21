/**
 * Núcleo da sincronização (funções puras, testáveis sem rede nem navegador).
 *
 * O aparelho é sempre a fonte principal ("offline-first"): a nuvem recebe uma cópia mesclada.
 * - Listas (músicas, estudos, loops): mesclagem de 3 vias por id usando a última sincronização como base.
 *   Excluir um item vira um "tombstone" (marca de exclusão) que se espalha para os outros aparelhos.
 * - Estatísticas, revisão espaçada, dias de estudo e progresso das lições: mesmas regras de união do backup.
 * - Preferências de tela e chaves secretas (Spotify/YouTube) nunca saem do aparelho.
 */
import { SCHEMA_VERSION, isDataKey, mergeValue, sanitizeKey } from './backup';
import { LOOPS_KEY } from './loops';

export const SYNC_FORMAT = 1;
export const SNAPSHOT_NAME = 'songstate-data.json';
export const FILE_PREFIX = 'f-';
export const KEY_SONGS = 'ss.songs';
export const KEY_STUDIES = 'ss.studies';
export const LIST_KEYS: readonly string[] = [KEY_SONGS, KEY_STUDIES, LOOPS_KEY];
const LIST_LIMITS: Record<string, number> = { [KEY_SONGS]: 500, [KEY_STUDIES]: 200, [LOOPS_KEY]: 60 };
export const TOMB_DAYS = 120;

export type Tombs = Record<string, Record<string, number>>; // chave → id → quando foi excluído
export type Hashes = Record<string, Record<string, string>>; // chave → id → hash do item na última sincronização

export interface Snapshot {
  app: 'songstate-sync';
  format: number;
  schema: number;
  device: string;
  at: number;
  keys: Record<string, unknown>;
  tombs: Tombs;
}

export class SyncDataError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** JSON com chaves em ordem fixa: o mesmo conteúdo sempre gera o mesmo texto. */
export function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (isObj(v)) {
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

/** Hash curto (cyrb53) para detectar se um item mudou. */
export function hashOf(v: unknown): string {
  const s = stable(v);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// ---------- listas com exclusões ----------

type Item = { id: string; updatedAt?: number; createdAt?: number };
const itemsOf = (v: unknown): Item[] => (Array.isArray(v) ? v.filter((x): x is Item => isObj(x) && typeof x.id === 'string') : []);
const when = (i: Item) => i.updatedAt ?? i.createdAt ?? 0;

export interface ListMerge {
  items: Item[];
  tombs: Record<string, number>;
  hashes: Record<string, string>;
}

/**
 * Mescla uma lista local e a remota.
 * `base` = hash de cada item na última sincronização; um id que estava lá e sumiu daqui foi excluído neste aparelho.
 */
export function mergeList(local: unknown, remote: unknown, base: Record<string, string>, tombs: Record<string, number>, now: number, limit = 500): ListMerge {
  const L = new Map(itemsOf(local).map((i) => [i.id, i]));
  const R = new Map(itemsOf(remote).map((i) => [i.id, i]));
  const tomb: Record<string, number> = { ...tombs };

  for (const id of Object.keys(base)) if (!L.has(id) && tomb[id] === undefined) tomb[id] = now; // excluído aqui
  for (const id of Object.keys(tomb)) if (L.has(id) && !(id in base)) delete tomb[id]; // item novo aqui com um id já excluído (ex.: backup restaurado): volta
  for (const [id, at] of Object.entries(tomb)) if (now - at > TOMB_DAYS * 86400000) delete tomb[id];

  const items: Item[] = [];
  const hashes: Record<string, string> = {};
  for (const id of new Set([...L.keys(), ...R.keys()])) {
    if (tomb[id] !== undefined) continue;
    const l = L.get(id);
    const r = R.get(id);
    let pick: Item;
    if (!l) pick = r!;
    else if (!r) pick = l;
    else {
      const hl = hashOf(l);
      const hr = hashOf(r);
      const hb = base[id];
      if (hl === hr) pick = l;
      else if (hb === hl) pick = r; // só mudou na nuvem
      else if (hb === hr) pick = l; // só mudou aqui
      else pick = when(r) > when(l) ? r : l; // mudou nos dois: vale o mais recente (empate: o deste aparelho)
    }
    if (items.length >= limit) break;
    items.push(pick);
    hashes[id] = hashOf(pick);
  }
  return { items, tombs: tomb, hashes };
}

// ---------- mesclagem do conjunto todo ----------

export interface MergeInput {
  local: Record<string, unknown>; // chaves de dados deste aparelho (já filtradas pelo que sincroniza)
  remote: Snapshot | null;
  base: Hashes;
  tombs: Tombs;
  now: number;
  /** quais chaves entram na sincronização (ex.: loops só com áudio ligado) */
  wants: (key: string) => boolean;
}

export interface MergeResult {
  keys: Record<string, unknown>; // o que a nuvem deve guardar (inclui o que este aparelho não sincroniza, vindo da nuvem)
  changedLocal: string[]; // chaves a gravar neste aparelho
  tombs: Tombs;
  base: Hashes;
  remoteChanged: boolean;
}

export function mergeSnapshots(input: MergeInput): MergeResult {
  const { local, remote, base, now, wants } = input;
  const remoteKeys = remote?.keys ?? {};
  const keys: Record<string, unknown> = { ...remoteKeys };
  const tombs: Tombs = {};
  const nextBase: Hashes = {};
  const changedLocal: string[] = [];

  const names = new Set([...Object.keys(local), ...Object.keys(remoteKeys)].filter((k) => isDataKey(k) && wants(k)));
  for (const k of names) {
    const l = local[k];
    const r = remoteKeys[k];
    let merged: unknown;
    if (LIST_KEYS.includes(k)) {
      const t = { ...(remote?.tombs[k] ?? {}) };
      for (const [id, at] of Object.entries(input.tombs[k] ?? {})) t[id] = Math.max(t[id] ?? 0, at);
      const m = mergeList(l, r, base[k] ?? {}, t, now, LIST_LIMITS[k] ?? 500);
      merged = m.items;
      if (Object.keys(m.tombs).length) tombs[k] = m.tombs;
      nextBase[k] = m.hashes;
    } else if (l === undefined) merged = r;
    else if (r === undefined) merged = l;
    else merged = mergeValue(k, l, r);
    if (merged === undefined) continue;
    if (Array.isArray(merged) && merged.length === 0 && l === undefined) continue; // nada a criar
    keys[k] = merged;
    if (stable(merged) !== stable(l)) changedLocal.push(k);
  }
  // exclusões de chaves que este aparelho não sincroniza continuam como a nuvem tinha
  for (const [k, t] of Object.entries(remote?.tombs ?? {})) if (!wants(k)) tombs[k] = t;

  const remoteChanged = !remote || stable(keys) !== stable(remoteKeys) || stable(tombs) !== stable(remote.tombs);
  return { keys, changedLocal, tombs, base: nextBase, remoteChanged };
}

// ---------- validar o que vem da nuvem ----------

const ID = /^[\w-]{1,60}$/;

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SyncDataError('O arquivo da nuvem está ilegível.');
  }
  if (!isObj(raw) || raw.app !== 'songstate-sync' || !isObj(raw.keys)) throw new SyncDataError('O arquivo da nuvem não é do SongState.');
  if (typeof raw.format !== 'number' || raw.format > SYNC_FORMAT) throw new SyncDataError('Os dados na nuvem são de uma versão mais nova do app. Atualize o SongState para sincronizar.');
  if (typeof raw.schema === 'number' && raw.schema > SCHEMA_VERSION) throw new SyncDataError('Os dados na nuvem são de uma versão mais nova do app. Atualize o SongState para sincronizar.');
  const tombs: Tombs = {};
  if (isObj(raw.tombs)) {
    for (const [k, t] of Object.entries(raw.tombs)) {
      if (!LIST_KEYS.includes(k) || !isObj(t)) continue;
      const clean: Record<string, number> = {};
      for (const [id, at] of Object.entries(t).slice(0, 5000)) if (ID.test(id) && typeof at === 'number' && isFinite(at) && at >= 0) clean[id] = at;
      if (Object.keys(clean).length) tombs[k] = clean;
    }
  }
  return {
    app: 'songstate-sync',
    format: raw.format,
    schema: typeof raw.schema === 'number' ? raw.schema : 1,
    device: typeof raw.device === 'string' ? raw.device.slice(0, 40) : '',
    at: typeof raw.at === 'number' ? raw.at : 0,
    keys: raw.keys,
    tombs,
  };
}

/** Ids dos arquivos de áudio citados por músicas e loops (ignora os itens excluídos). */
export function fileIdsOf(keys: Record<string, unknown>, tombs: Tombs = {}): { songs: Set<string>; loops: Set<string> } {
  const songs = new Set<string>();
  const loops = new Set<string>();
  const gone = (k: string, id: unknown) => typeof id === 'string' && tombs[k]?.[id] !== undefined;
  for (const s of itemsOfAny(keys[KEY_SONGS])) {
    if (gone(KEY_SONGS, s.id)) continue;
    for (const src of Array.isArray(s.sources) ? s.sources : []) if (isObj(src) && src.kind === 'file' && typeof src.fileId === 'string' && /^[\w-]{1,40}$/.test(src.fileId)) songs.add(src.fileId);
  }
  for (const m of itemsOfAny(keys[LOOPS_KEY])) {
    if (gone(LOOPS_KEY, m.id)) continue;
    for (const l of Array.isArray(m.layers) ? m.layers : []) if (isObj(l) && typeof l.id === 'string' && /^[\w-]{1,40}$/.test(l.id)) loops.add(l.id);
  }
  return { songs, loops };
}

function itemsOfAny(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter(isObj) : [];
}

/**
 * Valida os dados vindos da nuvem, do mesmo jeito que um backup importado.
 * Músicas mantêm as referências a arquivos mesmo sem o áudio aqui (o player avisa que falta); loops exigem o áudio.
 */
export function sanitizeRemote(snap: Snapshot, localFiles: ReadonlySet<string>, wants: (key: string) => boolean = () => true): Snapshot {
  const keys: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(snap.keys)) {
    if (!isDataKey(k)) continue;
    if (!wants(k)) {
      keys[k] = v; // este aparelho não sincroniza essa chave: só repassa o que a nuvem já tinha, sem gravar aqui
      continue;
    }
    const allowed = k === KEY_SONGS ? new Set([...localFiles, ...fileIdsOf({ [KEY_SONGS]: v }).songs]) : localFiles;
    const clean = sanitizeKey(k, v, allowed);
    if (clean !== null) keys[k] = clean;
  }
  return { ...snap, keys };
}
