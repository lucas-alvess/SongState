/**
 * Backup e restauração de todos os dados do usuário em um único arquivo JSON.
 *
 * Regras de segurança:
 *  - só chaves conhecidas (lista abaixo) entram no backup e só elas são aceitas na importação;
 *  - chaves secretas (tokens do Spotify, chave do YouTube) NUNCA vão para o arquivo;
 *  - tudo o que chega é validado e reconstruído (sanitize), como nas músicas importadas.
 */
import { delFile, dbKeys, getFile, putFile } from './db';
import { MIGRATIONS } from './migrations';
import { SCALES } from './music';
import { LOOPS_KEY, loopFileIds, sanitizeLoops } from './loops';
import { sanitizeSong, type Song } from './songs';
import type { Lesson } from './curriculum';
import { MAX_ITEMS, prune, type DaysMap, type SrsMap } from './srs';

export const BACKUP_FORMAT = 1;
export const SCHEMA_VERSION = Math.max(...MIGRATIONS.map((m) => m.version));
export const LAST_BACKUP_KEY = 'ss.lastBackup'; // só local: data do último backup exportado

const KEY_SONGS = 'ss.songs';
const KEY_STUDIES = 'ss.studies';
const KEY_STATS = 'ss.stats';
const KEY_SRS = 'ss.srs'; // revisão espaçada do Treino
const KEY_DAYS = 'ss.days'; // resumo diário de estudo
const KEY_LOOPS = LOOPS_KEY; // loops e gravações (o áudio vai junto só se o usuário marcar "incluir áudio")
const STUDY_PROGRESS = /^ss\.study\.[\w-]{1,60}$/;
const PREFS = /^ss\.(settings|board|chords|fields|jam|mix|dock|search|treino|goal|tuner|looper|studies\.tab|cfg\.[\w-]{1,40})$/;

/** Dados do usuário (têm regra de mesclagem própria). */
export const isDataKey = (k: string) => k === KEY_SONGS || k === KEY_STUDIES || k === KEY_STATS || k === KEY_SRS || k === KEY_DAYS || k === KEY_LOOPS || STUDY_PROGRESS.test(k);
/** Preferências de tela (valem para backup, mas nunca sobrescrevem o que já existe ao mesclar). */
export const isPrefKey = (k: string) => PREFS.test(k);
export const isBackupKey = (k: string) => isDataKey(k) || isPrefKey(k);
/** Nunca exportadas nem importadas. */
export const isSecretKey = (k: string) => k.startsWith('ss.spotify.') || k === 'ss.integrations';

