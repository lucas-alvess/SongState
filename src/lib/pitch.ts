/**
 * Detecção de altura (afinador). Algoritmo YIN: mede o quanto o sinal se parece com ele mesmo deslocado e
 * escolhe o primeiro "período" convincente, o que evita o erro de oitava que a autocorrelação simples comete
 * com notas graves de guitarra (onde o 2º harmônico costuma ser mais forte que a fundamental).
 * Tudo aqui é puro (sem áudio nem relógio) para ser testado com sinais sintéticos.
 */

export interface Pitch {
  freq: number;
  clarity: number; // 0–1: quão periódico é o sinal (1 = nota limpa)
}

export interface PitchOptions {
  minFreq?: number;
  maxFreq?: number;
  threshold?: number; // limiar do YIN (menor = mais exigente)
  minRms?: number; // abaixo disso é silêncio
}

export const rms = (buf: Float32Array) => {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / Math.max(1, buf.length));
};

export function detectPitch(buf: Float32Array, sampleRate: number, opts: PitchOptions = {}): Pitch | null {
  const { minFreq = 60, maxFreq = 1200, threshold = 0.12, minRms = 0.008 } = opts;
  if (!(sampleRate > 0) || buf.length < 1024 || rms(buf) < minRms) return null;

  const W = Math.floor(buf.length / 2); // janela de integração
  const tauMax = Math.min(W - 2, Math.floor(sampleRate / minFreq));
  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
  if (tauMax <= tauMin + 2) return null;

  // 1) função de diferença e 2) diferença normalizada pela média cumulativa
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    let d = 0;
    for (let j = 0; j < W; j++) {
      const x = buf[j] - buf[j + tau];
      d += x * x;
    }
    running += d;
    cmnd[tau] = running > 0 ? (d * tau) / running : 1;
  }

  // 3) primeiro vale abaixo do limiar (e desce até o fundo dele)
  let tau = -1;
  for (let t = tauMin; t < tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 < tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    // nenhum vale convincente: aceita o melhor só se ainda for razoável
    let best = tauMin;
    for (let t = tauMin; t < tauMax; t++) if (cmnd[t] < cmnd[best]) best = t;
    if (cmnd[best] > 0.3) return null;
    tau = best;
  }

  // 4) interpolação parabólica para precisão abaixo de uma amostra
  let refined = tau;
  if (tau > 1 && tau < tauMax) {
    const a = cmnd[tau - 1];
    const b = cmnd[tau];
    const c = cmnd[tau + 1];
    const denom = a - 2 * b + c;
    if (denom !== 0) refined = tau + (a - c) / (2 * denom);
  }
  const freq = sampleRate / refined;
  if (!isFinite(freq) || freq < minFreq * 0.95 || freq > maxFreq * 1.05) return null;
  return { freq, clarity: Math.max(0, Math.min(1, 1 - cmnd[tau])) };
}

// ---------- notas e cents ----------

export const A4_DEFAULT = 440;
export const A4_RANGE = { min: 430, max: 450 } as const;

export const midiToHz = (midi: number, a4 = A4_DEFAULT) => a4 * Math.pow(2, (midi - 69) / 12);
export const hzToMidi = (freq: number, a4 = A4_DEFAULT) => 69 + 12 * Math.log2(freq / a4);

/** Nota cromática mais próxima e o desvio em cents (positivo = acima da nota). */
export function nearestNote(freq: number, a4 = A4_DEFAULT): { midi: number; cents: number } {
  const exact = hzToMidi(freq, a4);
  const midi = Math.round(exact);
  return { midi, cents: (exact - midi) * 100 };
}

/** Desvio em cents em relação a uma nota-alvo específica. */
export const centsFrom = (freq: number, targetMidi: number, a4 = A4_DEFAULT) => (hzToMidi(freq, a4) - targetMidi) * 100;

/** Qual corda da afinação está mais perto do som (índice 0 = mais grave) e o desvio em relação a ela. */
export function nearestString(freq: number, tuning: number[], a4 = A4_DEFAULT): { index: number; cents: number } {
  let best = 0;
  let bestAbs = Infinity;
  tuning.forEach((m, i) => {
    const abs = Math.abs(centsFrom(freq, m, a4));
    if (abs < bestAbs) {
      bestAbs = abs;
      best = i;
    }
  });
  return { index: best, cents: centsFrom(freq, tuning[best], a4) };
}

export const IN_TUNE_CENTS = 5;
export const inTune = (cents: number) => Math.abs(cents) <= IN_TUNE_CENTS;

// ---------- estabilização ----------

/**
 * Mediana das últimas leituras: some com saltos isolados (erro de oitava, ruído) sem atrasar muito.
 * Depois de `gap` leituras sem som, esquece tudo (a corda parou de soar).
 */
export class Stabilizer {
  private values: number[] = [];
  private misses = 0;
  constructor(
    private size = 5,
    private gap = 6,
    private minValues = 3,
  ) {}
  push(freq: number | null): number | null {
    if (freq === null) {
      if (++this.misses >= this.gap) this.values = [];
      return this.values.length >= this.minValues ? median(this.values) : null;
    }
    this.misses = 0;
    this.values.push(freq);
    if (this.values.length > this.size) this.values.shift();
    return this.values.length >= this.minValues ? median(this.values) : null;
  }
  reset() {
    this.values = [];
    this.misses = 0;
  }
}

export function median(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
