import { describe, expect, it } from 'vitest';
import { SCALES, TUNINGS, buildScale, cagedPositions, mod12, noteLabel, pcAt, scaleById, scalePositions, tokenSemis, tuningById } from '../src/lib/music';

const names = (id: string, root: number, pref: 'sharp' | 'flat' = 'sharp') => buildScale(scaleById(id), root, pref).notes.map((n) => noteLabel(n.spelled, 'letters'));
const STD = TUNINGS.find((t) => t.id === 'standard')!;

describe('escalas', () => {
  it('soletra escalas conhecidas com as letras corretas', () => {
    expect(names('major', 0)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(names('major', 7)).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F♯']);
    expect(names('major', 3, 'flat')).toEqual(['E♭', 'F', 'G', 'A♭', 'B♭', 'C', 'D']);
    expect(names('natural-minor', 9)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(names('minor-pent', 9)).toEqual(['A', 'C', 'D', 'E', 'G']);
  });

  it('todas as escalas, em todas as tônicas, têm notas distintas e crescentes em semitons', () => {
    for (const def of SCALES) {
      for (let root = 0; root < 12; root++) {
        const s = buildScale(def, root, root % 2 ? 'flat' : 'sharp');
        expect(s.notes.length, def.id).toBe(def.formula.length);
        expect(new Set(s.notes.map((n) => n.pc)).size, `${def.id} em ${root}`).toBe(def.formula.length);
        expect(s.notes[0].pc).toBe(root);
        const semis = s.notes.map((n) => n.semis);
        expect([...semis].sort((a, b) => a - b), def.id).toEqual(semis);
      }
    }
  });

  it('tokenSemis converte graus (e extensões, reduzidas à oitava)', () => {
    expect(['1', 'b3', '3', '5', 'b7', '7'].map(tokenSemis)).toEqual([0, 3, 4, 7, 10, 11]);
    expect(tokenSemis('9')).toBe(2);
    expect(tokenSemis('b9')).toBe(1);
    expect(tokenSemis('13')).toBe(9);
  });
});

describe('afinações e braço', () => {
  it('afinação padrão: E A D G B E', () => {
    expect(STD.midi.map((_, i) => pcAt(STD.midi, i, 0))).toEqual([4, 9, 2, 7, 11, 4]);
    expect(pcAt(STD.midi, 0, 12)).toBe(4); // a casa 12 repete a corda solta
  });

  it('posições de escala só usam notas da escala e cobrem todas as cordas', () => {
    for (const id of ['major', 'natural-minor', 'minor-pent', 'major-pent', 'dorian', 'blues-minor']) {
      for (const root of [0, 4, 9, 11]) {
        const scale = buildScale(scaleById(id), root, 'sharp');
        const inScale = new Set(scale.notes.map((n) => n.pc));
        const positions = scalePositions(scale, STD.midi);
        expect(positions.length, id).toBe(scale.notes.length);
        for (const p of positions) {
          expect(p.notes.length).toBeGreaterThan(0);
          for (const n of p.notes) {
            expect(inScale.has(n.pc), `${id} pos ${p.label}`).toBe(true);
            expect(pcAt(STD.midi, n.string, n.fret)).toBe(n.pc);
            expect(n.fret).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });
});

describe('5 formas (CAGED) das escalas de 7 notas', () => {
  const std = tuningById('standard').midi;
  const strings = ['E', 'A', 'D', 'G', 'B', 'e'];
  /** "E:5,7,8 A:... e:..." de uma forma, em uma das regiões do braço. */
  const shape = (cl: { string: number; fret: number }[]) => strings.map((n, s) => `${n}:${cl.filter((x) => x.string === s).map((x) => x.fret).sort((a, b) => a - b).join(',')}`).join(' ');
  const aMinor = () => cagedPositions(buildScale(scaleById('natural-minor'), 9, 'sharp'), std)!;
  const has = (p: ReturnType<typeof aMinor>[number], text: string) => p.clusters.map(shape).includes(text);

  it('Lá menor natural: as 5 formas conhecidas (caixas 5–8, 7–10, 9–13, 12–15 e 14–17)', () => {
    const p = aMinor();
    expect(p).toHaveLength(5);
    expect(has(p[0], 'E:5,7,8 A:5,7,8 D:5,7 G:5,7 B:5,6,8 e:5,7,8')).toBe(true);
    expect(has(p[1], 'E:7,8,10 A:7,8,10 D:7,9,10 G:7,9,10 B:8,10 e:7,8,10')).toBe(true);
    expect(has(p[2], 'E:10,12,13 A:10,12 D:9,10,12 G:9,10,12 B:10,12,13 e:10,12,13')).toBe(true);
    expect(has(p[3], 'E:12,13,15 A:12,14,15 D:12,14,15 G:12,14 B:12,13,15 e:12,13,15')).toBe(true);
    expect(has(p[4], 'E:15,17 A:14,15,17 D:14,15,17 G:14,16,17 B:15,17 e:15,17')).toBe(true);
  });

  it('Dó maior tem as mesmas 5 caixas (é a mesma escala), começando na caixa da tônica', () => {
    const c = cagedPositions(buildScale(scaleById('major'), 0, 'sharp'), std)!;
    const a = aMinor();
    const all = (ps: typeof a) => new Set(ps.flatMap((p) => p.clusters.map(shape)));
    expect(all(c)).toEqual(all(a));
    expect(c[0].clusters.length).toBeGreaterThan(0);
  });

  it('modos usam as caixas da maior "pai": Ré dórico = Dó maior', () => {
    const d = cagedPositions(buildScale(scaleById('dorian'), 2, 'sharp'), std)!;
    const c = cagedPositions(buildScale(scaleById('major'), 0, 'sharp'), std)!;
    const all = (ps: typeof d) => new Set(ps.flatMap((p) => p.clusters.map(shape)));
    expect(all(d)).toEqual(all(c));
  });

  it('só notas da escala; as 5 formas juntas cobrem o braço todo (sem buracos) em toda tônica e escala de 7 notas', () => {
    for (let root = 0; root < 12; root++) {
      for (const def of SCALES.filter((s) => s.formula.length === 7)) {
        const sc = buildScale(def, root, 'sharp');
        const p = cagedPositions(sc, std)!;
        expect(p).toHaveLength(5);
        const covered = new Set<string>();
        for (const pos of p) for (const n of pos.notes) {
          expect(sc.byPc.has(n.pc)).toBe(true);
          expect(n.pc).toBe(mod12(std[n.string] + n.fret));
          covered.add(`${n.string}:${n.fret}`);
        }
        const lo = Math.min(...p.flatMap((x) => x.notes.map((n) => n.fret)));
        // da primeira à última nota coberta, nenhuma nota da escala fica de fora (entre as casas 5 e 15)
        for (let s = 0; s < 6; s++) for (let f = Math.max(lo, 5); f <= 15; f++) if (sc.byPc.has(mod12(std[s] + f))) expect(covered.has(`${s}:${f}`)).toBe(true);
      }
    }
  });

  it('escalas que não têm 5 formas (pentatônicas, blues, 8 notas) seguem com as posições de sempre', () => {
    expect(cagedPositions(buildScale(scaleById('minor-pent'), 9, 'sharp'), std)).toBeNull();
    expect(scalePositions(buildScale(scaleById('minor-pent'), 9, 'sharp'), std, 'caged')).toHaveLength(5);
    expect(scalePositions(buildScale(scaleById('diminished'), 0, 'sharp'), std, 'caged')).toHaveLength(8);
  });

  it('sistema padrão continua sendo 7 posições (as lições dependem disso) e funciona em outras afinações', () => {
    const sc = buildScale(scaleById('natural-minor'), 9, 'sharp');
    expect(scalePositions(sc, std)).toHaveLength(7);
    expect(scalePositions(sc, std, 'seven')).toHaveLength(7);
    expect(scalePositions(sc, std, 'caged')).toHaveLength(5);
    for (const t of TUNINGS) expect(() => scalePositions(sc, t.midi, 'caged')).not.toThrow();
  });
});