export interface KeyStore {
  readonly length: number;
  key(i: number): string | null;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export interface BackupFile {
  id: string;
  type: string;
  data: string; // base64
}

export interface Backup {
  app: 'songstate';
  format: number;
  schema: number;
  exportedAt: string;
  keys: Record<string, unknown>;
  files: BackupFile[];
}

export class BackupError extends Error {}

// ---------- utilidades ----------

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

export function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

const safeType = (t: unknown) => (typeof t === 'string' && /^(audio|video)\/[\w.+-]{1,40}$/.test(t) ? t : 'audio/mpeg');

// ---------- sanitização de cada tipo de dado ----------

function sanitizeLesson(d: unknown): Lesson | null {
  if (!isObj(d)) return null;
  const id = str(d.id, 60);
  const title = str(d.title, 200).trim();
  if (!/^custom-[\w-]+$/.test(id) || !title) return null;
  const b = isObj(d.board) ? d.board : {};
  const scaleId = str(b.scaleId, 40);
  if (!SCALES.some((s) => s.id === scaleId)) return null;
  return {
    id,
    title,
    desc: str(d.desc, 1000),
    bpm: Math.round(num(d.bpm, 30, 240, 70)),
    custom: true,
    steps: Array.isArray(d.steps) ? d.steps.slice(0, 50).map((s) => str(s, 500)).filter(Boolean) : [],
    board: {
      root: Math.round(num(b.root, 0, 11, 9)),
      scaleId,
      pos: b.pos === null ? null : Math.round(num(b.pos, 0, 11, 0)),
      fretMax: Math.round(num(b.fretMax, 5, 24, 17)),
      label: b.label === 'degree' || b.label === 'none' ? b.label : 'note',
    },
  };
}

function sanitizeStats(d: unknown): Record<string, unknown> | null {
  if (!isObj(d)) return null;
  const out: Record<string, unknown> = {};
  for (const [id, v] of Object.entries(d).slice(0, 200)) {
    if (!/^[\w-]{1,40}$/.test(id) || !isObj(v)) continue;
    out[id] = { attempts: Math.round(num(v.attempts, 0, 1e9, 0)), correct: Math.round(num(v.correct, 0, 1e9, 0)), best: Math.round(num(v.best, 0, 1e9, 0)), last: num(v.last, 0, 1e15, 0) };
  }
  return out;
}

const SRS_ID = /^[a-z]+\|[\w|-]{1,70}$/;
function sanitizeSrs(d: unknown): SrsMap | null {
  if (!isObj(d)) return null;
  const out: SrsMap = {};
  for (const [id, v] of Object.entries(d).slice(0, MAX_ITEMS)) {
    if (!SRS_ID.test(id) || !isObj(v)) continue;
    out[id] = { e: num(v.e, 1.3, 3, 2.5), i: Math.round(num(v.i, 0, 3650, 0)), d: num(v.d, 0, 1e15, 0), r: Math.round(num(v.r, 0, 1000, 0)), l: Math.round(num(v.l, 0, 1e6, 0)), n: Math.round(num(v.n, 0, 1e6, 0)), t: num(v.t, 0, 1e15, 0) };
  }
  return out;
}

function sanitizeDays(d: unknown): DaysMap | null {
  if (!isObj(d)) return null;
  const out: DaysMap = {};
  for (const [day, v] of Object.entries(d).slice(-800)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !isObj(v)) continue;
    const by: DaysMap[string]['by'] = {};
    if (isObj(v.by)) for (const [k, pair] of Object.entries(v.by).slice(0, 20)) if (/^[\w-]{1,20}$/.test(k) && Array.isArray(pair)) by[k] = [Math.round(num(pair[0], 0, 1e6, 0)), Math.round(num(pair[1], 0, 1e6, 0))];
    const entry: DaysMap[string] = { n: Math.round(num(v.n, 0, 1e6, 0)), ok: Math.round(num(v.ok, 0, 1e6, 0)), by };
    if (typeof v.ms === 'number') entry.ms = Math.round(num(v.ms, 0, 86400000, 0)); // no máximo 24 h por dia
    if (isObj(v.pg)) {
      const pg: Record<string, number> = {};
      for (const [k, ms] of Object.entries(v.pg).slice(0, 20)) if (/^[\w-]{1,20}$/.test(k)) pg[k] = Math.round(num(ms, 0, 86400000, 0));
      entry.pg = pg;
    }
    out[day] = entry;
  }
  return out;
}

function sanitizeProgress(d: unknown): { done: boolean[]; sessions: { at: number; bpm: number }[] } | null {
  if (!isObj(d)) return null;
  const done = Array.isArray(d.done) ? d.done.slice(0, 100).map((x) => x === true) : [];
  const sessions = Array.isArray(d.sessions)
    ? d.sessions
        .slice(-200)
        .filter(isObj)
        .map((s) => ({ at: num(s.at, 0, 1e15, 0), bpm: num(s.bpm, 0, 400, 0) }))
    : [];
  return { done, sessions };
}

/** Preferências: objeto simples e pequeno, sem funções (o JSON já garante). */
function sanitizePref(d: unknown): Record<string, unknown> | null {
  if (!isObj(d)) return null;
  return JSON.stringify(d).length <= 20000 ? d : null;
}

function sanitizeKey(key: string, value: unknown, files: ReadonlySet<string>): unknown | null {
  if (key === KEY_SONGS) {
    if (!Array.isArray(value)) return null;
    return value.slice(0, 500).map((s) => sanitizeSong(s, files)).filter((s): s is Song => !!s);
  }
  if (key === KEY_STUDIES) return Array.isArray(value) ? value.slice(0, 200).map(sanitizeLesson).filter((l): l is Lesson => !!l) : null;
  if (key === KEY_STATS) return sanitizeStats(value);
  if (key === KEY_SRS) return sanitizeSrs(value);
  if (key === KEY_DAYS) return sanitizeDays(value);
  if (key === KEY_LOOPS) {
    const loops = sanitizeLoops(value, files); // sem o áudio junto, o loop não serve: descarta
    return loops.length ? loops : null; // nada aproveitável: a chave nem entra (não pode apagar os loops de quem restaura)
  }
  if (STUDY_PROGRESS.test(key)) return sanitizeProgress(value);
  return sanitizePref(value);
}

// ---------- exportar ----------

function readJson(store: KeyStore, key: string): unknown {
  try {
    const raw = store.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function listBackupKeys(store: KeyStore): string[] {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && isBackupKey(k) && !isSecretKey(k)) keys.push(k);
  }
  return keys.sort();
}

