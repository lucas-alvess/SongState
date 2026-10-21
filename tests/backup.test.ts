import 'fake-indexeddb/auto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BackupError, LAST_BACKUP_KEY, applyBackup, createBackup, isBackupKey, isSecretKey, mergeValue, parseBackup, referencedFileIds, wipeAll, type KeyStore } from '../src/lib/backup';
import { closeDb, getFile, putFile } from '../src/lib/db';

class MemStore implements KeyStore {
  data = new Map<string, string>();
  failOnWrite = -1; // simula armazenamento cheio em uma gravação específica (as seguintes funcionam)
  private writes = 0;
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
    if (this.writes++ === this.failOnWrite) throw new Error('QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const song = (id: string, extra: object = {}) => ({ id, title: `Música ${id}`, artist: 'A', keyPc: 0, minor: false, bpm: 100, tags: [], notes: '', createdAt: 1, sources: [], ...extra });
const text = async (blob: Blob) => blob.text();

afterEach(async () => {
  await closeDb();
  indexedDB = new IDBFactory();
});

describe('exportar', () => {
  it('inclui dados e preferências, e nunca segredos nem chaves desconhecidas', async () => {
    const s = new MemStore();
    s.setItem('ss.songs', JSON.stringify([song('a')]));
    s.setItem('ss.stats', JSON.stringify({ 'note-name': { attempts: 1, correct: 1, best: 1, last: 5 } }));
    s.setItem('ss.settings', JSON.stringify({ lang: 'latin' }));
    s.setItem('ss.cfg.note-find', JSON.stringify({ a: 1 }));
    s.setItem('ss.integrations', JSON.stringify({ youtubeKey: 'SEGREDO', spotifyClientId: 'x' }));
    s.setItem('ss.spotify.tokens', JSON.stringify({ access: 'TOKEN' }));
    s.setItem('ss.schema', '1');
    s.setItem(LAST_BACKUP_KEY, '123');
    s.setItem('outra.coisa', '1');
    const { blob, counts } = await createBackup(s, { files: false });
    const out = await text(blob);
    expect(out).not.toContain('SEGREDO');
    expect(out).not.toContain('TOKEN');
    const parsed = JSON.parse(out);
    expect(Object.keys(parsed.keys).sort()).toEqual(['ss.cfg.note-find', 'ss.settings', 'ss.songs', 'ss.stats']);
    expect(counts).toMatchObject({ songs: 1, exercises: 1 });
  });

  it('chaves com JSON corrompido são ignoradas sem quebrar', async () => {
    const s = new MemStore();
    s.setItem('ss.songs', '{quebrado');
    s.setItem('ss.stats', '{}');
    const { blob } = await createBackup(s, { files: false });
    expect(Object.keys(JSON.parse(await text(blob)).keys)).toEqual(['ss.stats']);
  });
});

describe('ida e volta', () => {
  it('restaura músicas, progresso e o arquivo de áudio em outro navegador', async () => {
    await putFile('f1', new Blob(['audio-bytes'], { type: 'audio/mpeg' }));
    const a = new MemStore();
    a.setItem('ss.songs', JSON.stringify([song('a', { sources: [{ id: 's1', kind: 'file', label: 'x.mp3', fileId: 'f1' }] })]));
    a.setItem('ss.study.intro', JSON.stringify({ done: [true, true], sessions: [{ at: 1, bpm: 60 }] }));
    const { blob } = await createBackup(a, { files: true });

    indexedDB = new IDBFactory(); // "outro navegador": banco vazio
    await closeDb();
    const b = new MemStore();
    const backup = parseBackup(await text(blob));
    const { written, summary } = await applyBackup(backup, 'merge', b);
    expect(written.sort()).toEqual(['ss.songs', 'ss.study.intro']);
    expect(summary).toMatchObject({ songs: 1, files: 1, lessonsDone: 1 });
    const songs = JSON.parse(b.getItem('ss.songs')!);
    expect(songs[0].sources[0]).toMatchObject({ kind: 'file', fileId: 'f1' });
    expect(await (await getFile('f1'))!.text()).toBe('audio-bytes');
  });

  it('sem a opção de arquivos, a música volta sem a fonte de áudio local', async () => {
    const a = new MemStore();
    a.setItem('ss.songs', JSON.stringify([song('a', { sources: [{ id: 's1', kind: 'file', label: 'x.mp3', fileId: 'f1' }] })]));
    const { blob } = await createBackup(a, { files: false });
    const backup = parseBackup(await text(blob));
    expect((backup.keys['ss.songs'] as { sources: unknown[] }[])[0].sources).toEqual([]);
  });
});

describe('mesclar x substituir', () => {
  it('mesclar: une músicas e estudos por id e mantém o que já existe', () => {
    expect(mergeValue('ss.songs', [{ id: 'a', title: 'minha' }], [{ id: 'a', title: 'do backup' }, { id: 'b' }])).toEqual([{ id: 'a', title: 'minha' }, { id: 'b' }]);
    expect(mergeValue('ss.studies', undefined, [{ id: 'x' }])).toEqual([{ id: 'x' }]);
  });

  it('mesclar: estatísticas ficam com o registro mais recente de cada exercício', () => {
    const cur = { a: { attempts: 5, last: 10 }, b: { attempts: 1, last: 1 } };
    const inc = { a: { attempts: 2, last: 5 }, b: { attempts: 9, last: 9 }, c: { attempts: 1, last: 1 } };
    expect(mergeValue('ss.stats', cur, inc)).toEqual({ a: cur.a, b: inc.b, c: inc.c });
  });

  it('mesclar: progresso de lição combina passos feitos e sessões sem duplicar', () => {
    const merged = mergeValue('ss.study.x', { done: [true, false, false], sessions: [{ at: 1, bpm: 60 }] }, { done: [false, true], sessions: [{ at: 1, bpm: 60 }, { at: 2, bpm: 70 }] }) as { done: boolean[]; sessions: unknown[] };
    expect(merged.done).toEqual([true, true, false]);
    expect(merged.sessions).toHaveLength(2);
  });

  it('mesclar não sobrescreve preferências existentes; substituir sobrescreve', async () => {
    const backup = parseBackup(JSON.stringify({ app: 'songstate', format: 1, schema: 1, keys: { 'ss.settings': { lang: 'latin' } }, files: [] }));
    const s = new MemStore();
    s.setItem('ss.settings', JSON.stringify({ lang: 'letters' }));
    await applyBackup(backup, 'merge', s);
    expect(JSON.parse(s.getItem('ss.settings')!).lang).toBe('letters');
    await applyBackup(backup, 'replace', s);
    expect(JSON.parse(s.getItem('ss.settings')!).lang).toBe('latin');
  });

  it('substituir remove dados que não estão no backup, mas preserva segredos e preferências', async () => {
    const s = new MemStore();
    s.setItem('ss.songs', JSON.stringify([song('velha')]));
    s.setItem('ss.study.antiga', JSON.stringify({ done: [true], sessions: [] }));
    s.setItem('ss.integrations', JSON.stringify({ youtubeKey: 'K' }));
    s.setItem('ss.board', JSON.stringify({ root: 1 }));
    const backup = parseBackup(JSON.stringify({ app: 'songstate', format: 1, schema: 1, keys: { 'ss.songs': [song('nova')] }, files: [] }));
    await applyBackup(backup, 'replace', s);
    expect(JSON.parse(s.getItem('ss.songs')!).map((x: { id: string }) => x.id)).toEqual(['nova']);
    expect(s.getItem('ss.study.antiga')).toBeNull();
    expect(s.getItem('ss.integrations')).toContain('K');
    expect(s.getItem('ss.board')).not.toBeNull();
  });

  it('se o armazenamento enche no meio, volta tudo ao estado anterior', async () => {
    const s = new MemStore();
    s.setItem('ss.songs', JSON.stringify([song('original')]));
    s.setItem('ss.stats', JSON.stringify({}));
    s.failOnWrite = 4; // as 2 escritas acima já contaram; falha na 3ª gravação do backup (a 5ª no total)
    const backup = parseBackup(JSON.stringify({ app: 'songstate', format: 1, schema: 1, keys: { 'ss.songs': [song('novo')], 'ss.stats': { a: { attempts: 1, correct: 1, best: 1, last: 1 } }, 'ss.settings': { lang: 'latin' } }, files: [] }));
    await expect(applyBackup(backup, 'replace', s)).rejects.toBeInstanceOf(BackupError);
    expect(JSON.parse(s.getItem('ss.songs')!)[0].id).toBe('original');
    expect(s.getItem('ss.stats')).toBe('{}');
    expect(s.getItem('ss.settings')).toBeNull();
  });
});

describe('importar arquivo malicioso ou inválido', () => {
  it('recusa o que não é backup do SongState', () => {
    expect(() => parseBackup('não é json')).toThrow(BackupError);
    expect(() => parseBackup('[]')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ app: 'outro', format: 1, keys: {} }))).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ app: 'songstate', format: 99, keys: {} }))).toThrow(/mais nova/);
    expect(() => parseBackup(JSON.stringify({ app: 'songstate', format: 1, schema: 99, keys: {} }))).toThrow(/mais nova/);
    expect(() => parseBackup(JSON.stringify({ app: 'songstate', format: 1 }))).toThrow(BackupError);
  });

  it('ignora segredos e chaves fora da lista, mesmo que estejam no arquivo', () => {
    const b = parseBackup(JSON.stringify({ app: 'songstate', format: 1, schema: 1, files: [], keys: { 'ss.integrations': { youtubeKey: 'X' }, 'ss.spotify.tokens': { a: 1 }, 'ss.schema': 99, 'localStorage': 1, 'ss.hacker': {}, 'ss.stats': {} } }));
    expect(Object.keys(b.keys)).toEqual(['ss.stats']);
  });

  it('músicas importadas passam pelo sanitize (javascript:, arquivo sem o áudio, campos extras)', () => {
    const b = parseBackup(
      JSON.stringify({
        app: 'songstate',
        format: 1,
        schema: 1,
        files: [],
        keys: { 'ss.songs': [song('m', { evil: '<script>', sources: [{ url: 'javascript:alert(1)' }, { kind: 'file', fileId: 'nao-veio', label: 'x' }] })] },
      }),
    );
    const [s] = b.keys['ss.songs'] as { sources: unknown[]; evil?: string }[];
    expect(s.sources).toEqual([]);
    expect(s).not.toHaveProperty('evil');
  });

  it('estudos próprios inválidos são descartados e os válidos são normalizados', () => {
    const ok = { id: 'custom-abc1', title: 'Meu estudo', desc: 'd', bpm: 9999, steps: ['a', '', 'b'], board: { root: 40, scaleId: 'minor-pent', pos: 0, fretMax: 17, label: 'note' } };
    const bad = [{ id: 'custom-x', title: 't', board: { scaleId: 'nao-existe' } }, { id: 'sem-prefixo', title: 't', board: { scaleId: 'major' } }, { id: 'custom-y', title: '', board: { scaleId: 'major' } }, 'texto', null];
    const b = parseBackup(JSON.stringify({ app: 'songstate', format: 1, schema: 1, files: [], keys: { 'ss.studies': [ok, ...bad] } }));
    const out = b.keys['ss.studies'] as { id: string; bpm: number; steps: string[]; board: { root: number } }[];
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'custom-abc1', bpm: 240, steps: ['a', 'b'] });
    expect(out[0].board.root).toBe(11);
  });

  it('estatísticas e progresso com tipos errados são normalizados', () => {
    const b = parseBackup(JSON.stringify({ app: 'songstate', format: 1, schema: 1, files: [], keys: { 'ss.stats': { 'ok': { attempts: '9', correct: -4, best: 2, last: 7 }, 'a b': {}, 'x': 5 }, 'ss.study.l1': { done: ['sim', true, 0], sessions: [{ at: 'x', bpm: 70 }, 3] } } }));
    expect(b.keys['ss.stats']).toEqual({ ok: { attempts: 0, correct: 0, best: 2, last: 7 } });
    expect(b.keys['ss.study.l1']).toEqual({ done: [false, true, false], sessions: [{ at: 0, bpm: 70 }] });
  });

  it('ignora arquivos de áudio com id ou conteúdo fora do padrão', () => {
    const b = parseBackup(JSON.stringify({ app: 'songstate', format: 1, schema: 1, keys: {}, files: [{ id: '../x', type: 'audio/mpeg', data: 'AAAA' }, { id: 'ok', type: 'text/html', data: 'AAAA' }, { id: 'ruim', type: 'audio/mpeg', data: '<script>' }] }));
    expect(b.files.map((f) => f.id)).toEqual(['ok']);
    expect(b.files[0].type).toBe('audio/mpeg'); // tipo estranho vira áudio genérico
  });
});

