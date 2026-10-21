import { describe, expect, it } from 'vitest';
import { DAY, EASE_MAX, EASE_MIN, RELEARN_MS, bumpDay, dayKey, dueIds, gradeFirst, gradeRetry, newState, prune, streak, weakest, type SrsMap } from '../src/lib/srs';

const T0 = new Date(2026, 5, 10, 12, 0, 0).getTime();

describe('revisão espaçada', () => {
  it('acertos seguidos espaçam 1, 3 e depois por facilidade', () => {
    let s = gradeFirst(undefined, true, T0);
    expect([s.r, s.i, s.d]).toEqual([1, 1, T0 + DAY]);
    s = gradeFirst(s, true, T0 + DAY);
    expect([s.r, s.i]).toEqual([2, 3]);
    s = gradeFirst(s, true, T0 + 4 * DAY);
    expect(s.r).toBe(3);
    expect(s.i).toBeGreaterThan(3);
    expect(s.i).toBe(Math.round(3 * 2.6)); // facilidade 2,5 + 0,05 + 0,05
  });

  it('errar zera a sequência, conta o lapso, reduz a facilidade e agenda para 10 minutos', () => {
    let s = gradeFirst(undefined, true, T0);
    s = gradeFirst(s, true, T0);
    const before = s.e;
    s = gradeFirst(s, false, T0);
    expect(s).toMatchObject({ r: 0, i: 0, l: 1, d: T0 + RELEARN_MS });
    expect(s.e).toBeCloseTo(before - 0.2);
  });

  it('a facilidade nunca sai de [1,3 ; 3]', () => {
    let s = gradeFirst(undefined, false, T0);
    for (let k = 0; k < 30; k++) s = gradeFirst(s, false, T0);
    expect(s.e).toBe(EASE_MIN);
    for (let k = 0; k < 200; k++) s = gradeFirst(s, true, T0);
    expect(s.e).toBe(EASE_MAX);
  });

  it('o intervalo cresce sempre, mesmo com a facilidade mínima', () => {
    let s = { ...newState(T0), e: EASE_MIN };
    let last = 0;
    for (let k = 0; k < 8; k++) {
      s = gradeFirst(s, true, T0);
      expect(s.i).toBeGreaterThan(last);
      last = s.i;
    }
  });

  it('repetição na mesma sessão: acertar recomeça em 1 dia; errar de novo mantém 10 minutos', () => {
    const failed = gradeFirst(gradeFirst(undefined, true, T0), false, T0);
    expect(gradeRetry(failed, true, T0 + 1000)).toMatchObject({ i: 1, r: 1, d: T0 + 1000 + DAY });
    expect(gradeRetry(failed, false, T0 + 1000).d).toBe(T0 + 1000 + RELEARN_MS);
  });

  it('dueIds devolve só os vencidos, do mais atrasado ao menos, respeitando o filtro', () => {
    const map: SrsMap = {
      'note|a': { ...newState(T0), d: T0 - 3 * DAY },
      'note|b': { ...newState(T0), d: T0 - 1 * DAY },
      'chord|c': { ...newState(T0), d: T0 - 5 * DAY },
      'note|futuro': { ...newState(T0), d: T0 + DAY },
    };
    expect(dueIds(map, T0)).toEqual(['chord|c', 'note|a', 'note|b']);
    expect(dueIds(map, T0, (id) => id.startsWith('note'))).toEqual(['note|a', 'note|b']);
  });

  it('weakest ordena pela proporção de erros', () => {
    const base = newState(T0);
    const map: SrsMap = { a: { ...base, l: 1, n: 10 }, b: { ...base, l: 3, n: 4 }, c: { ...base, l: 0, n: 5 } };
    expect(weakest(map).map((w) => w.id)).toEqual(['b', 'a']);
  });

  it('prune mantém só os mais recentes quando passa do limite', () => {
    const map: SrsMap = {};
    for (let k = 0; k < 10; k++) map[`i${k}`] = { ...newState(T0), t: k };
    const out = prune(map, 4);
    expect(Object.keys(out).sort()).toEqual(['i6', 'i7', 'i8', 'i9']);
    expect(prune(map, 100)).toBe(map);
  });
});

describe('resumo diário e sequência', () => {
  it('bumpDay acumula por dia e por tipo sem alterar o mapa original', () => {
    const a = bumpDay({}, T0, 'note', true);
    const b = bumpDay(a, T0 + 1000, 'note', false);
    const c = bumpDay(b, T0 + 2000, 'chord', true);
    expect(a[dayKey(T0)]).toEqual({ n: 1, ok: 1, by: { note: [1, 1] } });
    expect(c[dayKey(T0)]).toEqual({ n: 3, ok: 2, by: { note: [2, 1], chord: [1, 1] } });
  });

  it('dayKey usa a data local', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 0, 6, 0, 1).getTime())).toBe('2026-01-06');
  });

  it('sequência: conta dias seguidos e hoje sem estudo ainda não zera', () => {
    const day = (offset: number) => new Date(2026, 5, 10 + offset, 9).getTime();
    let days = {};
    for (const o of [-3, -2, -1]) days = bumpDay(days, day(o), 'note', true);
    expect(streak(days, day(0))).toBe(3); // hoje ainda não estudou: segue 3
    days = bumpDay(days, day(0), 'note', true);
    expect(streak(days, day(0))).toBe(4);
    expect(streak(days, day(2))).toBe(0); // dois dias sem estudar
    expect(streak({}, day(0))).toBe(0);
  });

  it('sequência atravessa virada de mês e mudança de horário', () => {
    const d = (y: number, m: number, day: number) => new Date(y, m, day, 0, 30).getTime(); // 00:30: sensível ao horário de verão
    let days = {};
    for (const [y, m, day] of [[2026, 2, 29], [2026, 2, 30], [2026, 2, 31], [2026, 3, 1]]) days = bumpDay(days, d(y, m, day), 'x', true);
    expect(streak(days, d(2026, 3, 1))).toBe(4);
  });
});
