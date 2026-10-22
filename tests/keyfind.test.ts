import { describe, expect, it } from 'vitest';
import { parseChart, chordPcs } from '../src/lib/chords';
import { chromaOf, confidenceLabel, detectKeyFromAudio, detectKeyFromChart, downsample, fft, keyFromChroma, relativeOf } from '../src/lib/keyfind';
import { mod12 } from '../src/lib/music';

const key = (chart: string) => {
  const r = detectKeyFromChart(parseChart(chart).slots)!;
  return { pc: r.best.keyPc, minor: r.best.minor, r };
};
// Dó = 0
const C = 0, D = 2, E = 4, F = 5, G = 7, A = 9, B = 11;

describe('tom pela cifra', () => {
  it('progressões conhecidas', () => {
    expect(key('| C | Am | F | G |')).toMatchObject({ pc: C, minor: false });
    expect(key('| G | D | Em | C | G |')).toMatchObject({ pc: G, minor: false });
    expect(key('| Am | Dm | E7 | Am |')).toMatchObject({ pc: A, minor: true });
    expect(key('| Am | G | F | E |')).toMatchObject({ pc: A, minor: true }); // cadência andaluza
    expect(key('| D | A | Bm | G | D |')).toMatchObject({ pc: D, minor: false });
    expect(key('| Dm | Gm | A7 | Dm |')).toMatchObject({ pc: D, minor: true });
    expect(key('| E | A | B7 | E |')).toMatchObject({ pc: E, minor: false });
    expect(key('| F#m | D | A | E | F#m |')).toMatchObject({ pc: 6, minor: true });
  });

  it('blues de 12 compassos em Lá (acordes de sétima) → Lá', () => {
    const r = key('| A7 | A7 | A7 | A7 | D7 | D7 | A7 | A7 | E7 | D7 | A7 | E7 |');
    expect(r.pc).toBe(A);
  });

  it('blues menor em Mi', () => {
    expect(key('| Em7 | Em7 | Em7 | Em7 | Am7 | Am7 | Em7 | Em7 | B7 | Am7 | Em7 | B7 |')).toMatchObject({ pc: E, minor: true });
  });

  it('jazz: ii–V–I em Dó e em Si bemol', () => {
    expect(key('| Dm7 | G7 | Cmaj7 | Cmaj7 |')).toMatchObject({ pc: C, minor: false });
    expect(key('| Cm7 | F7 | Bbmaj7 | Bbmaj7 |')).toMatchObject({ pc: 10, minor: false });
  });

  it('relativas (Lá menor × Dó maior) ficam como ambíguas, com confiança baixa e a outra nas alternativas', () => {
    const r = key('| Am | F | C | G |').r;
    expect(r.relativeAmbiguous || r.confidence < 0.6).toBe(true);
    const cands = [r.best, ...r.alternatives].map((g) => `${g.keyPc}${g.minor ? 'm' : 'M'}`);
    expect(cands).toContain(`${A}m`);
    expect(cands).toContain(`${C}M`);
    expect(confidenceLabel(r.confidence)).not.toBe('alta');
  });

  it('progressão clara tem confiança alta e motivos legíveis', () => {
    const r = key('| C | F | G7 | C | C | F | G7 | C |').r;
    expect(r.confidence).toBeGreaterThanOrEqual(0.6);
    expect(r.reasons.join(' ')).toMatch(/começa e termina na tônica/);
    expect(r.reasons.join(' ')).toMatch(/\d+%/);
    expect(r.alternatives).toHaveLength(3);
  });

  it('cifra curta ou vazia: sem resultado (ou confiança limitada)', () => {
    expect(detectKeyFromChart([])).toBeNull();
    expect(detectKeyFromChart(parseChart('| C |').slots)).toBeNull();
    expect(detectKeyFromChart(parseChart('| C | G |').slots)!.confidence).toBeLessThanOrEqual(0.5);
  });

  it('transposição: o mesmo desenho em qualquer tom dá o tom transposto', () => {
    const roots = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    for (let t = 0; t < 12; t++) {
      const r = (deg: number) => roots[mod12(t + deg)];
      const chart = `| ${r(0)} | ${r(5)} | ${r(7)}7 | ${r(0)} | ${r(0)} | ${r(9)}m | ${r(5)} | ${r(7)} | ${r(0)} |`;
      expect(key(chart)).toMatchObject({ pc: t, minor: false });
      const cm = `| ${r(0)}m | ${r(5)}m | ${r(7)}7 | ${r(0)}m | ${r(0)}m | ${r(8)} | ${r(7)}7 | ${r(0)}m |`;
      expect(key(cm)).toMatchObject({ pc: t, minor: true });
    }
  });

  it('relativeOf', () => {
    expect(relativeOf({ keyPc: C, minor: false })).toEqual({ keyPc: A, minor: true });
    expect(relativeOf({ keyPc: A, minor: true })).toEqual({ keyPc: C, minor: false });
  });
});

