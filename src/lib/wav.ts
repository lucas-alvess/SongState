/**
 * Áudio em memória: WAV (16 bits, mono), mistura e junção de loops. Tudo puro (sem Web Audio), para poder
 * ser testado e para que juntar loops não dependa de um AudioContext.
 */

export interface Pcm {
  samples: Float32Array;
  sampleRate: number;
}

const clamp1 = (v: number) => (v > 1 ? 1 : v < -1 ? -1 : v);

/** Bytes de um WAV PCM de 16 bits, mono. */
export function encodeWavBytes(samples: Float32Array, sampleRate: number): Uint8Array {
  const n = samples.length;
  const out = new Uint8Array(44 + n * 2);
  const v = new DataView(out.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(clamp1(samples[i]) * 32767), true);
  return out;
}

export const encodeWav = (samples: Float32Array, sampleRate: number) => new Blob([encodeWavBytes(samples, sampleRate) as BlobPart], { type: 'audio/wav' });

/** Lê um WAV PCM 16 bits (mono ou estéreo, que vira mono). Devolve null se não for um WAV que o app entenda. */
export function decodeWav(input: ArrayBuffer | Uint8Array): Pcm | null {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 44) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  let pos = 12;
  let fmt: { channels: number; rate: number; bits: number; format: number } | null = null;
  while (pos + 8 <= bytes.length) {
    const id = tag(pos);
    const size = v.getUint32(pos + 4, true);
    const body = pos + 8;
    if (id === 'fmt ' && body + 16 <= bytes.length) fmt = { format: v.getUint16(body, true), channels: v.getUint16(body + 2, true), rate: v.getUint32(body + 4, true), bits: v.getUint16(body + 14, true) };
    if (id === 'data') {
      if (!fmt || fmt.format !== 1 || fmt.bits !== 16 || fmt.channels < 1 || fmt.channels > 2 || fmt.rate < 8000 || fmt.rate > 192000) return null;
      const avail = Math.min(size, bytes.length - body);
      const frames = Math.floor(avail / (2 * fmt.channels));
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let s = 0;
        for (let c = 0; c < fmt.channels; c++) s += v.getInt16(body + (i * fmt.channels + c) * 2, true);
        samples[i] = s / fmt.channels / 32768;
      }
      return { samples, sampleRate: fmt.rate };
    }
    pos = body + size + (size % 2);
  }
  return null;
}

/** Reamostragem linear (suficiente para juntar loops gravados em placas de som diferentes). */
export function resample(samples: Float32Array, from: number, to: number): Float32Array {
  if (from === to || !samples.length) return samples;
  const n = Math.max(1, Math.round((samples.length * to) / from));
  const out = new Float32Array(n);
  const ratio = (samples.length - 1) / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    const p = i * ratio;
    const k = Math.floor(p);
    const f = p - k;
    out[i] = samples[k] * (1 - f) + samples[Math.min(samples.length - 1, k + 1)] * f;
  }
  return out;
}

export const peakOf = (s: Float32Array) => s.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

/** Repete o áudio até ter `length` amostras (a última repetição é cortada). */
export function tileTo(samples: Float32Array, length: number): Float32Array {
  if (samples.length === length || !samples.length) return samples.length === length ? samples : new Float32Array(length);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = samples[i % samples.length];
  return out;
}

export interface Layer {
  samples: Float32Array;
  vol: number;
  mute: boolean;
}

/** Soma as camadas (com volume e mudo). O resultado nunca passa de ±1: se passar, tudo é reduzido na mesma proporção. */
export function mixLayers(layers: Layer[], length?: number): Float32Array {
  const active = layers.filter((l) => !l.mute && l.vol > 0 && l.samples.length);
  const n = length ?? Math.max(0, ...layers.map((l) => l.samples.length));
  const out = new Float32Array(n);
  for (const l of active) {
    const s = l.samples.length === n ? l.samples : tileTo(l.samples, n);
    for (let i = 0; i < n; i++) out[i] += s[i] * l.vol;
  }
  const peak = peakOf(out);
  if (peak > 0.98) {
    const k = 0.98 / peak;
    for (let i = 0; i < n; i++) out[i] *= k;
  }
  return out;
}

/** Une vários trechos, um depois do outro. */
export function chain(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * Mede a latência de ida e volta (alto-falante → microfone): acha o primeiro instante em que o sinal
 * gravado passa de uma fração do pico e compara com o momento em que o clique foi tocado.
 * Devolve segundos, ou null se o clique não foi ouvido com clareza.
 */
export function findOnset(data: Float32Array, sampleRate: number, clickAt: number, minPeak = 0.02): number | null {
  const from = Math.max(0, Math.floor((clickAt - 0.02) * sampleRate));
  let peak = 0;
  for (let i = from; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak < minPeak) return null;
  const threshold = peak * 0.3;
  for (let i = from; i < data.length; i++) if (Math.abs(data[i]) >= threshold) return Math.max(0, i / sampleRate - clickAt);
  return null;
}
