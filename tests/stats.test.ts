import { describe, expect, it } from 'vitest';
import { ActivityMeter, FLUSH_MS, IDLE_BACKING_MS, IDLE_MS, TICK_MS, sectionOf } from '../src/lib/activity';
import { addActive, bumpDay, dayKey, streak, type DaysMap } from '../src/lib/srs';
import { addDays, bestStreak, calendar, fmtMinutes, goalProgress, kindBreakdown, level, normalizeGoal, timeBySection, weekCells, weekStart, weeklyTrend } from '../src/lib/stats';

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime();
const MIN = 60000;
// 10/jun/2026 é quarta-feira
const WED = at(2026, 6, 10);

describe('semana e calendário', () => {
  it('a semana começa na segunda-feira', () => {
    expect(dayKey(weekStart(WED))).toBe('2026-06-08');
    expect(dayKey(weekStart(at(2026, 6, 14, 23)))).toBe('2026-06-08'); // domingo à noite
    expect(dayKey(weekStart(at(2026, 6, 15, 0)))).toBe('2026-06-15'); // segunda 00h
    expect(weekCells({}, WED).map((c) => c.key)).toEqual(['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13', '2026-06-14']);
  });

  it('dias futuros e hoje são marcados', () => {
    const w = weekCells({}, WED);
    expect(w.map((c) => c.future)).toEqual([false, false, false, true, true, true, true]);
    expect(w.filter((c) => c.today).map((c) => c.key)).toEqual(['2026-06-10']);
  });

  it('addDays e weekStart atravessam mês, ano e horário de verão', () => {
    expect(dayKey(addDays(at(2026, 12, 31), 1))).toBe('2027-01-01');
    expect(dayKey(addDays(at(2026, 3, 1), 30))).toBe('2026-03-31');
    for (let d = 0; d < 400; d++) expect(new Date(weekStart(addDays(at(2025, 1, 1), d))).getDay()).toBe(1); // sempre segunda
  });

  it('calendar: 12 semanas × 7 dias, contínuas, terminando na semana atual', () => {
    const cal = calendar({}, WED, 12);
    expect(cal).toHaveLength(12);
    expect(cal.every((w) => w.length === 7)).toBe(true);
    const flat = cal.flat();
    for (let i = 1; i < flat.length; i++) expect(flat[i].key > flat[i - 1].key).toBe(true);
    expect(new Set(flat.map((c) => c.key)).size).toBe(84);
    expect(cal[11][2].key).toBe('2026-06-10');
    expect(cal[0][0].key).toBe('2026-03-23');
  });
});

describe('níveis, metas e totais', () => {
  it('level combina minutos e respostas', () => {
    expect(level({ n: 0, ok: 0, by: {} })).toBe(0);
    expect(level({ n: 2, ok: 2, by: {} })).toBe(1);
    expect(level({ n: 0, ok: 0, by: {}, ms: 10 * MIN })).toBe(2);
    expect(level({ n: 0, ok: 0, by: {}, ms: 20 * MIN })).toBe(3);
    expect(level({ n: 10, ok: 5, by: {}, ms: 40 * MIN })).toBe(4);
  });

  it('meta em minutos e em respostas, só da semana atual', () => {
    let days: DaysMap = {};
    days = addActive(days, at(2026, 6, 7), 'braco', 50 * MIN); // domingo anterior: fora da semana
    days = addActive(days, at(2026, 6, 8), 'braco', 30 * MIN);
    days = addActive(days, WED, 'estudos', 20 * MIN);
    days = bumpDay(days, WED, 'note', true);
    days = bumpDay(days, WED, 'note', false);
    expect(goalProgress(days, WED, { unit: 'min', weekly: 100 })).toMatchObject({ value: 50, pct: 50, done: false, remaining: 50 });
    expect(goalProgress(days, WED, { unit: 'min', weekly: 40 })).toMatchObject({ pct: 100, done: true, remaining: 0 });
    expect(goalProgress(days, WED, { unit: 'answers', weekly: 10 })).toMatchObject({ value: 2, pct: 20 });
  });

  it('normalizeGoal corrige valores inválidos', () => {
    expect(normalizeGoal(undefined)).toEqual({ unit: 'min', weekly: 90 });
    expect(normalizeGoal({ unit: 'x', weekly: 'a' })).toEqual({ unit: 'min', weekly: 90 });
    expect(normalizeGoal({ unit: 'min', weekly: -5 }).weekly).toBe(10);
    expect(normalizeGoal({ unit: 'min', weekly: 1e9 }).weekly).toBe(1500);
    expect(normalizeGoal({ unit: 'answers', weekly: 250.6 })).toEqual({ unit: 'answers', weekly: 251 });
    expect(normalizeGoal({ unit: 'answers', weekly: NaN }).weekly).toBe(100);
  });
});

describe('sequências', () => {
  const mk = (...dates: [number, number, number][]) => dates.reduce<DaysMap>((d, [y, m, day]) => bumpDay(d, at(y, m, day), 'note', true), {});

  it('maior sequência histórica, inclusive na virada de mês/ano', () => {
    const days = mk([2025, 12, 30], [2025, 12, 31], [2026, 1, 1], [2026, 1, 2], [2026, 1, 10], [2026, 1, 11]);
    expect(bestStreak(days)).toBe(4);
    expect(bestStreak({})).toBe(0);
    expect(bestStreak(mk([2026, 6, 1]))).toBe(1);
  });

  it('dia só com tempo ativo (≥ 2 min) conta; menos que isso não', () => {
    const few = addActive({}, WED, 'braco', 1 * MIN);
    const enough = addActive({}, WED, 'braco', 2 * MIN);
    expect(streak(few, WED)).toBe(0);
    expect(streak(enough, WED)).toBe(1);
    expect(bestStreak(few)).toBe(0);
    expect(bestStreak(enough)).toBe(1);
  });
});

