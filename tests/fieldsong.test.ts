import { describe, expect, it } from 'vitest';
import { chordPcs, parseChart } from '../src/lib/chords';
import { MAX_PROGRESSION, cleanDegrees, fieldChart, fieldSong, fieldSongId } from '../src/lib/fieldsong';
import { FIELDS, buildField, parentMajor, signatureOf } from '../src/lib/harmony';
import { makeSlot } from '../src/lib/jam';
import { sanitizeSong } from '../src/lib/songs';

/** Grafia que o app usa de fato (a armadura decide entre sustenidos e bemóis). */
const autoPref = (def: (typeof FIELDS)[number], root: number) => (signatureOf(parentMajor(def, root)).count < 0 ? 'flat' : 'sharp');
const setOf = (pcs: number[]) => [...new Set(pcs)].sort((a, b) => a - b).join(',');

describe('campo harmônico → música do Backing', () => {
  it('Sol maior, I – V – vi – IV', () => {
    const f = buildField(FIELDS.find((x) => x.id === 'major')!, 7, 'sharp');
    expect(fieldChart(f, [1, 5, 6, 4], false)).toBe('| G | D | Em | C |');
    expect(fieldChart(f, [2, 5, 1], true)).toBe('| Am7 | D7 | Gmaj7 |');
    const s = fieldSong(f, [1, 5, 6, 4], false, 'letters')!;
    expect(s).toMatchObject({ keyPc: 7, minor: false, style: 'rock', tags: ['campo harmônico', 'Maior'] });
    expect(s.title).toBe('G Maior: I – V – vi – IV');
    expect(s.id).toBe('campo-major-7-1564-3');
  });

  it('campo menor marca a música como menor e usa os acordes do campo', () => {
    const f = buildField(FIELDS.find((x) => x.id === 'natural-minor')!, 9, 'sharp');
    expect(fieldSong(f, [1, 6, 7], false, 'latin')!.minor).toBe(true);
    expect(fieldChart(f, [1, 6, 3, 7], false)).toBe('| Am | F | C | G |');
  });

  it.each(['auto', 'sharp', 'flat'] as const)('para TODO campo, tom, tipo de acorde e progressão (grafia %s): a cifra é lida de volta com os mesmos acordes', (pref) => {
    for (const def of FIELDS) {
      for (let root = 0; root < 12; root++) {
        for (const tetrad of [false, true]) {
          const field = buildField(def, root, pref === 'auto' ? autoPref(def, root) : pref);
          const sequences = [...def.progressions.map((p) => p.degrees), [1, 2, 3, 4, 5, 6, 7], [7, 6, 5, 4, 3, 2, 1]];
          for (const degrees of sequences) {
            const chart = parseChart(fieldChart(field, degrees, tetrad));
            expect(chart.unknown, `${def.id} ${root} ${degrees}`).toEqual([]);
            expect(chart.slots).toHaveLength(degrees.length);
            chart.slots.forEach((slot, i) => {
              const chord = field.chords[degrees[i] - 1];
              const want = setOf(chordPcs(chord.rootPc, tetrad ? chord.tetrad.id : chord.triad.id));
              const got = setOf(makeSlot(slot.rootPc, slot.bassPc, slot.typeId, slot.len, slot.bar, slot.label).pcs);
              expect(got, `${def.id} root ${root} ${tetrad ? 'tétrade' : 'tríade'} grau ${degrees[i]} (${slot.label})`).toBe(want);
              expect(slot.len).toBe(16); // um acorde por compasso
            });
          }
        }
      }
    }
  });

  it('a música gerada passa pela validação de importação e o id é seguro', () => {
    for (const def of FIELDS) {
      const field = buildField(def, 11, 'flat');
      for (const tetrad of [false, true]) {
        const song = fieldSong(field, [1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5], tetrad, 'latin')!;
        expect(song.id).toMatch(/^[\w-]{1,40}$/);
        expect(sanitizeSong(song)).not.toBeNull();
        expect(sanitizeSong(song)!.id).toBe(song.id); // o sanitize não altera o id
      }
    }
  });

  it('mesma progressão = mesmo id; muda o tom, o tipo ou os graus = id diferente', () => {
    const def = FIELDS.find((x) => x.id === 'major')!;
    const a = buildField(def, 0, 'sharp');
    expect(fieldSongId(a, [1, 4, 5], false)).toBe(fieldSongId(buildField(def, 0, 'flat'), [1, 4, 5], false));
    const ids = new Set([fieldSongId(a, [1, 4, 5], false), fieldSongId(a, [1, 4, 5], true), fieldSongId(a, [1, 5, 4], false), fieldSongId(buildField(def, 2, 'sharp'), [1, 4, 5], false)]);
    expect(ids.size).toBe(4);
  });

  it('graus inválidos são descartados e o tamanho é limitado', () => {
    expect(cleanDegrees([0, 1, 8, 2.5, -1, 7, NaN])).toEqual([1, 7]);
    expect(cleanDegrees(Array(30).fill(1))).toHaveLength(MAX_PROGRESSION);
    const f = buildField(FIELDS[0], 0, 'sharp');
    expect(fieldSong(f, [], false, 'letters')).toBeNull();
    expect(fieldSong(f, [0, 9], false, 'letters')).toBeNull();
  });
});
