/**
 * Camada de dados do navegador.
 *
 * - Dados pequenos e reativos (configurações, progresso, músicas) ficam em localStorage, que é
 *   síncrono e simples de usar nos componentes (ver storage.ts).
 * - Dados grandes (áudios, loops) ficam em IndexedDB, nesta camada.
 *
 * O banco é versionado: para criar um novo "store", acrescente o nome em STORES e aumente
 * DB_VERSION. O upgrade só cria o que ainda não existe, então nunca apaga dados existentes.
 */

export const DB_NAME = 'songstation'; // nome mantido para não perder os arquivos já salvos
export const DB_VERSION = 2;
export const STORES = ['files', 'kv'] as const;
export type StoreName = (typeof STORES)[number];

let opening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
    };
    req.onsuccess = () => {
      const db = req.result;
      // outra aba pediu upgrade (ou o banco foi apagado): fecha para não travar e reabre na próxima chamada
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      db.onclose = () => {
        opening = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error('Falha ao abrir o IndexedDB'));
    req.onblocked = () => reject(new Error('IndexedDB bloqueado por outra aba aberta'));
  }).catch((e) => {
    opening = null; // permite tentar de novo depois
    throw e;
  });
  return opening;
}

/** Executa uma operação e só resolve quando a transação é confirmada (importante para escritas). */
async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    let result: T;
    const t = db.transaction(store, mode);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error ?? new Error('Falha na transação'));
    t.onabort = () => reject(t.error ?? new Error('Transação cancelada (armazenamento cheio?)'));
    const req = fn(t.objectStore(store));
    req.onsuccess = () => {
      result = req.result;
    };
  });
}

export const dbGet = <T>(store: StoreName, key: string) => run<T | undefined>(store, 'readonly', (s) => s.get(key));
export const dbPut = (store: StoreName, key: string, value: unknown) => run(store, 'readwrite', (s) => s.put(value, key));
export const dbDelete = (store: StoreName, key: string) => run(store, 'readwrite', (s) => s.delete(key));
export const dbKeys = (store: StoreName) => run<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys());

// ---------- Arquivos de áudio das músicas ----------

export const putFile = (id: string, blob: Blob) => dbPut('files', id, blob);
export const getFile = (id: string) => dbGet<Blob>('files', id);
export const delFile = (id: string) => dbDelete('files', id);

// ---------- Persistência e uso do armazenamento ----------

/** Pede ao navegador para não apagar os dados do site quando faltar espaço. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Fecha a conexão (usado em testes). */
export async function closeDb() {
  if (!opening) return;
  const db = await opening.catch(() => null);
  db?.close();
  opening = null;
}
