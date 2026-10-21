/**
 * Uma rodada de sincronização (baixar → mesclar → gravar aqui → enviar), sem depender do navegador:
 * o armazenamento, o Drive e os arquivos de áudio entram por parâmetro, o que permite testar tudo com um Drive falso.
 *
 * Ordem pensada para nunca perder dados:
 *  1. lê a nuvem e baixa os áudios que faltam (qualquer falha aborta antes de mexer em qualquer coisa);
 *  2. mescla e grava neste aparelho de uma vez só (sem nenhum `await` entre ler e gravar);
 *  3. envia os áudios novos e, por último, o arquivo de dados (que nunca cita áudio que não está na nuvem);
 *  4. só então guarda o estado da sincronização (a base para detectar exclusões na próxima vez).
 */
import { SCHEMA_VERSION, isDataKey, type KeyStore } from './backup';
import { DriveError, type DriveApi, type RemoteFile } from './drive';
import { FILE_PREFIX, SNAPSHOT_NAME, SYNC_FORMAT, fileIdsOf, mergeSnapshots, parseSnapshot, sanitizeRemote, stable, type Hashes, type Snapshot, type Tombs } from './sync-core';
import { LOOPS_KEY } from './loops';

export const STATE_KEY = 'ss.sync.state';
export const MAX_FILE_BYTES = 150 * 1024 * 1024;
const ORPHAN_AGE_MS = 24 * 3600 * 1000;

export interface SyncState {
  device: string;
  base: Hashes;
  tombs: Tombs;
  lastSync: number;
}

export interface FileStore {
  ids(): Promise<string[]>;
  get(id: string): Promise<Blob | undefined>;
  put(id: string, blob: Blob): Promise<unknown>;
  del(id: string): Promise<unknown>;
}

export interface SyncDeps {
  store: KeyStore;
  drive: DriveApi;
  files: FileStore;
  audio: boolean;
  now?: () => number;
  /** chamado com as chaves alteradas neste aparelho, para a tela se atualizar */
  onWritten?: (keys: string[]) => void;
}

export interface SyncReport {
  changedLocal: number; // chaves atualizadas aqui
  pushed: boolean; // arquivo de dados enviado
  filesUp: number;
  filesDown: number;
  skipped: string[]; // arquivos grandes demais
}

