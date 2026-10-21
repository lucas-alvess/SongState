import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type KeyStore } from '../src/lib/backup';
import { DriveError, createDrive, type DriveApi, type RemoteFile } from '../src/lib/drive';
import { SNAPSHOT_NAME, hashOf, mergeList, parseSnapshot, stable, SyncDataError } from '../src/lib/sync-core';
import { readState, runSync, type FileStore } from '../src/lib/sync-engine';

// ---------- aparelhos e Drive de mentira ----------

class MemStore implements KeyStore {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  json(k: string) {
    const v = this.data.get(k);
    return v === undefined ? undefined : JSON.parse(v);
  }
  put(k: string, v: unknown) {
    this.data.set(k, JSON.stringify(v));
  }
}

class FakeDrive implements DriveApi {
  files = new Map<string, { name: string; blob: Blob; modified: number }>();
  n = 0;
  clock = 1_000_000;
  failDownload: string | null = null; // nome do arquivo cujo download falha
  uploads: string[] = [];
  async list(): Promise<RemoteFile[]> {
    return [...this.files].map(([id, f]) => ({ id, name: f.name, size: f.blob.size, modified: f.modified }));
  }
  async download(id: string) {
    const f = this.files.get(id);
    if (!f) throw new DriveError('404', 'other', 404);
    if (this.failDownload && f.name === this.failDownload) throw new DriveError('Sem conexão com o Google.', 'network');
    return f.blob;
  }
  async upload(name: string, blob: Blob, existingId?: string) {
    const id = existingId ?? `id${++this.n}`;
    this.files.set(id, { name, blob, modified: this.clock });
    this.uploads.push(name);
    return id;
  }
  async remove(id: string) {
    this.files.delete(id);
  }
  async snap() {
    const f = [...this.files.values()].find((x) => x.name === SNAPSHOT_NAME);
    return f ? JSON.parse(await f.blob.text()) : null;
  }
}

class Files implements FileStore {
  m = new Map<string, Blob>();
  async ids() {
    return [...this.m.keys()];
  }
  async get(id: string) {
    return this.m.get(id);
  }
  async put(id: string, b: Blob) {
    this.m.set(id, b);
  }
  async del(id: string) {
    this.m.delete(id);
  }
}

class Device {
  store = new MemStore();
  files = new Files();
  written: string[][] = [];
  constructor(
    public drive: FakeDrive,
    public audio = false,
    public t = 2_000_000,
  ) {}
  sync() {
    this.t += 1000;
    return runSync({ store: this.store, drive: this.drive, files: this.files, audio: this.audio, now: () => this.t, onWritten: (k) => this.written.push(k) });
  }
}

const song = (id: string, extra: object = {}) => ({ id, title: `Música ${id}`, artist: 'A', keyPc: 0, minor: false, bpm: 100, tags: [], notes: '', style: 'rock', chart: '', createdAt: 1, sources: [], ...extra });
const loop = (id: string, fileId: string, extra: object = {}) => ({ id, name: `Loop ${id}`, kind: 'loop', bpm: 100, beats: 4, bars: 2, sampleRate: 8000, samples: 800, layers: [{ id: fileId, vol: 1, mute: false }], createdAt: 5, updatedAt: 5, ...extra });
const blob = (s: string) => new Blob([s], { type: 'audio/wav' });

// ---------- mesclagem de listas ----------

