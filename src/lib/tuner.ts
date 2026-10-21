import { TUNINGS } from './music';
import { A4_DEFAULT, A4_RANGE } from './pitch';

export interface TunerPrefs {
  mode: 'strings' | 'chromatic';
  a4: number;
  tuningId: string;
}
export const DEFAULT_TUNER: TunerPrefs = { mode: 'strings', a4: A4_DEFAULT, tuningId: 'standard' };

/** Preferência salva pode estar corrompida: normaliza antes de usar. */
export function normalizeTuner(raw: unknown): TunerPrefs {
  const o = (raw ?? {}) as Partial<TunerPrefs>;
  const a4 = typeof o.a4 === 'number' && isFinite(o.a4) ? Math.round(o.a4) : A4_DEFAULT;
  return {
    mode: o.mode === 'chromatic' ? 'chromatic' : 'strings',
    a4: Math.min(A4_RANGE.max, Math.max(A4_RANGE.min, a4)),
    tuningId: TUNINGS.some((t) => t.id === o.tuningId) ? (o.tuningId as string) : DEFAULT_TUNER.tuningId,
  };
}
