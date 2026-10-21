/**
 * Revisão espaçada (variação simples do SM-2) e resumo diário do estudo.
 *
 * Cada item (ex.: "a nota da corda 3, casa 5") tem um estado. Quem acerta espaça mais o próximo
 * encontro (1 → 3 → 7 → ~17 dias…); quem erra volta ao começo e o item reaparece em poucos minutos.
 * Tudo aqui é puro (sem localStorage nem relógio embutido) para poder ser testado.
 */

export interface SrsState {
  e: number; // facilidade (multiplicador do intervalo)
  i: number; // intervalo atual, em dias
  d: number; // quando vence (ms)
  r: number; // acertos seguidos
  l: number; // quantas vezes errou (lapsos)
  n: number; // quantas vezes apareceu
  t: number; // última vez (ms)
}
export type SrsMap = Record<string, SrsState>;

export const DAY = 86400000;
export const RELEARN_MS = 10 * 60 * 1000; // errou: volta em 10 minutos
export const EASE_START = 2.5;
export const EASE_MIN = 1.3;
export const EASE_MAX = 3;
export const MAX_ITEMS = 4000;

export const newState = (now: number): SrsState => ({ e: EASE_START, i: 0, d: now, r: 0, l: 0, n: 0, t: 0 });

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Primeira resposta do item nesta sessão: é a que decide o agendamento. */
export function gradeFirst(prev: SrsState | undefined, ok: boolean, now: number): SrsState {
  const s = prev ?? newState(now);
  if (!ok) return { ...s, e: clamp(s.e - 0.2, EASE_MIN, EASE_MAX), i: 0, r: 0, l: s.l + 1, n: s.n + 1, t: now, d: now + RELEARN_MS };
  const r = s.r + 1;
  const i = r === 1 ? 1 : r === 2 ? 3 : Math.max(s.i + 1, Math.round(s.i * s.e));
  return { ...s, e: clamp(s.e + 0.05, EASE_MIN, EASE_MAX), i, r, n: s.n + 1, t: now, d: now + i * DAY };
}

/** Depois de errar, ao acertar na repetição da mesma sessão: o item recomeça com intervalo de 1 dia. */
export function gradeRetry(prev: SrsState, ok: boolean, now: number): SrsState {
  if (!ok) return { ...prev, t: now, d: now + RELEARN_MS };
  return { ...prev, i: 1, r: 1, t: now, d: now + DAY };
}

export const isDue = (s: SrsState, now: number) => s.d <= now;

/** Ids vencidos, do mais atrasado para o menos. */
export function dueIds(map: SrsMap, now: number, accept: (id: string) => boolean = () => true): string[] {
  return Object.entries(map)
    .filter(([id, s]) => isDue(s, now) && accept(id))
    .sort((a, b) => a[1].d - b[1].d)
    .map(([id]) => id);
}

/** Itens com mais erros em relação às vezes em que apareceram (pontos fracos). */
export function weakest(map: SrsMap, limit = 8): { id: string; lapses: number; seen: number }[] {
  return Object.entries(map)
    .filter(([, s]) => s.l > 0)
    .map(([id, s]) => ({ id, lapses: s.l, seen: s.n }))
    .sort((a, b) => b.lapses / b.seen - a.lapses / a.seen || b.lapses - a.lapses)
    .slice(0, limit);
}

/** Mantém o mapa pequeno: se passar do limite, descarta os itens vistos há mais tempo. */
export function prune(map: SrsMap, max = MAX_ITEMS): SrsMap {
  const entries = Object.entries(map);
  if (entries.length <= max) return map;
  return Object.fromEntries(entries.sort((a, b) => b[1].t - a[1].t).slice(0, max));
}

// ---------- resumo por dia (base para a sequência de dias e as estatísticas) ----------

export interface DayStat {
  n: number; // respostas
  ok: number; // acertos
  by: Record<string, [number, number]>; // por tipo: [respostas, acertos]
}
export type DaysMap = Record<string, DayStat>;

/** Data local no formato AAAA-MM-DD. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function bumpDay(map: DaysMap, ts: number, kind: string, ok: boolean): DaysMap {
  const k = dayKey(ts);
  const cur = map[k] ?? { n: 0, ok: 0, by: {} };
  const [n, a] = cur.by[kind] ?? [0, 0];
  return { ...map, [k]: { n: cur.n + 1, ok: cur.ok + (ok ? 1 : 0), by: { ...cur.by, [kind]: [n + 1, a + (ok ? 1 : 0)] } } };
}

/** Dias seguidos estudando, terminando hoje (ou ontem, se hoje ainda não começou). */
export function streak(days: DaysMap, now: number): number {
  const prevDay = (ts: number) => {
    const d = new Date(ts);
    d.setDate(d.getDate() - 1); // por data do calendário (dias de 23 ou 25 horas no horário de verão não atrapalham)
    return d.getTime();
  };
  let count = 0;
  let t = now;
  if (!days[dayKey(t)]?.n) t = prevDay(t); // hoje ainda sem estudo não quebra a sequência
  while (days[dayKey(t)]?.n) {
    count++;
    t = prevDay(t);
  }
  return count;
}
