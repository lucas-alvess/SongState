/**
 * Descobre o tom (tônica + maior/menor) de uma música.
 *
 * - Pela cifra: pontua as 24 tonalidades pelo quanto os acordes cabem na escala, pelo peso da tônica, da dominante
 *   e da subdominante e por começar/terminar na tônica. Instantâneo e determinístico.
 * - Pelo áudio (arquivos enviados): cromagrama (energia por nota) correlacionado com os perfis de Krumhansl–Schmuckler.
 *
 * YouTube e Spotify não permitem acesso ao áudio, então para eles só vale o que vem da cifra.
 */
import { chordPcs, chordTypeById, type ChartSlot } from './chords';
import { mod12 } from './music';

export interface KeyGuess {
  keyPc: number;
  minor: boolean;
  score: number;
}

export interface KeyResult {
  best: KeyGuess;
  alternatives: KeyGuess[]; // as 3 melhores depois da escolhida
  confidence: number; // 0 a 1
  relativeAmbiguous: boolean; // a vice-campeã é a relativa (ex.: Dó maior × Lá menor)
  reasons: string[]; // em palavras, para mostrar ao usuário (só na detecção pela cifra)
}

const MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]);
const MINOR = new Set([0, 2, 3, 5, 7, 8, 10, 11]); // natural + sensível (menor harmônica)

const majorThird = (typeId: string) => chordTypeById(typeId).tokens.includes('3');
const minorThird = (typeId: string) => chordTypeById(typeId).tokens.includes('b3');

export const relativeOf = (g: { keyPc: number; minor: boolean }) => ({ keyPc: mod12(g.keyPc + (g.minor ? 3 : -3)), minor: !g.minor });

/** Tom pela cifra. Devolve null se houver menos de 2 acordes reconhecidos. */
export function detectKeyFromChart(slots: ChartSlot[]): KeyResult | null {
  const list = slots.filter((s) => s.len > 0);
  if (list.length < 2) return null;
  const W = list.reduce((n, s) => n + s.len, 0);
  const first = list[0];
  const last = list[list.length - 1];
  const pcsOf = list.map((s) => chordPcs(s.rootPc, s.typeId));

  const guesses: KeyGuess[] = [];
  const detail = new Map<string, { fit: number; tonic: number; dom: number; sd: number; out: number; first: boolean; last: boolean }>();
  for (let t = 0; t < 12; t++) {
    for (const minor of [false, true]) {
      const set = minor ? MINOR : MAJOR;
      let fit = 0;
      let out = 0;
      let tonic = 0;
      let dom = 0;
      let sd = 0;
      list.forEach((s, i) => {
        const pcs = pcsOf[i];
        fit += s.len * (pcs.filter((p) => set.has(mod12(p - t))).length / pcs.length);
        const deg = mod12(s.rootPc - t);
        if (!set.has(deg)) out += s.len;
        if (deg === 0) {
          const q = minor ? !majorThird(s.typeId) : !minorThird(s.typeId);
          tonic += s.len * (q ? 1 : 0.5);
        } else if (deg === 7) dom += s.len * (majorThird(s.typeId) ? 1 : minor ? 0.5 : 0.3);
        else if (deg === 5) sd += s.len;
      });
      const endsOn = (s: ChartSlot) => (mod12(s.rootPc - t) === 0 ? ((minor ? !majorThird(s.typeId) : !minorThird(s.typeId)) ? 1 : 0.5) : 0);
      const f = endsOn(first);
      const l = endsOn(last);
      const score = (fit / W) * 3 + (tonic / W) * 3 + (dom / W) * 1 + (sd / W) * 0.5 - (out / W) * 3 + f * 1.2 + l * 1.2;
      guesses.push({ keyPc: t, minor, score });
      detail.set(`${t}${minor ? 'm' : 'M'}`, { fit: fit / W, tonic: tonic / W, dom: dom / W, sd: sd / W, out: out / W, first: f > 0, last: l > 0 });
    }
  }
  guesses.sort((a, b) => b.score - a.score);
  const best = guesses[0];
  const second = guesses[1];
  const rel = relativeOf(best);
  const relativeAmbiguous = second.keyPc === rel.keyPc && second.minor === rel.minor && best.score - second.score < 1;
  const margin = best.score - second.score;
  let confidence = Math.max(0, Math.min(1, margin / 2));
  if (relativeAmbiguous) confidence = Math.min(confidence, 0.45);
  if (list.length < 4) confidence = Math.min(confidence, 0.5);

  const d = detail.get(`${best.keyPc}${best.minor ? 'm' : 'M'}`)!;
  const reasons: string[] = [];
  if (d.first && d.last) reasons.push('A música começa e termina na tônica.');
  else if (d.first) reasons.push('A música começa na tônica.');
  else if (d.last) reasons.push('A música termina na tônica.');
  reasons.push(`${Math.round(d.fit * 100)}% das notas dos acordes cabem na escala deste tom.`);
  if (d.dom > 0.05) reasons.push('Tem a dominante (V) preparando a tônica.');
  if (d.tonic > 0.3) reasons.push('A tônica é o acorde mais presente.');
  return { best, alternatives: guesses.slice(1, 4), confidence, relativeAmbiguous, reasons };
}

