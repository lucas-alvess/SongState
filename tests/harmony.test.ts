import { describe, expect, it } from 'vitest';
import { chordPcs, chordTypeById } from '../src/lib/chords';
import { CIRCLE_ORDER, FIELDS, buildField, fieldById, parentMajor, signatureOf } from '../src/lib/harmony';

const field = (id: string, root: number, pref: 'sharp' | 'flat' = 'sharp') => buildField(fieldById(id), root, pref);

describe('campos harmônicos', () => {
  it('Dó maior: acordes, graus e funções', () => {
    const f = field('major', 0);
    expect(f.chords.map((c) => c.symbol)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    expect(f.chords.map((c) => c.symbolTetrad)).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5']);
    expect(f.chords.map((c) => c.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(f.chords.map((c) => c.func)).toEqual(['T', 'SD', 'T', 'SD', 'D', 'T', 'D']);
  });

  it('Lá menor natural e harmônica', () => {
    expect(field('natural-minor', 9).chords.map((c) => c.symbol)).toEqual(['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']);
    const h = field('harmonic-minor', 9);
    expect(h.chords[4].symbolTetrad).toBe('E7'); // V7 da menor harmônica
    expect(h.chords[6].symbolTetrad).toBe('G♯dim7');
  });

  it('a grafia usa bemóis quando pedido', () => {
    expect(field('major', 5, 'flat').chords.map((c) => c.symbol)).toEqual(['F', 'Gm', 'Am', 'B♭', 'C', 'Dm', 'Edim']);
  });

  it('todos os campos, em todos os tons: 7 acordes coerentes com as notas da escala', () => {
    for (const def of FIELDS) {
      for (let root = 0; root < 12; root++) {
        const f = buildField(def, root, root % 2 ? 'flat' : 'sharp');
        const inScale = new Set(f.scale.notes.map((n) => n.pc));
        expect(f.chords, `${def.id} ${root}`).toHaveLength(7);
        for (const c of f.chords) {
          const triad = chordPcs(c.rootPc, c.triad.id);
          const tetrad = chordPcs(c.rootPc, c.tetrad.id);
          for (const pc of tetrad) expect(inScale.has(pc), `${def.id} ${root} ${c.symbolTetrad}`).toBe(true);
          expect(tetrad.slice(0, 3)).toEqual(triad); // a tétrade contém a tríade
          expect(c.symbol.length).toBeGreaterThan(0);
          expect(c.fullName.length).toBeGreaterThan(0);
          expect(c.roman.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('os ids dos campos são únicos e cada um aponta para uma escala existente', () => {
    expect(new Set(FIELDS.map((f) => f.id)).size).toBe(FIELDS.length);
    for (const def of FIELDS) expect(() => buildField(def, 0, 'sharp')).not.toThrow();
  });

  it('a tríade de cada grau tem a qualidade esperada no campo maior', () => {
    const ids = field('major', 7).chords.map((c) => c.triad.id);
    expect(ids).toEqual(['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim']);
    expect(chordTypeById('maj').tokens).toEqual(['1', '3', '5']);
  });
});

describe('armaduras e círculo de quintas', () => {
  it('conta sustenidos e bemóis', () => {
    expect(signatureOf(0)).toMatchObject({ count: 0 });
    expect(signatureOf(7)).toMatchObject({ count: 1, kind: '♯', letters: ['F'] });
    expect(signatureOf(5)).toMatchObject({ count: -1, kind: '♭', letters: ['B'] });
    expect(signatureOf(2).count).toBe(2); // Ré maior
    expect(signatureOf(3).count).toBe(-3); // Mi♭ maior
  });

  it('o círculo tem as 12 notas, cada uma uma quinta acima da anterior', () => {
    expect(new Set(CIRCLE_ORDER).size).toBe(12);
    CIRCLE_ORDER.forEach((pc, i) => expect(CIRCLE_ORDER[(i + 1) % 12]).toBe((pc + 7) % 12));
  });

  it('o maior paralelo de cada modo bate com a escala maior correspondente', () => {
    expect(parentMajor(fieldById('natural-minor'), 9)).toBe(0); // Lá menor ← Dó maior
    expect(parentMajor(fieldById('dorian'), 2)).toBe(0); // Ré dórico ← Dó maior
  });
});
