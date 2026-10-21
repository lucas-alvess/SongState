import { describe, expect, it } from 'vitest';
import { loopFits, loopFrames, nextBoundary, phaseAt, trimCapture } from '../src/lib/looper';
import { BARS_OPTIONS, DEFAULT_LOOPER, normalizeLooper } from '../src/lib/looper-prefs';
import { slotsToTuples, tuplesToSlots } from '../src/lib/take';
import { makeSlot } from '../src/lib/jam';
import { sanitizeLoops } from '../src/lib/loops';

describe('tamanho do loop', () => {
  it('2 compassos de 4/4 a 120 BPM = 4 s', () => {
    expect(loopFrames({ bpm: 120, beats: 4, bars: 2 }, 48000)).toBe(4 * 48000);
    expect(loopFrames({ bpm: 60, beats: 3, bars: 1 }, 44100)).toBe(3 * 44100);
  });

  it('tamanho sempre inteiro e proporcional ao andamento', () => {
    for (const bpm of [47, 83.3, 101, 133, 187]) {
      const n = loopFrames({ bpm, beats: 4, bars: 4 }, 48000);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeCloseTo((16 * 60 * 48000) / bpm, 0);
    }
  });

  it('respeita o limite de 60 segundos', () => {
    expect(loopFits({ bpm: 120, beats: 4, bars: 8 })).toBe(true); // 16 s
    expect(loopFits({ bpm: 40, beats: 4, bars: 8 })).toBe(true); // 48 s
    expect(loopFits({ bpm: 40, beats: 4, bars: 16 })).toBe(false); // 96 s
  });
});

describe('alinhamento no tempo', () => {
  it('nextBoundary: próximo início de loop depois da folga', () => {
    expect(nextBoundary(10.0, 8, 4, 0.05)).toBeCloseTo(12, 9);
    expect(nextBoundary(11.97, 8, 4, 0.05)).toBeCloseTo(16, 9); // faltam 30 ms: pula para o seguinte
    expect(nextBoundary(8, 8, 4, 0.05)).toBeCloseTo(12, 9);
    expect(nextBoundary(5, 8, 4, 0.05)).toBeCloseTo(8, 9); // antes do início
  });

  it('o limite sempre fica no futuro e é múltiplo exato da duração', () => {
    for (let i = 0; i < 200; i++) {
      const start = i * 0.37;
      const len = 1 + (i % 7) * 0.53;
      const now = start + i * 1.1;
      const t = nextBoundary(now, start, len, 0.05);
      expect(t).toBeGreaterThanOrEqual(now + 0.05 - 1e-9);
      expect(t - now).toBeLessThanOrEqual(len + 0.05 + 1e-9);
      const frac = ((t - start) / len) % 1;
      expect(Math.min(frac, 1 - frac)).toBeLessThan(1e-6); // múltiplo exato (tolerando 0,9999… ≈ 1)
    }
  });

  it('phaseAt: posição dentro do loop, também para tempos antes do início', () => {
    expect(phaseAt(10, 8, 4)).toBeCloseTo(2, 9);
    expect(phaseAt(12, 8, 4)).toBeCloseTo(0, 9);
    expect(phaseAt(7, 8, 4)).toBeCloseTo(3, 9);
    for (let i = 0; i < 100; i++) {
      const p = phaseAt(i * 0.77 - 20, 3.3, 2.1);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(2.1);
    }
  });

  it('uma camada que entra com a fase certa continua o mesmo ponto do loop', () => {
    const start = 100;
    const len = 2;
    const t1 = 105.3;
    const t2 = t1 + 0.7;
    const diff = (((phaseAt(t2, start, len) - phaseAt(t1, start, len)) % len) + len) % len; // a fase dá a volta no fim do loop
    expect(diff).toBeCloseTo(0.7, 9);
  });
});

