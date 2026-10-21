import { describe, expect, it } from 'vitest';
import { CHORD_TYPES, chordFullName, chordNotes, chordSymbol, chordTypeById, detectChords, findVoicings, parseChart, parseChord } from '../src/lib/chords';
import { TUNINGS, noteLabel, pcAt } from '../src/lib/music';

const STD = TUNINGS.find((t) => t.id === 'standard')!.midi;

describe('detecção de acordes', () => {
  it('reconhece tríades e sétimas', () => {
    expect(detectChords([0, 4, 7], 0)[0]).toMatchObject({ rootPc: 0 });
    expect(detectChords([0, 4, 7], 0)[0].type.id).toBe('maj');
    expect(detectChords([2, 5, 9, 0], 2)[0].type.id).toBe('m7'); // Dm7
    expect(detectChords([7, 11, 2, 5], 7)[0].type.id).toBe('7'); // G7
    expect(detectChords([11, 2, 5, 9], 11)[0].type.id).toBe('m7b5'); // Bm7♭5
  });

  it('identifica o baixo diferente da fundamental (inversão)', () => {
    const am = detectChords([4, 9, 0], 4).find((m) => m.rootPc === 9);
    expect(am?.type.id).toBe('min');
    expect(am?.bassPc).toBe(4);
  });

  it('não devolve nada para uma nota só', () => {
    expect(detectChords([0], 0)).toEqual([]);
  });
});

describe('nomes e notas de acordes', () => {
  it('cifra e nome por extenso', () => {
    expect(chordSymbol(2, chordTypeById('m7'), 2, 'sharp')).toBe('Dm7');
    expect(chordSymbol(0, chordTypeById('maj'), 4, 'sharp')).toBe('C/E');
    expect(chordFullName(9, chordTypeById('min'), 9, 'sharp')).toBe('Lá menor');
  });

  it('grafia das notas respeita as letras (Eb G Bb)', () => {
    expect(chordNotes(3, chordTypeById('maj'), 'flat').map((n) => noteLabel(n.spelled, 'letters'))).toEqual(['E♭', 'G', 'B♭']);
    expect(chordNotes(11, chordTypeById('dim7'), 'sharp').map((n) => noteLabel(n.spelled, 'letters'))).toEqual(['B', 'D', 'F', 'A♭']);
  });

  it('todos os tipos têm id único e fórmula começando na fundamental', () => {
    expect(new Set(CHORD_TYPES.map((t) => t.id)).size).toBe(CHORD_TYPES.length);
    for (const t of CHORD_TYPES) expect(t.tokens[0]).toBe('1');
  });

  it('as notas de cada tipo (até sétimas) são reconhecidas de volta pela detecção', () => {
    for (const t of CHORD_TYPES.filter((x) => x.tokens.length >= 3 && x.tokens.length <= 4)) {
      const pcs = chordNotes(0, t, 'sharp').map((n) => n.pc);
      const found = detectChords(pcs, 0).some((m) => m.rootPc === 0 && m.type.id === t.id);
      expect(found, t.id).toBe(true);
    }
  });
});

describe('leitura de cifras', () => {
  it('parseChord entende variações de escrita', () => {
    expect(parseChord('F#m7b5')).toMatchObject({ rootPc: 6, sharp: true });
    expect(parseChord('F#m7b5')?.type.id).toBe('m7b5');
    expect(parseChord('Bb7')?.rootPc).toBe(10);
    expect(parseChord('C/E')).toMatchObject({ rootPc: 0, bassPc: 4 });
    expect(parseChord('Cmaj7')?.type.id).toBe('maj7');
    expect(parseChord('Xyz')).toBeNull();
    expect(parseChord('')).toBeNull();
  });

  it('parseChart divide compassos, repete com % e ignora comentários', () => {
    const c = parseChart('[Intro]\n# comentário\n| Am | C G | % |');
    expect(c.bars).toBe(3);
    expect(c.slots.map((s) => s.label)).toEqual(['Am', 'C', 'G', 'C', 'G']);
    expect(c.slots.map((s) => s.len)).toEqual([16, 8, 8, 8, 8]);
    expect(c.unknown).toEqual([]);
  });

  it('parseChart separa acordes desconhecidos e escolhe a grafia por bemóis', () => {
    const c = parseChart('| Bb Xz | Eb |');
    expect(c.unknown).toEqual(['Xz']);
    expect(c.pref).toBe('flat');
  });

  it('o total de cada compasso sempre fecha em 16', () => {
    const c = parseChart('| C G Am | F G C E | Dm |');
    const perBar = new Map<number, number>();
    for (const s of c.slots) perBar.set(s.bar, (perBar.get(s.bar) ?? 0) + s.len);
    for (const v of perBar.values()) expect(v).toBe(16);
  });
});

describe('digitações (voicings)', () => {
  it('toda digitação gerada soa exatamente o acorde pedido', () => {
    for (const id of ['maj', 'min', 'dim', 'sus4', 'sus2', '7', 'maj7', 'm7', 'm7b5']) {
      const type = chordTypeById(id);
      for (let root = 0; root < 12; root++) {
        const voicings = findVoicings(root, type, STD);
        expect(voicings.length, `${id} em ${root}`).toBeGreaterThan(0);
        for (const v of voicings) {
          expect(v.frets).toHaveLength(STD.length);
          const played = v.frets.flatMap((f, s) => (f >= 0 ? [pcAt(STD, s, f)] : []));
          const hit = detectChords(played, played[0]).some((m) => m.rootPc === root && m.type.id === id);
          expect(hit, `${id} em ${root}: ${v.frets.join(',')}`).toBe(true);
        }
      }
    }
  });
});