describe('Treino: revisão espaçada e resumo diário', () => {
  const st = (o: object = {}) => ({ e: 2.5, i: 1, d: 100, r: 1, l: 0, n: 1, t: 10, ...o });

  it('entram no backup e voltam iguais', async () => {
    const s = new MemStore();
    s.setItem('ss.srs', JSON.stringify({ 'note|standard|0|3': st() }));
    s.setItem('ss.days', JSON.stringify({ '2026-06-10': { n: 4, ok: 3, by: { note: [4, 3] } } }));
    s.setItem('ss.treino', JSON.stringify({ size: 12, cats: ['notas'] }));
    const { blob, counts } = await createBackup(s, { files: false });
    expect(counts).toMatchObject({ reviewItems: 1, studyDays: 1 });
    const b = parseBackup(await text(blob));
    expect(b.keys['ss.srs']).toEqual({ 'note|standard|0|3': st() });
    expect(Object.keys(b.keys)).toContain('ss.treino');
  });

  it('valores fora da faixa e ids estranhos são corrigidos ou descartados', () => {
    const b = parseBackup(
      JSON.stringify({
        app: 'songstate',
        format: 1,
        schema: 1,
        files: [],
        keys: {
          'ss.srs': { 'note|standard|0|3': st({ e: 99, i: -4, d: 'x', l: 1e12 }), '<script>': st(), 'sem-barra': st(), 'chord|0|maj': 5 },
          'ss.days': { '2026-06-10': { n: -3, ok: 'a', by: { 'tipo ruim!': [1, 1], note: [2, 'x'] } }, 'ontem': { n: 1 } },
        },
      }),
    );
    const srs = b.keys['ss.srs'] as Record<string, { e: number; i: number; d: number }>;
    expect(Object.keys(srs)).toEqual(['note|standard|0|3']);
    expect(srs['note|standard|0|3']).toMatchObject({ e: 3, i: 0, d: 0 });
    expect(b.keys['ss.days']).toEqual({ '2026-06-10': { n: 0, ok: 0, by: { note: [2, 0] } } });
  });

  it('tempo ativo por dia e por seção entra no backup, com limites', () => {
    const b = parseBackup(JSON.stringify({ app: 'songstate', format: 1, schema: 1, files: [], keys: { 'ss.days': { '2026-06-10': { n: 1, ok: 1, by: {}, ms: 999999999999, pg: { braco: 5000, 'sec ruim!': 1, estudos: -5 } }, '2026-06-11': { n: 0, ok: 0, by: {}, ms: 'x', pg: 7 } }, 'ss.goal': { unit: 'min', weekly: 120 } } }));
    expect(b.keys['ss.days']).toEqual({ '2026-06-10': { n: 1, ok: 1, by: {}, ms: 86400000, pg: { braco: 5000, estudos: 0 } }, '2026-06-11': { n: 0, ok: 0, by: {} } });
    expect(b.keys['ss.goal']).toEqual({ unit: 'min', weekly: 120 });
  });

  it('mesclar dias: fica o registro mais completo (mais tempo/respostas)', () => {
    const d = mergeValue('ss.days', { a: { n: 1, ok: 1, by: {}, ms: 600000 }, b: { n: 5, ok: 5, by: {} } }, { a: { n: 9, ok: 9, by: {}, ms: 1000 }, b: { n: 2, ok: 2, by: {}, ms: 3600000 } }) as Record<string, { n: number }>;
    expect([d.a.n, d.b.n]).toEqual([1, 2]); // a: o atual tem mais tempo; b: o do backup tem mais tempo
  });

  it('mesclar: vale o registro mais recente de cada item e o dia com mais respostas', () => {
    const cur = { a: st({ t: 50, i: 7 }), b: st({ t: 5 }) };
    const inc = { a: st({ t: 10, i: 1 }), b: st({ t: 90, i: 9 }), c: st() };
    const m = mergeValue('ss.srs', cur, inc) as Record<string, { i: number }>;
    expect([m.a.i, m.b.i, Object.keys(m).length]).toEqual([7, 9, 3]);
    const d = mergeValue('ss.days', { x: { n: 5, ok: 1, by: {} }, y: { n: 1, ok: 1, by: {} } }, { x: { n: 2, ok: 2, by: {} }, y: { n: 9, ok: 9, by: {} } }) as Record<string, { n: number }>;
    expect([d.x.n, d.y.n]).toEqual([5, 9]);
  });
});

