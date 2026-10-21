import { describe, expect, it } from 'vitest';
import { A4_DEFAULT, Stabilizer, centsFrom, detectPitch, hzToMidi, inTune, median, midiToHz, nearestNote, nearestString, rms } from '../src/lib/pitch';
import { TUNINGS } from '../src/lib/music';

const SR = 48000;
const N = 8192; // mesmo tamanho de janela que o afinador usa

/** Soma de harmônicos (amplitudes relativas) com ruído opcional e semente fixa. */
function tone(freq: number, harmonics: number[] = [1], opts: { sr?: number; noise?: number; amp?: number; phase?: number } = {}): Float32Array {
  const { sr = SR, noise = 0, amp = 0.3, phase = 0 } = opts;
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const out = new Float32Array(N);
  const norm = harmonics.reduce((a, b) => a + Math.abs(b), 0);
  for (let i = 0; i < N; i++) {
    let v = 0;
    harmonics.forEach((h, k) => (v += h * Math.sin(2 * Math.PI * freq * (k + 1) * (i / sr) + phase * (k + 1))));
    out[i] = (amp * v) / norm + noise * rnd();
  }
  return out;
}

const centsOff = (got: number, want: number) => 1200 * Math.log2(got / want);
const GUITAR = [82.407, 110.0, 146.832, 195.998, 246.942, 329.628]; // E2 A2 D3 G3 B3 E4