// ---------- áudio ----------

const KS_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KS_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** FFT de raiz 2, no lugar (re/im com tamanho potência de 2). */
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

export const CHROMA_RATE = 11025;
const FRAME = 8192;

/** Reduz a taxa de amostragem por média de blocos (o suficiente para analisar notas até cerca de 2 kHz). */
export function downsample(x: Float32Array, rate: number, target = CHROMA_RATE): { data: Float32Array; rate: number } {
  const f = Math.max(1, Math.floor(rate / target));
  if (f === 1) return { data: x, rate };
  const out = new Float32Array(Math.floor(x.length / f));
  for (let i = 0; i < out.length; i++) {
    let s = 0;
    for (let k = 0; k < f; k++) s += x[i * f + k];
    out[i] = s / f;
  }
  return { data: out, rate: rate / f };
}

/** Energia por nota (12 valores, Dó = 0) somada ao longo do áudio. */
export function chromaOf(samples: Float32Array, sampleRate: number, maxSeconds = 120): number[] {
  let x = samples;
  const maxN = Math.floor(maxSeconds * sampleRate);
  if (x.length > maxN) {
    const from = Math.floor((x.length - maxN) / 2); // a parte central: evita introdução e final
    x = x.subarray(from, from + maxN);
  }
  const { data, rate } = downsample(x, sampleRate);
  const chroma = new Array<number>(12).fill(0);
  if (data.length < FRAME) return chroma;
  const win = new Float64Array(FRAME);
  for (let i = 0; i < FRAME; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1));
  const re = new Float64Array(FRAME);
  const im = new Float64Array(FRAME);
  const lo = Math.ceil((65 * FRAME) / rate); // ~Dó2
  const hi = Math.min(FRAME / 2 - 1, Math.floor((2000 * FRAME) / rate));
  const pcOfBin = new Int8Array(FRAME / 2);
  for (let k = lo; k <= hi; k++) pcOfBin[k] = mod12(Math.round(12 * Math.log2((k * rate) / FRAME / 440)) + 9);
  const hop = FRAME / 2;
  for (let start = 0; start + FRAME <= data.length; start += hop) {
    for (let i = 0; i < FRAME; i++) {
      re[i] = data[start + i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    const frame = new Array<number>(12).fill(0);
    for (let k = lo; k <= hi; k++) frame[pcOfBin[k]] += Math.sqrt(Math.hypot(re[k], im[k])); // compressão: o grave não domina
    const total = frame.reduce((a, b) => a + b, 0) || 1;
    for (let p = 0; p < 12; p++) chroma[p] += frame[p] / total; // cada quadro pesa igual
  }
  return chroma;
}

const corr = (a: number[], b: number[]) => {
  const ma = a.reduce((x, y) => x + y, 0) / 12;
  const mb = b.reduce((x, y) => x + y, 0) / 12;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < 12; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
};

/** Tom a partir de um cromagrama (perfis de Krumhansl–Schmuckler). */
export function keyFromChroma(chroma: number[]): KeyResult | null {
  if (chroma.length !== 12 || chroma.every((v) => v === 0)) return null;
  const guesses: KeyGuess[] = [];
  for (let t = 0; t < 12; t++) {
    const rot = (prof: number[]) => Array.from({ length: 12 }, (_, i) => prof[mod12(i - t)]);
    guesses.push({ keyPc: t, minor: false, score: corr(chroma, rot(KS_MAJOR)) });
    guesses.push({ keyPc: t, minor: true, score: corr(chroma, rot(KS_MINOR)) });
  }
  guesses.sort((a, b) => b.score - a.score);
  const [best, second] = guesses;
  const rel = relativeOf(best);
  const relativeAmbiguous = second.keyPc === rel.keyPc && second.minor === rel.minor && best.score - second.score < 0.05;
  let confidence = Math.max(0, Math.min(1, (best.score - second.score) / 0.12));
  if (best.score < 0.5) confidence = Math.min(confidence, 0.3); // pouca semelhança com qualquer tom
  if (relativeAmbiguous) confidence = Math.min(confidence, 0.45);
  return { best, alternatives: guesses.slice(1, 4), confidence, relativeAmbiguous, reasons: ['Análise das notas que mais aparecem no áudio.'] };
}

export function detectKeyFromAudio(samples: Float32Array, sampleRate: number): KeyResult | null {
  return keyFromChroma(chromaOf(samples, sampleRate));
}

export const confidenceLabel = (c: number) => (c >= 0.7 ? 'alta' : c >= 0.4 ? 'média' : 'baixa');
