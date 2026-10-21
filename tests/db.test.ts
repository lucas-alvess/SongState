import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { DB_NAME, DB_VERSION, STORES, closeDb, dbDelete, dbGet, dbKeys, dbPut, delFile, getFile, putFile } from '../src/lib/db';

afterEach(async () => {
  await closeDb();
  indexedDB = new IDBFactory(); // banco limpo a cada teste
});

describe('IndexedDB', () => {
  it('guarda, lê e apaga valores', async () => {
    await dbPut('kv', 'a', { n: 1 });
    expect(await dbGet('kv', 'a')).toEqual({ n: 1 });
    expect(await dbKeys('kv')).toEqual(['a']);
    await dbDelete('kv', 'a');
    expect(await dbGet('kv', 'a')).toBeUndefined();
  });

  it('arquivos: ida e volta de um Blob', async () => {
    await putFile('f1', new Blob(['olá mundo'], { type: 'audio/mpeg' }));
    const blob = await getFile('f1');
    expect(blob).toBeInstanceOf(Blob);
    expect(await blob!.text()).toBe('olá mundo');
    await delFile('f1');
    expect(await getFile('f1')).toBeUndefined();
  });

  it('ler uma chave inexistente não é erro', async () => {
    expect(await getFile('nao-existe')).toBeUndefined();
  });

  it('cria todos os stores', async () => {
    await dbPut('kv', 'x', 1);
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open(DB_NAME);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    expect([...db.objectStoreNames].sort()).toEqual([...STORES].sort());
    expect(db.version).toBe(DB_VERSION);
    db.close();
  });

  it('upgrade da v1 preserva os arquivos já salvos', async () => {
    // simula um navegador com o banco antigo (apenas "files", versão 1)
    await new Promise<void>((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => {
        const t = r.result.transaction('files', 'readwrite');
        t.objectStore('files').put(new Blob(['antigo']), 'velho');
        t.oncomplete = () => {
          r.result.close();
          res();
        };
        t.onerror = () => rej(t.error);
      };
      r.onerror = () => rej(r.error);
    });
    expect(await (await getFile('velho'))!.text()).toBe('antigo');
    await dbPut('kv', 'novo', true); // o store novo existe depois do upgrade
    expect(await dbGet('kv', 'novo')).toBe(true);
  });

  it('volta a funcionar depois que outra aba pede upgrade (versionchange)', async () => {
    await dbPut('kv', 'a', 1);
    // outra "aba" abre uma versão maior: a nossa conexão precisa se fechar sozinha
    await new Promise<void>((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION + 1);
      r.onsuccess = () => {
        r.result.close();
        res();
      };
      r.onerror = () => rej(r.error);
    });
    // reabrir com a versão do app (menor) falha de forma limpa; não pode travar nem estourar sem tratamento
    await expect(dbGet('kv', 'a')).rejects.toBeTruthy();
  });
});
