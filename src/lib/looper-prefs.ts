import { loopFits } from './looper';

export interface LooperPrefs {
  bpm: number;
  bars: number;
  beats: number;
  quantized: boolean;
  countIn: boolean;
  metronome: boolean;
  latencyMs: number | null; // null = estimativa automática
}

export const BARS_OPTIONS = [1, 2, 4, 8];
export const BEATS_OPTIONS = [2, 3, 4, 6];
export const DEFAULT_LOOPER: LooperPrefs = { bpm: 100, bars: 2, beats: 4, quantized: true, countIn: true, metronome: true, latencyMs: null };

/** Preferência salva pode estar corrompida: normaliza antes de usar. */
export function normalizeLooper(raw: unknown): LooperPrefs {
  const o = (raw ?? {}) as Partial<LooperPrefs>;
  const int = (v: unknown, min: number, max: number, d: number) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d);
  const p: LooperPrefs = {
    bpm: int(o.bpm, 40, 200, DEFAULT_LOOPER.bpm),
    bars: BARS_OPTIONS.includes(o.bars as number) ? (o.bars as number) : DEFAULT_LOOPER.bars,
    beats: BEATS_OPTIONS.includes(o.beats as number) ? (o.beats as number) : DEFAULT_LOOPER.beats,
    quantized: o.quantized !== false,
    countIn: o.countIn !== false,
    metronome: o.metronome !== false,
    latencyMs: o.latencyMs === null || o.latencyMs === undefined ? null : int(o.latencyMs, 0, 500, 0),
  };
  // combinação que passa de 60 s: reduz os compassos até caber
  while (p.bars > 1 && !loopFits(p)) p.bars = BARS_OPTIONS[Math.max(0, BARS_OPTIONS.indexOf(p.bars) - 1)];
  return p;
}