describe('tendência e distribuição', () => {
  it('weeklyTrend: acerto por semana, null quando não houve respostas', () => {
    let days: DaysMap = {};
    for (let i = 0; i < 4; i++) days = bumpDay(days, at(2026, 6, 1), 'note', i < 3); // semana de 1/jun: 3 de 4
    days = bumpDay(days, WED, 'note', true);
    const t = weeklyTrend(days, WED, 4);
    expect(t).toHaveLength(4);
    expect(t.map((w) => w.pct)).toEqual([null, null, 75, 100]);
    expect(t[2]).toMatchObject({ answers: 4, correct: 3 });
  });

  it('kindBreakdown: janela de 30 dias, do pior para o melhor acerto', () => {
    let days: DaysMap = {};
    days = bumpDay(bumpDay(days, WED, 'chord', true), WED, 'chord', false);
    days = bumpDay(days, addDays(WED, -5), 'note', true);
    days = bumpDay(days, addDays(WED, -40), 'interval', false); // fora da janela
    const rows = kindBreakdown(days, WED, 30);
    expect(rows.map((r) => [r.kind, r.pct, r.answers])).toEqual([['chord', 50, 2], ['note', 100, 1]]);
  });

  it('timeBySection soma por seção', () => {
    let days: DaysMap = {};
    days = addActive(days, WED, 'braco', 5 * MIN);
    days = addActive(days, addDays(WED, -1), 'braco', 3 * MIN);
    days = addActive(days, WED, 'estudos', 10 * MIN);
    expect(timeBySection(days, WED).map((r) => [r.section, r.minutes])).toEqual([['estudos', 10], ['braco', 8]]);
  });

  it('addActive: ignora zero/negativo e não altera o original', () => {
    const base: DaysMap = {};
    expect(addActive(base, WED, 'x', 0)).toBe(base);
    expect(addActive(base, WED, 'x', -5)).toBe(base);
    const out = addActive(base, WED, 'x', 1000);
    expect(base).toEqual({});
    expect(out[dayKey(WED)].ms).toBe(1000);
  });

  it('formata minutos', () => {
    expect(fmtMinutes(0)).toBe('0 min');
    expect(fmtMinutes(0.4)).toBe('<1 min');
    expect(fmtMinutes(45.4)).toBe('45 min');
    expect(fmtMinutes(125)).toBe('2 h 05 min');
  });
});

describe('medidor de tempo ativo', () => {
  it('conta enquanto há interação recente e a aba está visível', () => {
    const m = new ActivityMeter(0);
    expect(m.tick(TICK_MS, true, 'braco')).toBe(TICK_MS);
    m.interact(TICK_MS);
    expect(m.tick(2 * TICK_MS, true, 'braco')).toBe(TICK_MS);
  });

  it('aba oculta não conta (e o tempo oculto não é cobrado depois)', () => {
    const m = new ActivityMeter(0);
    expect(m.tick(TICK_MS, false, 'braco')).toBe(0);
    expect(m.tick(2 * TICK_MS, true, 'braco')).toBe(TICK_MS); // só o último intervalo
  });

  it('para de contar depois do limite de inatividade, e Backing tem limite maior', () => {
    const m = new ActivityMeter(0);
    expect(m.tick(IDLE_MS - 1, true, 'braco')).toBeGreaterThan(0);
    expect(m.tick(IDLE_MS + TICK_MS, true, 'braco')).toBe(0);
    expect(m.tick(IDLE_MS + 2 * TICK_MS, true, 'backing')).toBeGreaterThan(0);
    expect(m.tick(IDLE_BACKING_MS + TICK_MS, true, 'backing')).toBe(0);
    m.interact(IDLE_BACKING_MS + TICK_MS);
    expect(m.tick(IDLE_BACKING_MS + 2 * TICK_MS, true, 'braco')).toBeGreaterThan(0); // voltou a interagir
  });

  it('computador suspenso por horas não vira horas de estudo', () => {
    const m = new ActivityMeter(0);
    m.interact(10 * 3600 * 1000);
    expect(m.tick(10 * 3600 * 1000, true, 'braco')).toBeLessThanOrEqual(TICK_MS * 3);
  });

  it('relógio andando para trás não gera tempo negativo', () => {
    const m = new ActivityMeter(1000);
    expect(m.tick(500, true, 'braco')).toBe(0);
  });

  it('constantes coerentes', () => {
    expect(FLUSH_MS).toBeGreaterThan(TICK_MS);
    expect(IDLE_BACKING_MS).toBeGreaterThan(IDLE_MS);
  });
});

describe('seção a partir da URL', () => {
  it('mapeia rotas para seções', () => {
    const cases: [string, string][] = [['', 'braco'], ['#/', 'braco'], ['#/estudos/campo-maior', 'estudos'], ['#/referencia', 'estudos'], ['#/exercicios/note-name', 'exercicios'], ['#/treino', 'exercicios'], ['#/acordes', 'acordes'], ['#/campos?x=1', 'campos'], ['#/backing/jam', 'backing'], ['#/afinador', 'afinador'], ['#/dados', 'outros'], ['#/progresso', 'outros'], ['#/qualquer', 'outros']];
    for (const [hash, want] of cases) expect(sectionOf(hash), hash).toBe(want);
  });
});