describe('mergeList', () => {
  const a = song('a');
  const b = song('b');
  it('une itens novos dos dois lados', () => {
    const m = mergeList([a], [b], {}, {}, 10);
    expect(m.items.map((i) => i.id)).toEqual(['a', 'b']);
  });
  it('item que estava na base e sumiu daqui vira exclusão e some também do outro lado', () => {
    const m = mergeList([], [a, b], { a: hashOf(a), b: hashOf(b) }, {}, 10);
    expect(m.items).toEqual([]);
    expect(Object.keys(m.tombs).sort()).toEqual(['a', 'b']);
  });
  it('exclusão vinda da nuvem remove o item daqui', () => {
    const m = mergeList([a, b], [b], { a: hashOf(a), b: hashOf(b) }, { a: 5 }, 10);
    expect(m.items.map((i) => i.id)).toEqual(['b']);
  });
  it('só mudou na nuvem → vale a nuvem; só mudou aqui → vale o daqui', () => {
    const edited = { ...a, title: 'Novo' };
    expect(mergeList([a], [edited], { a: hashOf(a) }, {}, 1).items[0]).toEqual(edited);
    expect(mergeList([edited], [a], { a: hashOf(a) }, {}, 1).items[0]).toEqual(edited);
  });
  it('mudou nos dois lados → o mais recente; sem data, o deste aparelho', () => {
    const l = loop('x', 'f1', { updatedAt: 50, name: 'daqui' });
    const r = loop('x', 'f1', { updatedAt: 90, name: 'nuvem' });
    expect(mergeList([l], [r], { x: 'velho' }, {}, 1).items[0]).toEqual(r);
    expect(mergeList([{ ...a, title: '1' }], [{ ...a, title: '2' }], { a: 'velho' }, {}, 1).items[0]).toMatchObject({ title: '1' });
  });
  it('item novo aqui com id já excluído (backup restaurado) volta', () => {
    const m = mergeList([a], [], {}, { a: 5 }, 10);
    expect(m.items.map((i) => i.id)).toEqual(['a']);
    expect(m.tombs.a).toBeUndefined();
  });
  it('exclusões antigas (120 dias) são esquecidas', () => {
    const m = mergeList([], [], {}, { velho: 1, novo: 200 * 86400000 }, 201 * 86400000);
    expect(Object.keys(m.tombs)).toEqual(['novo']);
  });
  it('respeita o limite da lista', () => {
    const many = Array.from({ length: 10 }, (_, i) => song(`s${i}`));
    expect(mergeList(many, [], {}, {}, 1, 4).items).toHaveLength(4);
  });
  it('hash não depende da ordem das chaves', () => {
    expect(hashOf({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(hashOf({ b: [1, { d: 3, c: 2 }], a: 1 }));
    expect(hashOf({ a: 1 })).not.toBe(hashOf({ a: 2 }));
  });
});

// ---------- rodadas completas ----------

describe('sincronização entre aparelhos', () => {
  it('primeira rodada envia os dados; a segunda, sem mudanças, não envia nada', async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    a.store.put('ss.songs', [song('a')]);
    a.store.put('ss.stats', { ex1: { attempts: 3, correct: 2, best: 2, last: 100 } });
    const r1 = await a.sync();
    expect(r1.pushed).toBe(true);
    const snap = await drive.snap();
    expect(snap.keys['ss.songs']).toHaveLength(1);
    expect(snap.schema).toBe(SCHEMA_VERSION);

    const before = drive.uploads.length;
    const r2 = await a.sync();
    expect(r2).toMatchObject({ pushed: false, changedLocal: 0 });
    expect(drive.uploads.length).toBe(before);
    const r3 = await a.sync();
    expect(r3.pushed).toBe(false);
  });

  it('um aparelho novo recebe tudo e fica estável', async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    a.store.put('ss.songs', [song('a'), song('b')]);
    a.store.put('ss.study.s1', { done: [true, false], sessions: [] });
    await a.sync();

    const b = new Device(drive);
    const r = await b.sync();
    expect(r.changedLocal).toBe(2);
    expect(b.store.json('ss.songs').map((s: { id: string }) => s.id)).toEqual(['a', 'b']);
    expect(b.store.json('ss.study.s1').done).toEqual([true, false]);
    expect(b.written[0].sort()).toEqual(['ss.songs', 'ss.study.s1']);
    expect((await b.sync()).pushed).toBe(false);
    expect((await a.sync()).changedLocal).toBe(0);
  });

  it('um aparelho vazio e novo NUNCA apaga o que está na nuvem', async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    a.store.put('ss.songs', [song('a')]);
    await a.sync();
    const fresh = new Device(drive);
    await fresh.sync();
    expect((await drive.snap()).keys['ss.songs']).toHaveLength(1);
    expect(fresh.store.json('ss.songs')).toHaveLength(1);
  });

  it('exclusão num aparelho chega ao outro; edição também', async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    const b = new Device(drive);
    a.store.put('ss.songs', [song('a'), song('b')]);
    await a.sync();
    await b.sync();

    b.store.put('ss.songs', [song('b')]); // b exclui "a"
    await b.sync();
    expect((await drive.snap()).tombs['ss.songs']).toHaveProperty('a');

    a.store.put('ss.songs', [song('a'), song('b', { title: 'Editada' })]); // a edita "b" e ainda tem "a"
    await a.sync();
    expect(a.store.json('ss.songs').map((s: { id: string }) => s.id)).toEqual(['b']);
    expect(a.store.json('ss.songs')[0].title).toBe('Editada');

    await b.sync();
    expect(b.store.json('ss.songs')[0].title).toBe('Editada');
  });

  it('itens criados em paralelo nos dois aparelhos ficam nos dois', async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    const b = new Device(drive);
    a.store.put('ss.songs', [song('a')]);
    b.store.put('ss.songs', [song('b')]);
    await a.sync();
    await b.sync();
    await a.sync();
    for (const d of [a, b]) expect(d.store.json('ss.songs').map((s: { id: string }) => s.id).sort()).toEqual(['a', 'b']);
  });

  it('revisão espaçada, dias e estatísticas se unem', async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    const b = new Device(drive);
    const card = (t: number, n: number) => ({ e: 2.5, i: 1, d: 0, r: 1, l: 0, n, t });
    a.store.put('ss.srs', { 'note|standard|2|5': card(100, 1) });
    b.store.put('ss.srs', { 'note|standard|2|5': card(200, 2), 'note|standard|3|5': card(50, 1) });
    a.store.put('ss.days', { '2026-01-01': { n: 5, ok: 4, by: {} } });
    b.store.put('ss.days', { '2026-01-02': { n: 1, ok: 1, by: {} } });
    await a.sync();
    await b.sync();
    await a.sync();
    expect(a.store.json('ss.srs')['note|standard|2|5'].n).toBe(2); // o mais recente vence
    expect(Object.keys(b.store.json('ss.srs'))).toHaveLength(2);
    expect(Object.keys(a.store.json('ss.days')).sort()).toEqual(['2026-01-01', '2026-01-02']);
  });

  it('preferências e chaves secretas nunca vão para a nuvem', async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    a.store.put('ss.songs', [song('a')]);
    a.store.put('ss.settings', { lang: 'latin' });
    a.store.put('ss.integrations', { youtubeKey: 'segredo' });
    a.store.put('ss.spotify.token', { t: 'segredo' });
    a.store.put('ss.sync.cfg', { email: 'x@y.z' });
    await a.sync();
    const text = JSON.stringify(await drive.snap());
    expect(text).not.toContain('segredo');
    expect(Object.keys((await drive.snap()).keys)).toEqual(['ss.songs']);
  });

  it('estado da sincronização fica salvo só depois do sucesso', async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    a.store.put('ss.songs', [song('a')]);
    expect(readState(a.store).lastSync).toBe(0);
    await a.sync();
    const st = readState(a.store);
    expect(st.lastSync).toBeGreaterThan(0);
    expect(st.base['ss.songs']).toHaveProperty('a');
    expect(st.device).toMatch(/^d/);
  });

  it('dados da nuvem de versão mais nova são recusados sem tocar em nada', async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    a.store.put('ss.songs', [song('a')]);
    await a.sync();
    const snap = await drive.snap();
    snap.schema = SCHEMA_VERSION + 1;
    for (const f of drive.files.values()) if (f.name === SNAPSHOT_NAME) f.blob = blob(JSON.stringify(snap));
    const b = new Device(drive);
    b.store.put('ss.songs', [song('z')]);
    await expect(b.sync()).rejects.toBeInstanceOf(SyncDataError);
    expect(b.store.json('ss.songs')).toHaveLength(1);
  });

  it('conteúdo malformado da nuvem é descartado e não vira script nem link perigoso', async () => {
    const drive = new FakeDrive();
    const snap = { app: 'songstate-sync', format: 1, schema: SCHEMA_VERSION, device: 'x', at: 1, tombs: {}, keys: { 'ss.songs': [song('ok'), { id: 'ruim' }, song('link', { sources: [{ id: 's', kind: 'link', url: 'javascript:alert(1)' }] })], 'ss.settings': { evil: 1 }, 'ss.integrations': { youtubeKey: 'x' } } };
    drive.files.set('i1', { name: SNAPSHOT_NAME, blob: blob(JSON.stringify(snap)), modified: 1 });
    const a = new Device(drive);
    await a.sync();
    const songs = a.store.json('ss.songs');
    expect(songs.map((s: { id: string }) => s.id)).toEqual(['ok', 'link']);
    expect(songs[1].sources).toEqual([]);
    expect(a.store.json('ss.settings')).toBeUndefined();
    expect(a.store.json('ss.integrations')).toBeUndefined();
  });

  it('arquivos de dados duplicados (criados ao mesmo tempo) são unidos e o extra é apagado', async () => {
    const drive = new FakeDrive();
    const mk = (songs: unknown[], modified: number) => ({ name: SNAPSHOT_NAME, modified, blob: blob(JSON.stringify({ app: 'songstate-sync', format: 1, schema: SCHEMA_VERSION, device: 'x', at: 1, tombs: {}, keys: { 'ss.songs': songs } })) });
    drive.files.set('i1', mk([song('a')], 10));
    drive.files.set('i2', mk([song('b')], 20));
    const a = new Device(drive);
    await a.sync();
    expect(a.store.json('ss.songs').map((s: { id: string }) => s.id).sort()).toEqual(['a', 'b']);
    expect([...drive.files.values()].filter((f) => f.name === SNAPSHOT_NAME)).toHaveLength(1);
    expect((await drive.snap()).keys['ss.songs']).toHaveLength(2);
  });

  it('gravação local cheia desfaz tudo e avisa', async () => {
    const drive = new FakeDrive();
    const a = new Device(drive);
    a.store.put('ss.songs', [song('a')]);
    a.store.put('ss.days', { '2026-01-01': { n: 1, ok: 1, by: {} } });
    await a.sync();
    const b = new Device(drive);
    b.store.put('ss.stats', { x: { attempts: 1, correct: 1, best: 1, last: 5 } });
    let n = 0;
    const orig = b.store.setItem.bind(b.store);
    b.store.setItem = (k: string, v: string) => {
      if (++n === 2) throw new Error('QuotaExceededError');
      orig(k, v);
    };
    await expect(b.sync()).rejects.toThrow(/cheio/);
    expect(b.store.json('ss.songs')).toBeUndefined();
  });
});

