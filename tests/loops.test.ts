import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDb, dbKeys, getFile } from '../src/lib/db';
import { MAX_LAYERS, MAX_LOOP_SECONDS, chainLoops, deleteLoopFiles, duplicateLoop, loopFileIds, loopSeconds, mergeProblem, mixdown, readLayers, sanitizeLoops, stackLoops, writeLoop, type LoopMeta } from '../src/lib/loops';
import { decodeWav, peakOf } from '../src/lib/wav';

afterEach(async () => {
  await closeDb();
  indexedDB = new IDBFactory();
});

const SR = 8000;
const tone = (n: number, v: number) => new Float32Array(n).fill(v);
const base = (o: Partial<LoopMeta> = {}) => ({ id: 'l1', name: 'Base', kind: 'loop' as const, bpm: 100, beats: 4, bars: 2, sampleRate: SR, ...o });
const mk = async (name: string, samples: Float32Array, o: Partial<LoopMeta> = {}) => writeLoop(base({ name, id: `l-${name}`, ...o }), [{ samples, vol: 1, mute: false }]);

describe('armazenamento do áudio', () => {
  it('writeLoop grava as camadas como WAV e readLayers lê de volta', async () => {
    const meta = await writeLoop(base(), [{ samples: tone(800, 0.25), vol: 0.8, mute: false }, { samples: tone(800, -0.1), vol: 1, mute: true }]);
    expect(meta.samples).toBe(800);
    expect(meta.layers).toHaveLength(2);
    expect(meta.layers.every((l) => /^lp-[\w-]+$/.test(l.id))).toBe(true);
    const back = await readLayers(meta);
    expect(back[0].samples[10]).toBeCloseTo(0.25, 3);
    expect([back[0].vol, back[1].mute]).toEqual([0.8, true]);
    expect(decodeWav(await (await getFile(meta.layers[0].id))!.arrayBuffer())!.sampleRate).toBe(SR);
  });

  it('camadas de tamanhos diferentes ou nenhuma camada são recusadas sem deixar arquivos', async () => {
    await expect(writeLoop(base(), [])).rejects.toThrow();
    await expect(writeLoop(base(), [{ samples: tone(10, 0.1), vol: 1, mute: false }, { samples: tone(20, 0.1), vol: 1, mute: false }])).rejects.toThrow(/tamanhos/);
    expect(await dbKeys('files')).toEqual([]);
  });

  it('ler um loop sem o arquivo de áudio dá erro claro', async () => {
    const meta = await mk('a', tone(100, 0.1));
    await deleteLoopFiles(meta);
    await expect(readLayers(meta)).rejects.toThrow(/não foi encontrado/);
  });

  it('duplicar copia o áudio para arquivos novos; excluir o original não afeta a cópia', async () => {
    const a = await mk('a', tone(100, 0.3));
    const b = await duplicateLoop(a, 'Cópia');
    expect(b.id).not.toBe(a.id);
    expect(b.layers[0].id).not.toBe(a.layers[0].id);
    await deleteLoopFiles(a);
    expect((await readLayers(b))[0].samples[5]).toBeCloseTo(0.3, 3);
  });

  it('mixdown aplica volume e mudo', async () => {
    const meta = await writeLoop(base(), [{ samples: tone(100, 0.2), vol: 1, mute: false }, { samples: tone(100, 0.2), vol: 0.5, mute: false }, { samples: tone(100, 0.5), vol: 1, mute: true }]);
    expect((await mixdown(meta))[3]).toBeCloseTo(0.3, 3);
  });
});

describe('juntar loops', () => {
  it('empilhar soma o áudio; o mais curto se repete até o tamanho do mais longo', async () => {
    const a = await mk('curto', Float32Array.from({ length: 100 }, (_, i) => (i < 50 ? 0.2 : 0)), { bars: 1 });
    const b = await mk('longo', tone(200, 0.1), { bars: 2 });
    const s = await stackLoops([a, b], 'Pilha');
    expect(s.samples).toBe(200);
    expect(s.bars).toBe(2);
    expect(s.layers).toHaveLength(1);
    const out = (await readLayers(s))[0].samples;
    expect(out[10]).toBeCloseTo(0.3, 3);
    expect(out[60]).toBeCloseTo(0.1, 3);
    expect(out[110]).toBeCloseTo(0.3, 3); // repetiu
    expect(peakOf(out)).toBeLessThanOrEqual(1);
  });

  it('encadear coloca um depois do outro e soma os compassos', async () => {
    const a = await mk('a', tone(100, 0.2), { bars: 1 });
    const b = await mk('b', tone(300, -0.2), { bars: 3 });
    const c = await chainLoops([a, b], 'Seção');
    expect(c.samples).toBe(400);
    expect(c.bars).toBe(4);
    const out = (await readLayers(c))[0].samples;
    expect([out[50] > 0, out[150] < 0]).toEqual([true, true]);
    expect(loopSeconds(c)).toBeCloseTo(400 / SR, 6);
  });

  it('recusa andamentos diferentes, gravações e menos de 2 loops', async () => {
    const a = await mk('a', tone(100, 0.2), { bpm: 100 });
    const b = await mk('b', tone(100, 0.2), { bpm: 120 });
    const t = await mk('t', tone(100, 0.2), { kind: 'take' });
    expect(mergeProblem([a, b])).toMatch(/andamentos diferentes/);
    expect(mergeProblem([a, t])).toMatch(/Só loops/);
    expect(mergeProblem([a])).toMatch(/pelo menos 2/);
    expect(mergeProblem([a, await mk('c', tone(100, 0.1), { bpm: 100.3 })])).toBeNull(); // tolerância de 0,5 BPM
    await expect(stackLoops([a, b], 'x')).rejects.toThrow();
    await expect(chainLoops([a], 'x')).rejects.toThrow();
  });

  it('loops de placas de som diferentes são reamostrados ao juntar', async () => {
    const a = await mk('a', tone(800, 0.2), { sampleRate: 8000 });
    const b = await writeLoop(base({ id: 'l-b', name: 'b', sampleRate: 16000 }), [{ samples: tone(1600, 0.1), vol: 1, mute: false }]); // 0,1 s também
    const s = await stackLoops([a, b], 'misto');
    expect(s.sampleRate).toBe(8000);
    expect(s.samples).toBe(800);
    expect((await readLayers(s))[0].samples[100]).toBeCloseTo(0.3, 2);
  });

  it('encadear além do limite de segundos é recusado', async () => {
    const big = await mk('big', tone(SR * 40, 0.1), { bars: 8 });
    await expect(chainLoops([big, big], 'longo')).rejects.toThrow(new RegExp(`${MAX_LOOP_SECONDS} segundos`));
  });
});