/** Ids dos arquivos de áudio usados pelas músicas e pelos loops do usuário. */
export function referencedFileIds(store: KeyStore): string[] {
  const ids = new Set<string>(loopFileIds(readJson(store, KEY_LOOPS)));
  const songs = readJson(store, KEY_SONGS);
  if (Array.isArray(songs)) for (const s of songs) for (const src of Array.isArray(s?.sources) ? s.sources : []) if (src?.kind === 'file' && typeof src.fileId === 'string') ids.add(src.fileId);
  return [...ids];
}

export async function createBackup(store: KeyStore, opts: { files: boolean }): Promise<{ blob: Blob; counts: Summary }> {
  const keys: Record<string, unknown> = {};
  for (const k of listBackupKeys(store)) {
    const v = readJson(store, k);
    if (v !== undefined) keys[k] = v;
  }
  const files: BackupFile[] = [];
  if (!opts.files) delete keys[KEY_LOOPS]; // loops sem áudio não têm utilidade; e ao restaurar não podem apagar os que já existem
  if (opts.files) {
    for (const id of referencedFileIds(store)) {
      const blob = await getFile(id).catch(() => undefined);
      if (blob) files.push({ id, type: blob.type, data: await blobToBase64(blob) });
    }
  }
  const header: Omit<Backup, 'files'> = { app: 'songstate', format: BACKUP_FORMAT, schema: SCHEMA_VERSION, exportedAt: new Date().toISOString(), keys };
  const json = JSON.stringify({ ...header, files });
  return { blob: new Blob([json], { type: 'application/json' }), counts: summarize(keys, files.length) };
}

// ---------- ler e validar ----------

export const MAX_BACKUP_BYTES = 300 * 1024 * 1024;

export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('O arquivo não é um JSON válido.');
  }
  if (!isObj(raw) || raw.app !== 'songstate') throw new BackupError('Este arquivo não é um backup do SongState.');
  if (typeof raw.format !== 'number' || raw.format > BACKUP_FORMAT) throw new BackupError('Backup de uma versão mais nova do app. Atualize o SongState e tente de novo.');
  if (typeof raw.schema === 'number' && raw.schema > SCHEMA_VERSION) throw new BackupError('Backup criado por uma versão mais nova do app. Atualize o SongState e tente de novo.');
  if (!isObj(raw.keys)) throw new BackupError('Backup sem dados.');

  const files: BackupFile[] = [];
  if (Array.isArray(raw.files)) {
    for (const f of raw.files.slice(0, 500)) {
      if (isObj(f) && typeof f.id === 'string' && /^[\w-]{1,40}$/.test(f.id) && typeof f.data === 'string' && /^[A-Za-z0-9+/=]*$/.test(f.data)) files.push({ id: f.id, type: safeType(f.type), data: f.data });
    }
  }
  const fileIds = new Set(files.map((f) => f.id));
  const keys: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw.keys)) {
    if (!isBackupKey(k) || isSecretKey(k)) continue; // ignora o que não conhece
    const clean = sanitizeKey(k, v, fileIds);
    if (clean !== null) keys[k] = clean;
  }
  return { app: 'songstate', format: raw.format, schema: typeof raw.schema === 'number' ? raw.schema : 1, exportedAt: str(raw.exportedAt, 40), keys, files };
}

// ---------- mesclar ----------

export type ImportMode = 'merge' | 'replace';

const dayScore = (d: DaysMap[string]) => (d.ms ?? 0) + d.n * 1000;
const byId = <T extends { id: string }>(cur: T[], inc: T[]) => [...cur, ...inc.filter((x) => !cur.some((c) => c.id === x.id))];

/** Resultado da mesclagem de uma chave de dados. `undefined` em `current` = não existe ainda. */
export function mergeValue(key: string, current: unknown, incoming: unknown): unknown {
  if (current === undefined) return incoming;
  if (key === KEY_SONGS || key === KEY_STUDIES || key === KEY_LOOPS) return byId(Array.isArray(current) ? (current as { id: string }[]) : [], incoming as { id: string }[]);
  if (key === KEY_STATS) {
    const cur = isObj(current) ? (current as Record<string, { last: number }>) : {};
    const out: Record<string, { last: number }> = { ...cur };
    for (const [id, v] of Object.entries(incoming as Record<string, { last: number }>)) if (!out[id] || v.last > out[id].last) out[id] = v;
    return out;
  }
  if (key === KEY_SRS) {
    const out: SrsMap = { ...(isObj(current) ? (current as SrsMap) : {}) };
    for (const [id, v] of Object.entries(incoming as SrsMap)) if (!out[id] || v.t > out[id].t) out[id] = v;
    return prune(out);
  }
  if (key === KEY_DAYS) {
    const out: DaysMap = { ...(isObj(current) ? (current as DaysMap) : {}) };
    for (const [day, v] of Object.entries(incoming as DaysMap)) if (!out[day] || dayScore(v) > dayScore(out[day])) out[day] = v; // o mesmo dia vindo de dois aparelhos: fica o mais completo
    return out;
  }
  if (STUDY_PROGRESS.test(key)) {
    const c = sanitizeProgress(current) ?? { done: [], sessions: [] };
    const i = incoming as { done: boolean[]; sessions: { at: number; bpm: number }[] };
    const len = Math.max(c.done.length, i.done.length);
    const done = Array.from({ length: len }, (_, n) => !!c.done[n] || !!i.done[n]);
    const seen = new Set<number>();
    const sessions = [...c.sessions, ...i.sessions].filter((s) => !seen.has(s.at) && !!seen.add(s.at)).sort((a, b) => a.at - b.at).slice(-200);
    return { done, sessions };
  }
  return current; // preferências: o que já existe não é sobrescrito
}