describe('YIN: detecção de altura', () => {
  it('acha as 6 cordas da guitarra em senos puros com erro < 1 cent', () => {
    for (const sr of [44100, 48000]) {
      for (const f of GUITAR) {
        const p = detectPitch(tone(f, [1], { sr }), sr)!;
        expect(p, `${f} Hz @${sr}`).not.toBeNull();
        expect(Math.abs(centsOff(p.freq, f)), `${f} Hz @${sr}: ${p.freq}`).toBeLessThan(1);
        expect(p.clarity).toBeGreaterThan(0.9);
      }
    }
  });

  it('não cai no erro de oitava quando o 2º harmônico é mais forte que a fundamental', () => {
    for (const f of GUITAR) {
      const p = detectPitch(tone(f, [0.5, 1, 0.6, 0.3]), SR)!;
      expect(Math.abs(centsOff(p.freq, f)), `${f}`).toBeLessThan(2);
    }
  });

  it('timbre de corda (harmônicos decrescentes) e fase qualquer', () => {
    for (const f of GUITAR) {
      for (const phase of [0, 1.3, 2.9]) {
        const p = detectPitch(tone(f, [1, 0.7, 0.5, 0.35, 0.2], { phase }), SR)!;
        expect(Math.abs(centsOff(p.freq, f)), `${f} fase ${phase}`).toBeLessThan(1.5);
      }
    }
  });

  it('aguenta ruído (≈ 8% da amplitude)', () => {
    for (const f of GUITAR) {
      const p = detectPitch(tone(f, [1, 0.6, 0.3], { noise: 0.02 }), SR)!;
      expect(p, `${f}`).not.toBeNull();
      expect(Math.abs(centsOff(p.freq, f)), `${f}`).toBeLessThan(5);
    }
  });

  it('mede corretamente notas fora de afinação (±30 cents)', () => {
    for (const cents of [-30, -12, 7, 30]) {
      const f = 110 * Math.pow(2, cents / 1200);
      const p = detectPitch(tone(f), SR)!;
      expect(Math.abs(centsOff(p.freq, f))).toBeLessThan(1);
      expect(nearestNote(p.freq).cents).toBeCloseTo(cents, 0);
    }
  });

  it('silêncio, sinal muito fraco e ruído branco não geram nota', () => {
    expect(detectPitch(new Float32Array(N), SR)).toBeNull();
    expect(detectPitch(tone(110, [1], { amp: 0.002 }), SR)).toBeNull();
    const noise = new Float32Array(N);
    let seed = 7;
    for (let i = 0; i < N; i++) noise[i] = (((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1) * 0.3;
    expect(detectPitch(noise, SR)).toBeNull();
  });

  it('entradas inválidas não lançam erro', () => {
    expect(detectPitch(new Float32Array(10), SR)).toBeNull();
    expect(detectPitch(tone(110), 0)).toBeNull();
    expect(detectPitch(tone(110), NaN)).toBeNull();
    expect(() => detectPitch(new Float32Array(N).fill(NaN), SR)).not.toThrow();
  });

  it('abaixo da faixa pedida não inventa uma nota', () => {
    expect(detectPitch(tone(40), SR, { minFreq: 60 })).toBeNull();
  });

  it('rms de um seno de amplitude A é A/√2', () => {
    expect(rms(tone(220, [1], { amp: 0.5 }))).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });
});

describe('notas, cents e cordas', () => {
  it('A4 = 440 Hz = MIDI 69, com 0 cent', () => {
    expect(nearestNote(440)).toEqual({ midi: 69, cents: 0 });
    expect(hzToMidi(440)).toBe(69);
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(40)).toBeCloseTo(82.407, 2); // E2
  });

  it('desvio positivo = acima, negativo = abaixo', () => {
    expect(nearestNote(446).cents).toBeGreaterThan(20);
    expect(nearestNote(434).cents).toBeLessThan(-20);
    expect(centsFrom(110, 45)).toBeCloseTo(0, 5);
    expect(centsFrom(110 * Math.pow(2, 10 / 1200), 45)).toBeCloseTo(10, 5);
  });

  it('diapasão de referência diferente muda a nota-alvo', () => {
    expect(nearestNote(442, 442)).toEqual({ midi: 69, cents: 0 });
    expect(nearestNote(442, 440).cents).toBeCloseTo(7.85, 1);
    expect(midiToHz(69, 432)).toBe(432);
  });

  it('nearestString escolhe a corda mais próxima da afinação', () => {
    const std = TUNINGS.find((t) => t.id === 'standard')!.midi;
    expect(nearestString(82.4, std)).toMatchObject({ index: 0 });
    expect(nearestString(112, std).index).toBe(1);
    expect(nearestString(112, std).cents).toBeGreaterThan(0);
    expect(nearestString(190, std).index).toBe(3);
    expect(nearestString(190, std).cents).toBeLessThan(0);
    expect(nearestString(330, std).index).toBe(5);
  });

  it('todas as afinações do app: cada corda é reconhecida como ela mesma', () => {
    for (const t of TUNINGS) {
      t.midi.forEach((m, i) => {
        const hit = nearestString(midiToHz(m), t.midi);
        expect(Math.abs(hit.cents), `${t.id} corda ${i}`).toBeLessThan(0.001);
        expect(t.midi[hit.index]).toBe(m);
      });
    }
  });

  it('inTune usa ±5 cents', () => {
    expect(inTune(0)).toBe(true);
    expect(inTune(-5)).toBe(true);
    expect(inTune(5.1)).toBe(false);
    expect(A4_DEFAULT).toBe(440);
  });
});

describe('estabilizador', () => {
  it('mediana descarta saltos isolados (erro de oitava)', () => {
    const s = new Stabilizer(5, 6, 3);
    const out = [110, 110.2, 220, 110.1, 109.9].map((f) => s.push(f));
    expect(out[0]).toBeNull(); // poucas leituras ainda
    expect(out[2]).toBeCloseTo(110.2, 1);
    expect(out[4]).toBeCloseTo(110.1, 1);
  });

  it('esquece depois de silêncio prolongado e se recompõe', () => {
    const s = new Stabilizer(5, 3, 3);
    [100, 100, 100].forEach((f) => s.push(f));
    expect(s.push(null)).not.toBeNull(); // pausa curta: segura a última leitura
    s.push(null);
    expect(s.push(null)).toBeNull(); // 3 faltas seguidas: zera
    expect(s.push(200)).toBeNull();
    s.push(200);
    expect(s.push(200)).toBe(200);
  });

  it('median: par, ímpar e não altera a entrada', () => {
    const v = [3, 1, 2];
    expect(median(v)).toBe(2);
    expect(v).toEqual([3, 1, 2]);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});