export const newDevice = () => `d${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

export function readState(store: KeyStore): SyncState {
  try {
    const raw = JSON.parse(store.getItem(STATE_KEY) ?? 'null') as Partial<SyncState> | null;
    if (raw && typeof raw === 'object') {
      return {
        device: typeof raw.device === 'string' && raw.device ? raw.device : newDevice(),
        base: raw.base && typeof raw.base === 'object' ? raw.base : {},
        tombs: raw.tombs && typeof raw.tombs === 'object' ? raw.tombs : {},
        lastSync: typeof raw.lastSync === 'number' ? raw.lastSync : 0,
      };
    }
  } catch {
    /* estado ilegível: recomeça (a mesclagem é segura sem base: só junta) */
  }
  return { device: newDevice(), base: {}, tombs: {}, lastSync: 0 };
}

export const writeState = (store: KeyStore, st: SyncState) => store.setItem(STATE_KEY, JSON.stringify(st));

const readJson = (store: KeyStore, key: string): unknown => {
  try {
    const raw = store.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
};

/** Chaves de dados que entram na sincronização. */
export const wantsKey = (audio: boolean) => (k: string) => isDataKey(k) && (audio || k !== LOOPS_KEY);

function localData(store: KeyStore, wants: (k: string) => boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (!k || !wants(k)) continue;
    const v = readJson(store, k);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const fileName = (id: string) => `${FILE_PREFIX}${id}`;

export async function runSync(deps: SyncDeps): Promise<SyncReport> {
  const { store, drive, files, audio } = deps;
  const now = deps.now ?? Date.now;
  const wants = wantsKey(audio);
  const report: SyncReport = { changedLocal: 0, pushed: false, filesUp: 0, filesDown: 0, skipped: [] };
  const state = readState(store);

  // 1) a nuvem
  const listed = await drive.list();
  const byName = new Map<string, RemoteFile>();
  for (const f of listed) if (!byName.has(f.name)) byName.set(f.name, f);
  const snapFiles = listed.filter((f) => f.name === SNAPSHOT_NAME).sort((a, b) => b.modified - a.modified);

  let remote: Snapshot | null = null;
  const extraSnaps: string[] = [];
  const rawSnaps: Snapshot[] = [];
  for (const f of snapFiles) rawSnaps.push(parseSnapshot(await (await drive.download(f.id)).text()));
  // dois arquivos de dados (dois aparelhos criaram ao mesmo tempo): junta tudo e apaga os extras no fim
  if (rawSnaps.length) {
    remote = rawSnaps[0];
    for (let i = 1; i < rawSnaps.length; i++) {
      const m = mergeSnapshots({ local: rawSnaps[i].keys, remote, base: {}, tombs: rawSnaps[i].tombs, now: now(), wants: () => true });
      remote = { ...remote, keys: m.keys, tombs: m.tombs };
      extraSnaps.push(snapFiles[i].id);
    }
  }

  const localFiles = new Set(await files.ids());
  if (remote && audio) {
    const refs = fileIdsOf(remote.keys, { ...remote.tombs, ...state.tombs });
    for (const id of [...refs.loops, ...refs.songs]) {
      if (localFiles.has(id)) continue;
      const rf = byName.get(fileName(id));
      if (!rf) continue; // a nuvem também não tem: o item é tratado na validação
      if (rf.size > MAX_FILE_BYTES) {
        report.skipped.push(id);
        continue;
      }
      await files.put(id, await drive.download(rf.id));
      localFiles.add(id);
      report.filesDown++;
    }
  }

  // 2) mesclar e gravar aqui — daqui até o fim da gravação não há nenhum await
  const cleanRemote = remote ? sanitizeRemote(remote, localFiles, wants) : null;
  const local = localData(store, wants);
  const result = mergeSnapshots({ local, remote: cleanRemote, base: state.base, tombs: state.tombs, now: now(), wants });

  const before = new Map<string, string | null>();
  const writes = new Map<string, string>();
  for (const k of result.changedLocal) writes.set(k, JSON.stringify(result.keys[k]));
  for (const k of writes.keys()) before.set(k, store.getItem(k));
  try {
    for (const [k, v] of writes) store.setItem(k, v);
  } catch {
    for (const [k, v] of before) {
      try {
        if (v === null) store.removeItem(k);
        else store.setItem(k, v);
      } catch {
        /* melhor esforço */
      }
    }
    throw new DriveError('Não foi possível gravar: o armazenamento do navegador está cheio. Nada foi alterado.', 'other');
  }
  report.changedLocal = writes.size;
  if (writes.size) deps.onWritten?.([...writes.keys()]);

  // áudios que deixaram de ser usados por causa de exclusões vindas da nuvem
  const used = fileIdsOf(result.keys);
  const usedAll = new Set([...used.songs, ...used.loops]);
  const wasUsed = fileIdsOf(local);
  for (const id of [...wasUsed.songs, ...wasUsed.loops]) if (!usedAll.has(id) && localFiles.has(id) && (audio || wasUsed.songs.has(id))) await files.del(id).catch(() => {});

  // 3) enviar
  const remoteNames = new Map(byName);
  if (audio) {
    for (const id of usedAll) {
      if (remoteNames.has(fileName(id))) continue;
      const blob = await files.get(id).catch(() => undefined);
      if (!blob) continue;
      if (blob.size > MAX_FILE_BYTES) {
        report.skipped.push(id);
        continue;
      }
      await drive.upload(fileName(id), blob);
      report.filesUp++;
    }
  }

  if (result.remoteChanged || extraSnaps.length) {
    const snap: Snapshot = { app: 'songstate-sync', format: SYNC_FORMAT, schema: SCHEMA_VERSION, device: state.device, at: now(), keys: result.keys, tombs: result.tombs };
    await drive.upload(SNAPSHOT_NAME, new Blob([JSON.stringify(snap)], { type: 'application/json' }), snapFiles[0]?.id);
    report.pushed = true;
  }
  for (const id of extraSnaps) await drive.remove(id).catch(() => {});

  // áudios da nuvem que ninguém mais usa (só os antigos: um aparelho pode estar no meio de um envio)
  if (audio) {
    for (const f of listed) {
      if (!f.name.startsWith(FILE_PREFIX) || usedAll.has(f.name.slice(FILE_PREFIX.length))) continue;
      if (now() - f.modified > ORPHAN_AGE_MS) await drive.remove(f.id).catch(() => {});
    }
  }

  // 4) tudo certo: guarda a base para a próxima rodada
  writeState(store, { ...state, base: mergeBase(state, result.base, wants), tombs: result.tombs, lastSync: now() });
  return report;
}

/** Mantém a base das chaves que este aparelho não sincroniza (ex.: loops com o áudio desligado). */
function mergeBase(state: SyncState, next: Hashes, wants: (k: string) => boolean): Hashes {
  const out: Hashes = { ...next };
  for (const [k, h] of Object.entries(state.base)) if (!wants(k) && !(k in out)) out[k] = h;
  return out;
}

/** Texto curto de comparação entre dois estados (para saber se algo mudou desde a última sincronização). */
export const fingerprint = (store: KeyStore, audio: boolean) => stable(localData(store, wantsKey(audio)));
