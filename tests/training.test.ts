import { describe, expect, it } from 'vitest';
import { CATEGORIES, KIND_TITLE, buildCard, isCorrect, kindOfId, kindsOf, planSession, randomId, type Ctx, type Kind } from '../src/lib/training';
import { DAY, newState, type SrsMap } from '../src/lib/srs';
import { TUNINGS, pcAt } from '../src/lib/music';
import { chordPcs } from '../src/lib/chords';

/** Sorteio com semente, para os testes serem repetíveis. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KINDS = Object.keys(KIND_TITLE) as Kind[];
const CTXS: Ctx[] = [
  { tuningId: 'standard', pref: 'sharp', lang: 'letters' },
  { tuningId: 'standard', pref: 'flat', lang: 'latin' },
  { tuningId: TUNINGS[3].id, pref: 'sharp', lang: 'latin' },
];

describe('cartões', () => {
  it('toda categoria tem tipos, e todo tipo pertence a uma categoria', () => {
    expect(kindsOf(CATEGORIES.map((c) => c.id)).sort()).toEqual([...KINDS].sort());
  });

  it('milhares de cartões sorteados: todos válidos, com resposta dentro das alternativas e sem alternativas repetidas', () => {
    const rng = seeded(42);
    for (const ctx of CTXS) {
      for (const kind of KINDS) {
        for (let n = 0; n < 400; n++) {
          const id = randomId(kind, ctx, rng);
          const card = buildCard(id, ctx, rng);
          expect(card, id).not.toBeNull();
          const c = card!;
          expect(c.id).toBe(id);
          expect(kindOfId(id)).toBe(kind);
          expect(c.prompt.length, id).toBeGreaterThan(3);
          expect(c.explain.length, id).toBeGreaterThan(5);
          expect(c.answer.length, id).toBeGreaterThan(0);
          if (c.choices) {
            const keys = c.choices.map((x) => x.key);
            expect(new Set(keys).size, `chaves repetidas em ${id}`).toBe(keys.length);
            const labels = c.choices.map((x) => x.label);
            expect(new Set(labels).size, `rótulos repetidos em ${id}: ${labels}`).toBe(labels.length);
            for (const a of c.answer) expect(keys, id).toContain(a);
            expect(c.choices.length).toBeGreaterThanOrEqual(4);
          } else {
            expect(c.board?.clickable, id).toBe(true);
          }
        }
      }
    }
  });

  it('o mesmo id sempre gera a mesma pergunta e a mesma resposta (mesmo com alternativas embaralhadas)', () => {
    const ctx = CTXS[0];
    for (const kind of KINDS) {
      const id = randomId(kind, ctx, seeded(7));
      const a = buildCard(id, ctx, seeded(1))!;
      const b = buildCard(id, ctx, seeded(2))!;
      expect(a.prompt).toBe(b.prompt);
      expect(a.answer).toEqual(b.answer);
      // as alternativas erradas podem variar, mas a resposta certa sempre está entre elas
      if (a.choices && b.choices) for (const k of a.answer) expect([a, b].every((c) => c.choices!.some((x) => x.key === k))).toBe(true);
    }
  });

  it('nota no braço: a resposta é a nota real da casa', () => {
    const t = TUNINGS.find((x) => x.id === 'standard')!;
    const c = buildCard('note|standard|2|5', CTXS[0])!; // 3ª corda mais grave (Ré), casa 5 = Sol
    expect(c.answer).toEqual([`pc:${pcAt(t.midi, 2, 5)}`]);
    expect(c.answer).toEqual(['pc:7']);
    expect(c.sub).toBe('Corda 4, casa 5'); // numeração musical: 1 = a mais aguda
  });

  it('encontrar a nota: só a corda pedida é clicável e a resposta casa com o braço', () => {
    const c = buildCard('find|standard|1|7', CTXS[0])!; // corda índice 1 (A), nota Sol
    expect(c.board!.stringsOff).toEqual([0, 2, 3, 4, 5]);
    expect(c.answer).toEqual(['1:7']);
    expect(c.explain).toContain('casa 10');
    expect(isCorrect(c, '1:7')).toBe(true);
    expect(isCorrect(c, '2:7')).toBe(false);
  });

  it('intervalo e grau têm respostas musicalmente corretas', () => {
    expect(buildCard('interval|0|7', CTXS[0])!.answer).toEqual(['pc:7']); // 5ª justa acima de Dó = Sol
    expect(buildCard('interval|4|3', CTXS[0])!.answer).toEqual(['pc:7']); // 3ª menor acima de Mi = Sol
    expect(buildCard('interval|0|6', CTXS[0])!.answer).toEqual(['pc:6']); // trítono
    expect(buildCard('degree|major|7|6', CTXS[0])!.answer).toEqual(['pc:6']); // 7º grau de Sol maior = Fá♯
    expect(buildCard('degree|minor-pent|9|2', CTXS[0])!.answer).toEqual(['pc:2']); // Lá pent. menor: A C D
  });

  it('acorde pelas notas: as alternativas erradas não têm as mesmas notas da certa', () => {
    const rng = seeded(3);
    for (let n = 0; n < 300; n++) {
      const c = buildCard(randomId('chord', CTXS[0], rng), CTXS[0], rng)!;
      const [r, t] = c.answer[0].split(':').slice(1);
      const want = [...new Set(chordPcs(Number(r), t))].sort((a, b) => a - b).join(',');
      for (const ch of c.choices!) {
        const [r2, t2] = ch.key.split(':').slice(1);
        const same = [...new Set(chordPcs(Number(r2), t2))].sort((a, b) => a - b).join(',') === want;
        expect(same, `${c.id}: ${ch.key}`).toBe(ch.key === c.answer[0]);
      }
    }
  });

  it('campos harmônicos: Sol maior, grau IV = C e C = IV', () => {
    const a = buildCard('fieldchord|major|7|4|3', CTXS[0])!;
    expect(a.choices![0].label).toBe('G');
    expect(a.choices!.find((x) => a.answer.includes(x.key))!.label).toBe('C');
    const b = buildCard('fielddeg|major|7|4|4', CTXS[0])!; // tétrade: Cmaj7 é o IVmaj7
    expect(b.prompt).toContain('Cmaj7');
    expect(b.choices!.find((x) => b.answer.includes(x.key))!.label).toMatch(/^IV/);
  });

  it('ids inválidos ou adulterados viram null, sem lançar erro', () => {
    const bad = ['', 'x', 'note', 'note|standard|9|3', 'note|standard|0|13', 'note|inexistente|0|0', 'find|standard|0|12', 'interval|0|0', 'interval|12|3', 'degree|nope|0|1', 'degree|major|0|7', 'chord|0|nope', 'fieldchord|major|0|8|3', 'fieldchord|major|0|1|5', 'fielddeg|x|y|z|w', '__proto__|a', 'note|standard|-1|2', 'note|standard|1e3|2'];
    for (const id of bad) expect(() => buildCard(id, CTXS[0]), id).not.toThrow();
    for (const id of bad) expect(buildCard(id, CTXS[0]), id).toBeNull();
  });
});

describe('montagem da sessão', () => {
  const ctx = CTXS[0];
  const now = new Date(2026, 5, 10, 12).getTime();

  it('sessão nova: tamanho pedido, sem repetições, só dos tipos escolhidos', () => {
    const plan = planSession({ srs: {}, now, size: 12, kinds: ['note', 'chord'], ctx, rng: seeded(1) });
    expect(plan.ids).toHaveLength(12);
    expect(new Set(plan.ids).size).toBe(12);
    expect(plan.due).toBe(0);
    expect(plan.fresh).toBe(12);
    for (const id of plan.ids) expect(['note', 'chord']).toContain(kindOfId(id));
    expect(plan.ids.some((i) => kindOfId(i) === 'note') && plan.ids.some((i) => kindOfId(i) === 'chord')).toBe(true);
  });

  it('revisões vencidas entram primeiro e itens ainda não vencidos ficam de fora', () => {
    const srs: SrsMap = {
      'note|standard|0|0': { ...newState(now), d: now - 2 * DAY },
      'chord|0|maj': { ...newState(now), d: now - DAY },
      'interval|0|7': { ...newState(now), d: now + 3 * DAY },
    };
    const plan = planSession({ srs, now, size: 10, kinds: ['note', 'chord', 'interval'], ctx, rng: seeded(2) });
    expect(plan.due).toBe(2);
    expect(plan.ids).toContain('note|standard|0|0');
    expect(plan.ids).toContain('chord|0|maj');
    expect(plan.ids).not.toContain('interval|0|7');
    expect(plan.ids).toHaveLength(10);
  });

  it('vencidos de tipos desligados ou com id inválido são ignorados', () => {
    const srs: SrsMap = { 'chord|0|maj': { ...newState(now), d: now - DAY }, 'note|lixo|9|9': { ...newState(now), d: now - DAY } };
    const plan = planSession({ srs, now, size: 5, kinds: ['note'], ctx, rng: seeded(3) });
    expect(plan.due).toBe(0);
    expect(plan.ids.every((i) => i.startsWith('note|standard'))).toBe(true);
  });

  it('muitos vencidos: não passa do tamanho da sessão', () => {
    const srs: SrsMap = {};
    for (let f = 0; f <= 12; f++) srs[`note|standard|0|${f}`] = { ...newState(now), d: now - DAY };
    const plan = planSession({ srs, now, size: 5, kinds: ['note'], ctx, rng: seeded(4) });
    expect(plan.ids).toHaveLength(5);
    expect(plan.due).toBe(5);
  });

  it('universo pequeno já todo visto: completa a sessão com reforço sem travar', () => {
    const srs: SrsMap = {};
    for (let s = 0; s < 6; s++) for (let f = 0; f <= 12; f++) srs[`note|standard|${s}|${f}`] = { ...newState(now), d: now + 5 * DAY };
    const plan = planSession({ srs, now, size: 10, kinds: ['note'], ctx, rng: seeded(5) });
    expect(plan.ids).toHaveLength(10);
    expect(new Set(plan.ids).size).toBe(10);
  });

  it('sem tipos escolhidos: sessão vazia', () => {
    expect(planSession({ srs: {}, now, size: 10, kinds: [], ctx }).ids).toEqual([]);
  });
});
