import { describe, expect, it } from 'vitest';
import { chain, decodeWav, encodeWavBytes, findOnset, mixLayers, peakOf, resample, tileTo } from '../src/lib/wav';

const sine = (n: number, freq: number, sr: number, amp = 0.5) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / sr));

describe('WAV', () => {
  it('ida e volta mantém as amostras (erro de quantização < 1/32768)', () => {
    const s = sine(4800, 440, 48000);
    const back = decodeWav(encodeWavBytes(s, 48000))!;
    expect(back.sampleRate).toBe(48000);
    expect(back.samples).toHaveLength(4800);
    for (let i = 0; i < s.length; i += 97) expect(Math.abs(back.samples[i] - s[i])).toBeLessThan(1 / 32000);
  });

  it('cabeçalho válido e tamanho certo', () => {
    const b = encodeWavBytes(new Float32Array(100), 44100);
    expect(b.length).toBe(44 + 200);
    expect(String.fromCharCode(...b.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...b.slice(8, 12))).toBe('WAVE');
  });

  it('valores fora de ±1 são cortados, sem estourar', () => {
    const back = decodeWav(encodeWavBytes(Float32Array.from([2, -2, 0.5]), 48000))!;
    expect(back.samples[0]).toBeCloseTo(1, 3);
    expect(back.samples[1]).toBeCloseTo(-1, 3);
    expect(back.samples[2]).toBeCloseTo(0.5, 3);
  });

  it('recusa arquivos que não são WAV PCM 16 bits', () => {
    expect(decodeWav(new Uint8Array(10))).toBeNull();
    expect(decodeWav(new Uint8Array(100))).toBeNull();
    const ok = encodeWavBytes(new Float32Array(10), 48000);
    const bad = ok.slice();
    bad[20] = 3; // formato float
    expect(decodeWav(bad)).toBeNull();
    const bits = ok.slice();
    bits[34] = 24;
    expect(decodeWav(bits)).toBeNull();
    const rate = ok.slice();
    new DataView(rate.buffer).setUint32(24, 10, true);
    expect(decodeWav(rate)).toBeNull();
  });

  it('data truncada não lança erro e devolve o que couber', () => {
    const b = encodeWavBytes(sine(1000, 440, 48000), 48000);
    const cut = decodeWav(b.slice(0, 44 + 500))!;
    expect(cut.samples).toHaveLength(250);
  });

  it('estéreo vira mono pela média', () => {
    const b = encodeWavBytes(new Float32Array(4), 48000);
    const v = new DataView(b.buffer);
    v.setUint16(22, 2, true); // 2 canais
    // 2 quadros estéreo = 8 bytes de dados: (L=16384,R=0) (L=0,R=-16384)
    v.setUint32(40, 8, true);
    v.setInt16(44, 16384, true);
    v.setInt16(46, 0, true);
    v.setInt16(48, 0, true);
    v.setInt16(50, -16384, true);
    const back = decodeWav(b)!;
    expect(back.samples).toHaveLength(2);
    expect(back.samples[0]).toBeCloseTo(0.25, 3);
    expect(back.samples[1]).toBeCloseTo(-0.25, 3);
  });

  it('pula blocos desconhecidos antes de "data" (ex.: LIST)', () => {
    const plain = encodeWavBytes(Float32Array.from([0.5, -0.5]), 48000);
    const list = new Uint8Array([...'LIST'].map((c) => c.charCodeAt(0)).concat([3, 0, 0, 0, 1, 2, 3, 0])); // tamanho ímpar + preenchimento
    const withList = new Uint8Array([...plain.slice(0, 36), ...list, ...plain.slice(36)]);
    const back = decodeWav(withList)!;
    expect(back.samples).toHaveLength(2);
    expect(back.samples[0]).toBeCloseTo(0.5, 3);
  });
});