describe('loops e gravações no backup', () => {
  const loop = (id: string, file: string) => ({ id, name: 'Riff', kind: 'loop', bpm: 100, beats: 4, bars: 2, sampleRate: 8000, samples: 100, layers: [{ id: file, vol: 1, mute: false }], createdAt: 1, updatedAt: 1 });

  it('sem "incluir áudio" a lista de loops não entra no backup', async () => {
    const s = new MemStore();
    s.setItem('ss.loops', JSON.stringify([loop('l1', 'lp-aaa')]));
    s.setItem('ss.stats', '{}');
    const { blob } = await createBackup(s, { files: false });
    expect(Object.keys(JSON.parse(await text(blob)).keys)).toEqual(['ss.stats']);
  });

  it('com áudio: ida e volta restaura a lista e o arquivo', async () => {
    await putFile('lp-aaa', new Blob(['wav-bytes'], { type: 'audio/wav' }));
    const a = new MemStore();
    a.setItem('ss.loops', JSON.stringify([loop('l1', 'lp-aaa')]));
    const { blob, counts } = await createBackup(a, { files: true });
    expect(counts).toMatchObject({ loops: 1, files: 1 });
    indexedDB = new IDBFactory();
    await closeDb();
    const b = new MemStore();
    const { summary } = await applyBackup(parseBackup(await text(blob)), 'merge', b);
    expect(summary.loops).toBe(1);
    expect(JSON.parse(b.getItem('ss.loops')!)[0].layers[0].id).toBe('lp-aaa');
    expect(await (await getFile('lp-aaa'))!.text()).toBe('wav-bytes');
  });

  it('loops cujo áudio não veio no arquivo são descartados na importação', () => {
    const b = parseBackup(JSON.stringify({ app: 'songstate', format: 1, schema: 1, files: [], keys: { 'ss.loops': [loop('l1', 'lp-aaa')] } }));
    expect(b.keys['ss.loops']).toBeUndefined();
  });

  it('substituir com um backup sem loops NÃO apaga os loops que já existem', async () => {
    const s = new MemStore();
    s.setItem('ss.loops', JSON.stringify([loop('l1', 'lp-aaa')]));
    s.setItem('ss.songs', JSON.stringify([song('velha')]));
    const backup = parseBackup(JSON.stringify({ app: 'songstate', format: 1, schema: 1, files: [], keys: { 'ss.stats': {} } }));
    await applyBackup(backup, 'replace', s);
    expect(s.getItem('ss.loops')).not.toBeNull();
    expect(s.getItem('ss.songs')).toBeNull(); // os outros dados seguem a regra de substituir
  });

  it('o áudio dos loops conta como arquivo referenciado (entra na estimativa de tamanho)', () => {
    const s = new MemStore();
    s.setItem('ss.loops', JSON.stringify([loop('l1', 'lp-aaa'), loop('l2', 'lp-bbb')]));
    expect(referencedFileIds(s).sort()).toEqual(['lp-aaa', 'lp-bbb']);
  });
});