export interface Summary {
  songs: number;
  studies: number;
  lessonsDone: number;
  exercises: number;
  reviewItems: number;
  studyDays: number;
  loops: number;
  files: number;
}

export function summarize(keys: Record<string, unknown>, files: number): Summary {
  const lessonsDone = Object.entries(keys).filter(([k, v]) => STUDY_PROGRESS.test(k) && isObj(v) && Array.isArray(v.done) && v.done.length > 0 && v.done.every(Boolean)).length;
  return {
    songs: Array.isArray(keys[KEY_SONGS]) ? (keys[KEY_SONGS] as unknown[]).length : 0,
    studies: Array.isArray(keys[KEY_STUDIES]) ? (keys[KEY_STUDIES] as unknown[]).length : 0,
    lessonsDone,
    exercises: isObj(keys[KEY_STATS]) ? Object.keys(keys[KEY_STATS] as object).length : 0,
    reviewItems: isObj(keys[KEY_SRS]) ? Object.keys(keys[KEY_SRS] as object).length : 0,
    studyDays: isObj(keys[KEY_DAYS]) ? Object.keys(keys[KEY_DAYS] as object).length : 0,
    loops: Array.isArray(keys[KEY_LOOPS]) ? (keys[KEY_LOOPS] as unknown[]).length : 0,
    files,
  };
}

/**
 * Aplica o backup. Calcula tudo antes de gravar e, se a gravação falhar no meio (ex.: armazenamento
 * cheio), devolve as chaves ao estado anterior, para nunca deixar os dados pela metade.
 */
export async function applyBackup(backup: Backup, mode: ImportMode, store: KeyStore): Promise<{ written: string[]; summary: Summary }> {
  const next = new Map<string, string | null>(); // valor novo (null = remover)
  for (const [k, v] of Object.entries(backup.keys)) {
    const cur = readJson(store, k);
    const value = mode === 'replace' ? v : mergeValue(k, cur, v);
    next.set(k, JSON.stringify(value));
  }
  if (mode === 'replace') {
    // loops ficam se o backup não os trouxe (backup sem áudio): substituir nunca apaga gravações por engano
    for (const k of listBackupKeys(store)) if (isDataKey(k) && !(k in backup.keys) && k !== KEY_LOOPS) next.set(k, null);
  }

  // 1) arquivos de áudio (só os que ainda não existem, para não sobrescrever com cópia antiga)
  let restored = 0;
  for (const f of backup.files) {
    if (mode === 'merge' && (await getFile(f.id).catch(() => undefined))) continue;
    await putFile(f.id, base64ToBlob(f.data, f.type));
    restored++;
  }

  // 2) chaves, com retorno ao estado anterior em caso de erro
  const before = new Map<string, string | null>();
  for (const k of next.keys()) before.set(k, store.getItem(k));
  const written: string[] = [];
  try {
    for (const [k, v] of next) {
      if (v === null) store.removeItem(k);
      else store.setItem(k, v);
      written.push(k);
    }
  } catch {
    for (const [k, v] of before) {
      try {
        if (v === null) store.removeItem(k);
        else store.setItem(k, v);
      } catch {
        /* melhor esforço */
      }
    }
    throw new BackupError('Não foi possível gravar: o armazenamento do navegador está cheio. Nada foi alterado.');
  }
  return { written, summary: summarize(backup.keys, restored) };
}

// ---------- apagar tudo ----------

export async function wipeAll(store: KeyStore) {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k?.startsWith('ss.')) keys.push(k);
  }
  keys.forEach((k) => store.removeItem(k));
  for (const id of (await dbKeys('files').catch(() => [])) as string[]) await delFile(id).catch(() => {});
  return keys;
}