describe('compensação de latência', () => {
  it('descarta o início e mantém o tamanho do loop', () => {
    const data = Float32Array.from({ length: 110 }, (_, i) => i);
    const out = trimCapture(data, 10, 100);
    expect(out).toHaveLength(100);
    expect(out[0]).toBe(10);
    expect(out[99]).toBe(109);
  });

  it('captura curta é completada com silêncio, sem lançar erro', () => {
    const out = trimCapture(Float32Array.from([1, 2, 3, 4, 5]), 2, 8);
    expect(Array.from(out)).toEqual([3, 4, 5, 0, 0, 0, 0, 0]);
    expect(trimCapture(new Float32Array(0), 5, 4)).toHaveLength(4);
    expect(trimCapture(Float32Array.from([1, 2]), 100, 3)).toEqual(new Float32Array(3));
  });

  it('latência zero devolve o áudio como veio', () => {
    const data = Float32Array.from([1, 2, 3]);
    expect(Array.from(trimCapture(data, 0, 3))).toEqual([1, 2, 3]);
  });
});


describe('preferências do looper', () => {
  it('padrão para valores ausentes ou lixo', () => {
    for (const raw of [undefined, null, 7, 'x', [], {}]) expect(normalizeLooper(raw)).toEqual(DEFAULT_LOOPER);
  });

  it('limita BPM e latência e aceita só opções existentes', () => {
    expect(normalizeLooper({ bpm: 5 }).bpm).toBe(40);
    expect(normalizeLooper({ bpm: 999 }).bpm).toBe(200);
    expect(normalizeLooper({ bars: 3 }).bars).toBe(DEFAULT_LOOPER.bars);
    expect(normalizeLooper({ beats: 5 }).beats).toBe(4);
    expect(normalizeLooper({ latencyMs: 9999 }).latencyMs).toBe(500);
    expect(normalizeLooper({ latencyMs: -3 }).latencyMs).toBe(0);
    expect(normalizeLooper({ latencyMs: 'x' }).latencyMs).toBe(0); // valor inválido: 0 (sem compensação), nunca NaN
    expect(normalizeLooper({ quantized: false }).quantized).toBe(false);
  });

  it('combinação que passaria de 60 s reduz os compassos até caber', () => {
    const p = normalizeLooper({ bpm: 40, bars: 8, beats: 6 }); // 8 × 6 batidas a 40 BPM = 72 s
    expect(BARS_OPTIONS).toContain(p.bars);
    expect(p.bars).toBeLessThan(8);
    expect((p.bars * p.beats * 60) / p.bpm).toBeLessThanOrEqual(60);
  });
});

describe('gravação sobre a base: slots compactos', () => {
  it('ida e volta preserva os acordes', () => {
    const slots = [makeSlot(0, 0, 'maj', 16, 0, 'C'), makeSlot(7, 11, 'maj', 8, 1, 'G/B'), makeSlot(9, 9, 'min', 8, 1, 'Am')];
    const back = tuplesToSlots(slotsToTuples(slots));
    expect(back.map((s) => [s.rootPc, s.bassPc, s.typeId, s.len, s.bar, s.label])).toEqual(slots.map((s) => [s.rootPc, s.bassPc, s.typeId, s.len, s.bar, s.label]));
    expect(back.map((s) => s.pcs)).toEqual(slots.map((s) => s.pcs));
  });

  it('o ponto de partida (fromSlot) é validado ao ler a biblioteca', () => {
    const take = { offset: 1, countIn: false, fromSlot: 99999, style: 'rock', bpm: 100, vol: {}, slots: [[0, 0, 'maj', 16, 0, 'C']] };
    const [m] = sanitizeLoops([{ id: 'l1', name: 'x', kind: 'take', bpm: 100, beats: 4, bars: 0, sampleRate: 48000, samples: 100, layers: [{ id: 'lp-a', vol: 1 }], take }]);
    expect(m.take!.fromSlot).toBe(399);
  });
});