describe('validação (dados do armazenamento ou de um backup)', () => {
  const good = { id: 'l1', name: 'Riff', kind: 'loop', bpm: 100, beats: 4, bars: 2, sampleRate: 48000, samples: 96000, layers: [{ id: 'lp-abc123', vol: 1, mute: false }], createdAt: 1, updatedAt: 2 };

  it('aceita um loop válido e ignora lixo', () => {
    expect(sanitizeLoops([good])).toHaveLength(1);
    expect(sanitizeLoops('x')).toEqual([]);
    expect(sanitizeLoops([null, 5, 'a', [], {}])).toEqual([]);
  });

  it('normaliza valores e descarta ids de arquivo suspeitos', () => {
    const [m] = sanitizeLoops([{ ...good, name: 'x'.repeat(500), bpm: 9999, beats: 99, vol: 5, layers: [{ id: 'lp-ok', vol: 9, mute: 'sim' }, { id: '../etc/passwd', vol: 1 }, { id: 'sem-prefixo', vol: 1 }, { id: 'lp-<script>', vol: 1 }] }]);
    expect(m.name.length).toBe(80);
    expect(m.bpm).toBe(300);
    expect(m.beats).toBe(12);
    expect(m.layers).toEqual([{ id: 'lp-ok', vol: 1, mute: false }]);
  });

  it('descarta loops sem camadas, sem amostras, sem id ou duplicados; limita camadas e tamanho', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `lp-${i}`, vol: 1, mute: false }));
    const out = sanitizeLoops([{ ...good, layers: [] }, { ...good, samples: 0 }, { ...good, id: '' }, good, good, { ...good, id: 'l2', layers: many, samples: 48000 * 999 }]);
    expect(out.map((m) => m.id)).toEqual(['l1', 'l2']);
    expect(out[1].layers).toHaveLength(MAX_LAYERS);
    expect(out[1].samples).toBe(48000 * MAX_LOOP_SECONDS);
  });

  it('com a lista de arquivos do backup, só ficam camadas cujo áudio veio junto', () => {
    const files = new Set(['lp-keep']);
    const out = sanitizeLoops([{ ...good, layers: [{ id: 'lp-keep', vol: 1 }, { id: 'lp-missing', vol: 1 }] }, { ...good, id: 'l2', layers: [{ id: 'lp-missing', vol: 1 }] }], files);
    expect(out).toHaveLength(1);
    expect(out[0].layers.map((l) => l.id)).toEqual(['lp-keep']);
  });

  it('gravação (take) precisa dos dados da base; os campos são validados', () => {
    const take = { offset: 99, countIn: true, style: 'xx', bpm: 5, vol: { drums: 9 }, slots: [[0, 0, 'maj', 16, 0, 'C'], [99, 99, '<b>', 16, 0, 'x'], 'lixo'] };
    expect(sanitizeLoops([{ ...good, kind: 'take' }])).toEqual([]); // sem take
    const [m] = sanitizeLoops([{ ...good, kind: 'take', songId: 'm 1<x>', take }]);
    expect(m.songId).toBe('m1x');
    expect(m.take).toMatchObject({ offset: 30, countIn: true, style: 'rock', bpm: 30 });
    expect(m.take!.vol.drums).toBe(1);
    expect(m.take!.slots).toEqual([[0, 0, 'maj', 16, 0, 'C']]);
  });

  it('loopFileIds junta os ids únicos', () => {
    expect(loopFileIds([good, { ...good, id: 'l2', layers: [{ id: 'lp-abc123', vol: 1 }, { id: 'lp-other', vol: 1 }] }]).sort()).toEqual(['lp-abc123', 'lp-other']);
  });
});
