/**
 * Cálculos das estatísticas de estudo (página Progresso). Tudo puro: recebe o resumo diário (`ss.days`)
 * e o "agora", sem ler relógio nem armazenamento. A semana começa na segunda-feira.
 */
import { MIN_STUDY_MS, dayKey, type DaysMap, type DayStat } from './srs';

export interface Goal {
  unit: 'min' | 'answers';
  weekly: number;
}
export const DEFAULT_GOAL: Goal = { unit: 'min', weekly: 90 };
export const GOAL_LIMITS = { min: { min: 10, max: 1500 }, answers: { min: 10, max: 5000 } } as const;

export const EMPTY: DayStat = { n: 0, ok: 0, by: {} };
const at = (days: DaysMap, ts: number): DayStat => days[dayKey(ts)] ?? EMPTY;
export const minutesOf = (d: DayStat) => (d.ms ?? 0) / 60000;
export const studied = (d: DayStat) => d.n > 0 || (d.ms ?? 0) >= MIN_STUDY_MS;

/** Normaliza meta vinda do armazenamento (pode estar corrompida). */
export function normalizeGoal(g: unknown): Goal {
  const o = (g ?? {}) as Partial<Goal>;
  const unit = o.unit === 'answers' ? 'answers' : 'min';
  const lim = GOAL_LIMITS[unit];
  const w = typeof o.weekly === 'number' && isFinite(o.weekly) ? Math.round(o.weekly) : unit === 'min' ? DEFAULT_GOAL.weekly : 100;
  return { unit, weekly: Math.min(lim.max, Math.max(lim.min, w)) };
}

/** Meia-noite local da segunda-feira da semana de `ts`. */
export function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** Soma `n` dias de calendário (seguro em mudança de horário). */
export function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export interface DayCell {
  key: string;
  ts: number;
  stat: DayStat;
  minutes: number;
  future: boolean;
  today: boolean;
}

function cell(days: DaysMap, ts: number, now: number): DayCell {
  const stat = at(days, ts);
  return { key: dayKey(ts), ts, stat, minutes: minutesOf(stat), future: dayKey(ts) > dayKey(now), today: dayKey(ts) === dayKey(now) };
}

/** Os 7 dias da semana atual, de segunda a domingo. */
export function weekCells(days: DaysMap, now: number): DayCell[] {
  const start = weekStart(now);
  return Array.from({ length: 7 }, (_, i) => cell(days, addDays(start, i), now));
}

/** Uma grade de `weeks` semanas (colunas) × 7 dias (linhas), terminando na semana atual. */
export function calendar(days: DaysMap, now: number, weeks = 12): DayCell[][] {
  const first = addDays(weekStart(now), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => cell(days, addDays(first, w * 7 + d), now)));
}

/** Nível de intensidade 0–4 de um dia (0 = nada). Combina minutos ativos e respostas. */
export function level(stat: DayStat): 0 | 1 | 2 | 3 | 4 {
  const v = minutesOf(stat) + stat.n * 0.3;
  if (v <= 0) return 0;
  if (v < 5) return 1;
  if (v < 15) return 2;
  if (v < 30) return 3;
  return 4;
}

export interface Totals {
  minutes: number;
  answers: number;
  correct: number;
  days: number; // dias com estudo
}
export function sumCells(cells: DayCell[]): Totals {
  return cells.reduce<Totals>((t, c) => ({ minutes: t.minutes + c.minutes, answers: t.answers + c.stat.n, correct: t.correct + c.stat.ok, days: t.days + (studied(c.stat) ? 1 : 0) }), { minutes: 0, answers: 0, correct: 0, days: 0 });
}

export interface GoalProgress {
  value: number;
  target: number;
  pct: number; // 0–100 (limitado)
  done: boolean;
  remaining: number;
}
export function goalProgress(days: DaysMap, now: number, goal: Goal): GoalProgress {
  const t = sumCells(weekCells(days, now));
  const value = goal.unit === 'min' ? Math.round(t.minutes) : t.answers;
  return { value, target: goal.weekly, pct: Math.min(100, Math.round((value / goal.weekly) * 100)), done: value >= goal.weekly, remaining: Math.max(0, goal.weekly - value) };
}

/** Maior sequência de dias seguidos já registrada. */
export function bestStreak(days: DaysMap): number {
  const keys = Object.keys(days).filter((k) => studied(days[k])).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    const expected = prev ? dayKey(addDays(new Date(`${prev}T12:00:00`).getTime(), 1)) : null; // meio-dia: imune a horário de verão
    run = expected === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

export interface WeekPoint {
  start: number;
  answers: number;
  correct: number;
  pct: number | null; // null = nenhuma resposta na semana
  minutes: number;
}
/** Taxa de acerto semana a semana (da mais antiga para a atual). */
export function weeklyTrend(days: DaysMap, now: number, weeks = 8): WeekPoint[] {
  const first = addDays(weekStart(now), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) => {
    const start = addDays(first, w * 7);
    const t = sumCells(Array.from({ length: 7 }, (_, d) => cell(days, addDays(start, d), now)));
    return { start, answers: t.answers, correct: t.correct, pct: t.answers ? Math.round((t.correct / t.answers) * 100) : null, minutes: t.minutes };
  });
}

export interface KindRow {
  kind: string;
  answers: number;
  correct: number;
  pct: number;
}
/** Acerto por tipo de pergunta nos últimos `span` dias (inclui hoje). */
export function kindBreakdown(days: DaysMap, now: number, span = 30): KindRow[] {
  const acc = new Map<string, [number, number]>();
  for (let i = 0; i < span; i++) {
    for (const [k, [n, a]] of Object.entries(at(days, addDays(now, -i)).by)) {
      const [pn, pa] = acc.get(k) ?? [0, 0];
      acc.set(k, [pn + n, pa + a]);
    }
  }
  return [...acc].map(([kind, [answers, correct]]) => ({ kind, answers, correct, pct: Math.round((correct / answers) * 100) })).filter((r) => r.answers > 0).sort((a, b) => a.pct - b.pct || b.answers - a.answers);
}

/** Tempo ativo por seção nos últimos `span` dias, do maior para o menor. */
export function timeBySection(days: DaysMap, now: number, span = 30): { section: string; minutes: number }[] {
  const acc = new Map<string, number>();
  for (let i = 0; i < span; i++) for (const [s, ms] of Object.entries(at(days, addDays(now, -i)).pg ?? {})) acc.set(s, (acc.get(s) ?? 0) + ms);
  return [...acc].map(([section, ms]) => ({ section, minutes: ms / 60000 })).filter((r) => r.minutes > 0).sort((a, b) => b.minutes - a.minutes);
}

export const fmtMinutes = (m: number) => (m < 1 ? (m > 0 ? '<1 min' : '0 min') : m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`);