describe('mistura e junção', () => {
  it('soma camadas respeitando volume e mudo', () => {
    const a = Float32Array.from([0.2, 0.2]);
    const b = Float32Array.from([0.1, 0.3]);
    const out = mixLayers([{ samples: a, vol: 1, mute: false }, { samples: b, vol: 0.5, mute: false }, { samples: Float32Array.from([0.9, 0.9]), vol: 1, mute: true }]);
    expect(out[0]).toBeCloseTo(0.25, 6);
    expect(out[1]).toBeCloseTo(0.35, 6);
  });

  it('nunca passa de ±1: reduz tudo na mesma proporção', () => {
    const loud = Float32Array.from([0.9, -0.9, 0.45]);
    const out = mixLayers([{ samples: loud, vol: 1, mute: false }, { samples: loud, vol: 1, mute: false }]);
    expect(peakOf(out)).toBeLessThanOrEqual(0.98 + 1e-6);
    expect(out[2] / out[0]).toBeCloseTo(0.5, 5); // proporção preservada
  });

  it('camada mais curta é repetida para completar a mais longa (loops de 2 e 4 compassos)', () => {
    const short = Float32Array.from([1, 0]);
    const long = new Float32Array(4);
    const out = mixLayers([{ samples: short, vol: 0.5, mute: false }, { samples: long, vol: 1, mute: false }]);
    expect(Array.from(out)).toEqual([0.5, 0, 0.5, 0]);
  });

  it('camadas vazias ou tudo mudo geram silêncio do tamanho certo', () => {
    expect(mixLayers([], 5)).toHaveLength(5);
    expect(peakOf(mixLayers([{ samples: Float32Array.from([1, 1]), vol: 1, mute: true }]))).toBe(0);
    expect(mixLayers([{ samples: Float32Array.from([1, 1]), vol: 0, mute: false }])).toEqual(new Float32Array(2));
  });

  it('chain junta na ordem e tileTo corta a última repetição', () => {
    expect(Array.from(chain([Float32Array.from([1, 2]), Float32Array.from([3]), new Float32Array(0)]))).toEqual([1, 2, 3]);
    expect(Array.from(tileTo(Float32Array.from([1, 2, 3]), 7))).toEqual([1, 2, 3, 1, 2, 3, 1]);
    expect(tileTo(new Float32Array(0), 3)).toHaveLength(3);
  });

  it('resample: mantém a duração e a frequência (48000 → 44100)', () => {
    const s = sine(4800, 440, 48000); // 0,1 s
    const r = resample(s, 48000, 44100);
    expect(r.length).toBe(4410);
    // conta cruzamentos por zero: 440 Hz × 0,1 s = 44 ciclos
    let z = 0;
    for (let i = 1; i < r.length; i++) if (r[i - 1] < 0 && r[i] >= 0) z++;
    expect(Math.abs(z - 44)).toBeLessThanOrEqual(1);
    expect(resample(s, 48000, 48000)).toBe(s);
  });
});

describe('latência: onset do clique', () => {
  it('acha o atraso do clique gravado', () => {
    const sr = 48000;
    const d = new Float32Array(sr);
    const at = Math.round((0.2 + 0.075) * sr); // clique tocado em 0,2 s chega 75 ms depois
    for (let i = 0; i < 200; i++) d[at + i] = 0.6 * Math.sin(i * 0.5);
    for (let i = 0; i < d.length; i++) d[i] += 0.002 * Math.sin(i * 7.1); // ruído de fundo baixo
    expect(findOnset(d, sr, 0.2)!).toBeCloseTo(0.075, 2);
  });

  it('silêncio ou ruído baixo = nada medido', () => {
    expect(findOnset(new Float32Array(48000), 48000, 0.2)).toBeNull();
    expect(findOnset(new Float32Array(48000).fill(0.005), 48000, 0.2)).toBeNull();
  });

  it('som que já estava tocando antes do clique não conta como atraso negativo', () => {
    const d = new Float32Array(48000).fill(0.3);
    expect(findOnset(d, 48000, 0.2)!).toBeGreaterThanOrEqual(0);
  });
});