describe('áudios e loops', () => {
  it('com áudio ligado, loops e arquivos viajam; um aparelho novo toca o que recebeu', async () => {
    const drive = new FakeDrive();
    const a = new Device(drive, true);
    a.files.m.set('lp-1', blob('AUDIO1'));
    a.store.put('ss.loops', [loop('l1', 'lp-1')]);
    const r = await a.sync();
    expect(r.filesUp).toBe(1);
    expect([...drive.files.values()].some((f) => f.name === 'f-lp-1')).toBe(true);

    const b = new Device(drive, true);
    const rb = await b.sync();
    expect(rb.filesDown).toBe(1);
    expect(await b.files.m.get('lp-1')!.text()).toBe('AUDIO1');
    expect(b.store.json('ss.loops')).toHaveLength(1);
    expect((await b.sync()).filesUp).toBe(0);
  });

  it('excluir o loop remove o arquivo daqui e (depois de 1 dia) da nuvem', async () => {
    const drive = new FakeDrive();
    const a = new Device(drive, true);
    const b = new Device(drive, true);
    a.files.m.set('lp-1', blob('AUDIO1'));
    a.store.put('ss.loops', [loop('l1', 'lp-1')]);
    await a.sync();
    await b.sync();
    a.store.put('ss.loops', []);
    a.files.m.delete('lp-1');
    await a.sync();
    expect([...drive.files.values()].some((f) => f.name === 'f-lp-1')).toBe(true); // ainda recente: não apaga
    drive.clock += 2 * 86400000;
    for (const f of drive.files.values()) if (f.name === 'f-lp-1') f.modified = 1;
    a.t = 10 * 86400000;
    await a.sync();
    expect([...drive.files.values()].some((f) => f.name === 'f-lp-1')).toBe(false);
    b.t = 10 * 86400000;
    await b.sync();
    expect(b.store.json('ss.loops')).toEqual([]);
    expect(b.files.m.has('lp-1')).toBe(false); // o áudio órfão também sai daqui
  });

  it('falha ao baixar um áudio aborta antes de mexer nos dados locais e na nuvem', async () => {
    const drive = new FakeDrive();
    const a = new Device(drive, true);
    a.files.m.set('lp-1', blob('AUDIO1'));
    a.store.put('ss.loops', [loop('l1', 'lp-1')]);
    await a.sync();
    const b = new Device(drive, true);
    b.store.put('ss.songs', [song('s')]);
    drive.failDownload = 'f-lp-1';
    await expect(b.sync()).rejects.toBeInstanceOf(DriveError);
    expect(b.store.json('ss.loops')).toBeUndefined();
    expect((await drive.snap()).keys['ss.loops']).toHaveLength(1);
    drive.failDownload = null;
    await b.sync();
    expect(b.store.json('ss.loops')).toHaveLength(1);
  });

  it('com áudio desligado, os loops locais e os da nuvem ficam como estão', async () => {
    const drive = new FakeDrive();
    const a = new Device(drive, true);
    a.files.m.set('lp-1', blob('AUDIO1'));
    a.store.put('ss.loops', [loop('l1', 'lp-1')]);
    a.store.put('ss.songs', [song('s')]);
    await a.sync();

    const b = new Device(drive, false);
    b.store.put('ss.songs', [song('t')]);
    await b.sync();
    expect(b.store.json('ss.loops')).toBeUndefined();
    const snap = await drive.snap();
    expect(snap.keys['ss.loops']).toHaveLength(1); // preservado
    expect(snap.keys['ss.songs']).toHaveLength(2);
    expect([...drive.files.values()].some((f) => f.name === 'f-lp-1')).toBe(true);
  });

  it('música com arquivo de áudio mantém a referência mesmo sem o áudio aqui', async () => {
    const drive = new FakeDrive();
    const a = new Device(drive, false);
    a.store.put('ss.songs', [song('s', { sources: [{ id: 'x', kind: 'file', label: 'faixa', fileId: 'file-1' }] })]);
    await a.sync();
    const b = new Device(drive, false);
    await b.sync();
    expect(b.store.json('ss.songs')[0].sources[0].fileId).toBe('file-1');
    await b.sync();
    expect((await drive.snap()).keys['ss.songs'][0].sources[0].fileId).toBe('file-1');
  });

  it('música com áudio sincronizado leva o arquivo junto quando o áudio está ligado', async () => {
    const drive = new FakeDrive();
    const a = new Device(drive, true);
    a.files.m.set('file-1', blob('MP3'));
    a.store.put('ss.songs', [song('s', { sources: [{ id: 'x', kind: 'file', label: 'faixa', fileId: 'file-1' }] })]);
    await a.sync();
    const b = new Device(drive, true);
    await b.sync();
    expect(await b.files.m.get('file-1')!.text()).toBe('MP3');
  });
});

