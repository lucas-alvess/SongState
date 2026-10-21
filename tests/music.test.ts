import { describe, expect, it } from 'vitest';
import { SCALES, TUNINGS, buildScale, noteLabel, pcAt, scaleById, scalePositions, tokenSemis } from '../src/lib/music';

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