describe('FFT e utilidades', () => {
  it('uma senoide cai no bin certo', () => {
    const n = 1024;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * 50 * i) / n);
    fft(re, im);
    const mag = Array.from({ length: n / 2 }, (_, k) => Math.hypot(re[k], im[k]));
    expect(mag.indexOf(Math.max(...mag))).toBe(50);
    expect(mag[50]).toBeCloseTo(n / 2, 3);
  });

  it('downsample reduz o número de amostras pela razão', () => {
    const d = downsample(new Float32Array(44100), 44100);
    expect(d.rate).toBe(11025);
    expect(d.data).toHaveLength(11025);
  });

  it('keyFromChroma com perfil vazio ou inválido', () => {
    expect(keyFromChroma(new Array(12).fill(0))).toBeNull();
    expect(keyFromChroma([1, 2, 3])).toBeNull();
  });
});

// ---------- áudio sintético ----------

const SR = 22050;
/** Soma de notas (com harmônicos) por `sec` segundos. Frequências a partir do número MIDI. */
function chordAudio(chords: number[][], sec = 1.2, cents = 0, noise = 0): Float32Array {
  const out = new Float32Array(Math.floor(chords.length * sec * SR));
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  chords.forEach((notes, ci) => {
    for (let i = 0; i < sec * SR; i++) {
      const t = i / SR;
      let v = 0;
      for (const m of notes) {
        const f = 440 * Math.pow(2, (m - 69 + cents / 100) / 12);
        v += Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * 2 * f * t) + 0.25 * Math.sin(2 * Math.PI * 3 * f * t);
      }
      const env = Math.min(1, t * 20) * Math.min(1, (sec - t) * 20);
      out[ci * Math.floor(sec * SR) + i] = (v / notes.length) * 0.3 * env + noise * rnd();
    }
  });
  return out;
}
/** Acorde (tônica + tipo) em oitava média, como números MIDI. */
const triad = (root: number, minor = false) => [48 + root, 48 + root + (minor ? 3 : 4), 48 + root + 7, 60 + root];

describe('tom pelo áudio', () => {
  it('Dó maior (C G Am F)', () => {
    const r = detectKeyFromAudio(chordAudio([triad(C), triad(G), triad(A, true), triad(F), triad(C), triad(G), triad(A, true), triad(F), triad(C)]), SR)!;
    expect(r.best).toMatchObject({ keyPc: C, minor: false });
  });

  it('Lá menor (Am Dm E Am)', () => {
    const r = detectKeyFromAudio(chordAudio([triad(A, true), triad(D, true), [48 + E, 48 + E + 4, 48 + E + 7, 36 + E], triad(A, true), triad(A, true), triad(D, true), [48 + E, 48 + E + 4, 48 + E + 7], triad(A, true)]), SR)!;
    expect(r.best).toMatchObject({ keyPc: A, minor: true });
  });

  it('Ré maior (D G A D)', () => {
    const r = detectKeyFromAudio(chordAudio([triad(D), triad(G), triad(A), triad(D), triad(D), triad(G), triad(A), triad(D)]), SR)!;
    expect(r.best).toMatchObject({ keyPc: D, minor: false });
  });

  it('instrumento afinado 25 cents abaixo e com ruído continua dando o mesmo tom', () => {
    const r = detectKeyFromAudio(chordAudio([triad(E), triad(A), triad(B), triad(E), triad(E), triad(A), triad(B), triad(E)], 1.2, -25, 0.15), SR)!;
    expect(r.best).toMatchObject({ keyPc: E, minor: false });
  });

  it('silêncio ou áudio curto: sem resultado', () => {
    expect(detectKeyFromAudio(new Float32Array(SR * 5), SR)).toBeNull();
    expect(chromaOf(new Float32Array(1000), SR).every((v) => v === 0)).toBe(true);
  });

  it('áudio longo usa só a parte central (rápido) e o resultado é o mesmo', () => {
    const song = chordAudio([triad(G), triad(C), triad(D), triad(G)].flatMap((c) => [c, c]), 1.2);
    const long = new Float32Array(SR * 400);
    for (let k = 0; k < 40; k++) long.set(song.subarray(0, Math.min(song.length, long.length - k * song.length)), k * song.length);
    const t0 = Date.now();
    const r = detectKeyFromAudio(long, SR)!;
    expect(Date.now() - t0).toBeLessThan(8000);
    expect(r.best).toMatchObject({ keyPc: G, minor: false });
  });

  it('as pitch classes do acorde (apoio dos testes)', () => {
    expect(chordPcs(C, 'maj').sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });
});