describe('parseSnapshot', () => {
  it('recusa lixo e valida exclusões', () => {
    expect(() => parseSnapshot('{')).toThrow(SyncDataError);
    expect(() => parseSnapshot('{"app":"x"}')).toThrow(SyncDataError);
    const s = parseSnapshot(JSON.stringify({ app: 'songstate-sync', format: 1, keys: {}, tombs: { 'ss.songs': { a: 5, 'ruim id': 1, b: 'x' }, 'ss.stats': { a: 1 } } }));
    expect(s.tombs).toEqual({ 'ss.songs': { a: 5 } });
  });
  it('stable ordena as chaves', () => {
    expect(stable({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
  });
});

// ---------- cliente do Drive ----------

describe('cliente do Drive', () => {
  const res = (body: unknown, init: ResponseInit = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200, ...init });
  const noSleep = async () => {};

  it('lista com paginação e envia o token', async () => {
    const calls: { url: string; auth: string }[] = [];
    const pages = [{ files: [{ id: '1', name: 'a', size: '10', modifiedTime: '2026-01-01T00:00:00Z' }], nextPageToken: 'p2' }, { files: [{ id: '2', name: 'b' }] }];
    const f = (async (url: string, init: RequestInit) => {
      calls.push({ url, auth: (init.headers as Record<string, string>).Authorization });
      return res(pages.shift());
    }) as unknown as typeof fetch;
    const files = await createDrive(() => 'TOK', f, noSleep).list();
    expect(files.map((x) => [x.id, x.size])).toEqual([['1', 10], ['2', 0]]);
    expect(calls[0].url).toContain('spaces=appDataFolder');
    expect(calls[1].url).toContain('pageToken=p2');
    expect(calls.every((c) => c.auth === 'Bearer TOK')).toBe(true);
  });

  it('envio em duas etapas (sessão + conteúdo), criando na pasta do app', async () => {
    const seen: { url: string; method?: string; body?: unknown }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      seen.push({ url, method: init.method, body: init.body });
      return url.includes('uploadType=resumable') ? res({}, { headers: { Location: 'https://up.example/sess' } }) : res({ id: 'novo' });
    }) as unknown as typeof fetch;
    const id = await createDrive(() => 'T', f, noSleep).upload('f-x', blob('abc'));
    expect(id).toBe('novo');
    expect(seen[0].method).toBe('POST');
    expect(JSON.parse(seen[0].body as string)).toEqual({ name: 'f-x', parents: ['appDataFolder'] });
    expect(seen[1]).toMatchObject({ url: 'https://up.example/sess', method: 'PUT' });
  });

  it('atualizar usa PATCH no id existente', async () => {
    const urls: string[] = [];
    const f = (async (url: string, init: RequestInit) => {
      urls.push(`${init.method} ${url}`);
      return url.includes('resumable') ? res({}, { headers: { Location: 'https://up.example/s' } }) : res({ id: 'abc' });
    }) as unknown as typeof fetch;
    await createDrive(() => 'T', f, noSleep).upload('n', blob('x'), 'abc');
    expect(urls[0]).toMatch(/^PATCH .*\/abc\?uploadType=resumable/);
  });

  it('classifica os erros: sessão, espaço, rede e demais', async () => {
    const kind = async (r: () => Response | Promise<Response>) => {
      const f = (async () => r()) as unknown as typeof fetch;
      try {
        await createDrive(() => 'T', f, noSleep).list();
      } catch (e) {
        return (e as DriveError).kind;
      }
      return 'ok';
    };
    expect(await kind(() => res({}, { status: 401 }))).toBe('auth');
    expect(await kind(() => res({ error: { errors: [{ reason: 'storageQuotaExceeded' }] } }, { status: 403 }))).toBe('quota');
    expect(await kind(() => res({ error: { errors: [{ reason: 'insufficientPermissions' }] } }, { status: 403 }))).toBe('auth');
    expect(await kind(() => res({}, { status: 404 }))).toBe('other');
    expect(await kind(() => Promise.reject(new TypeError('Failed to fetch')))).toBe('network');
    expect(await createDrive(() => null, (() => res({})) as unknown as typeof fetch, noSleep).list().catch((e: DriveError) => e.kind)).toBe('auth');
  });

  it('tenta de novo em 429/5xx e desiste depois de 3 tentativas', async () => {
    let n = 0;
    const flaky = (async () => (++n < 3 ? res({}, { status: 503 }) : res({ files: [] }))) as unknown as typeof fetch;
    expect(await createDrive(() => 'T', flaky, noSleep).list()).toEqual([]);
    expect(n).toBe(3);
    n = 0;
    const down = (async () => (n++, res({}, { status: 500 }))) as unknown as typeof fetch;
    await expect(createDrive(() => 'T', down, noSleep).list()).rejects.toBeInstanceOf(DriveError);
    expect(n).toBe(3);
  });

  it('excluir um arquivo que já não existe não é erro', async () => {
    const f = (async () => res({}, { status: 404 })) as unknown as typeof fetch;
    await expect(createDrive(() => 'T', f, noSleep).remove('x')).resolves.toBeUndefined();
  });
});

describe('chaves da sincronização', () => {
  it('estado e configuração do login nunca entram em backups', async () => {
    const { isBackupKey, isSecretKey } = await import('../src/lib/backup');
    expect(isBackupKey('ss.sync.cfg')).toBe(false);
    expect(isBackupKey('ss.sync.state')).toBe(false);
    expect(isSecretKey('ss.integrations')).toBe(true);
  });
});