describe('apagar tudo', () => {
  it('remove as chaves ss.* (inclusive segredos) e os arquivos, e preserva o resto', async () => {
    await putFile('f1', new Blob(['x']));
    const s = new MemStore();
    s.setItem('ss.songs', '[]');
    s.setItem('ss.integrations', '{}');
    s.setItem('outra', '1');
    await wipeAll(s);
    expect([...s.data.keys()]).toEqual(['outra']);
    expect(await getFile('f1')).toBeUndefined();
  });
});

describe('cobertura das chaves do app', () => {
  /** Toda chave "ss.*" usada no código precisa estar decidida: entra no backup, é segredo ou é só local. */
  const LOCAL_ONLY = new Set(['ss.schema', LAST_BACKUP_KEY, 'ss.sync.cfg', 'ss.sync.state']); // login e estado da sincronização pertencem a cada aparelho
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : /\.(ts|tsx)$/.test(f) ? [join(dir, f)] : []));

  it('nenhuma chave nova fica de fora sem ninguém decidir', () => {
    const found = new Set<string>();
    for (const f of files('src')) for (const m of readFileSync(f, 'utf8').matchAll(/['"`](ss\.[\w.$-]*[\w])['"`]/g)) found.add(m[1]);
    const undecided = [...found].filter((k) => !k.includes('$') && !isBackupKey(k) && !isSecretKey(k) && !LOCAL_ONLY.has(k));
    expect(undecided).toEqual([]);
    expect(found.size).toBeGreaterThan(10);
  });

  it('chaves dinâmicas conhecidas são reconhecidas', () => {
    for (const k of ['ss.cfg.note-find', 'ss.cfg.field-chord', 'ss.study.custom-abc123', 'ss.study.acordes-abertos']) expect(isBackupKey(k), k).toBe(true);
    for (const k of ['ss.spotify.tokens', 'ss.integrations']) expect(isSecretKey(k), k).toBe(true);
  });
});
