import { describe, expect, it } from 'vitest';
import { parseChart } from '../src/lib/chords';
import { adviseKey } from '../src/lib/keyadvice';
import { SCALES } from '../src/lib/music';

const adv = (key: number, minor: boolean, chart: string) => adviseKey(key, minor, parseChart(chart).slots);
const forLabel = (a: ReturnType<typeof adv>, label: string) => a.chords.find((c) => c.label === label)!;
const A = 9, C = 0, E = 4;

describe('escalas do tom', () => {
  it('tom maior: pentatônica maior primeiro, escala maior e a pentatônica menor da relativa (rootada no vi)', () => {
    const a = adv(C, false, '| C | Am | F | G |');
    expect(a.scales.slice(0, 3).map((s) => [s.scaleId, s.rootPc])).toEqual([['major-pent', C], ['major', C], ['minor-pent', A]]);
    expect(a.scales.every((s) => s.why.length > 10)).toBe(true);
  });

  it('tom menor: pentatônica menor, menor natural, blues; harmônica quando há V maior; dórico quando há IV maior', () => {
    const a = adv(A, true, '| Am | D | E7 | Am |');
    const ids = a.scales.map((s) => s.scaleId);
    expect(ids.slice(0, 3)).toEqual(['minor-pent', 'natural-minor', 'blues-minor']);
    expect(ids).toContain('harmonic-minor');
    expect(ids).toContain('dorian');
    const plain = adv(A, true, '| Am | Dm | Am | Dm |').scales.map((s) => s.scaleId);
    expect(plain).not.toContain('harmonic-minor');
    expect(plain).not.toContain('dorian');
  });

  it('mixolídio quando há ♭VII ou dominante na tônica; blues maior em música de dominantes', () => {
    expect(adv(C, false, '| C | Bb | F | C |').scales.map((s) => s.scaleId)).toContain('mixolydian');
    expect(adv(C, false, '| C | G | Am | F |').scales.map((s) => s.scaleId)).not.toContain('mixolydian');
    const blues = adv(A, false, '| A7 | D7 | A7 | E7 |');
    expect(blues.bluesy).toBe(true);
    expect(blues.scales.map((s) => s.scaleId)).toContain('blues-major');
  });

  it('sem repetições', () => {
    const a = adv(C, false, '| C | Bb | F | C7 | Fmaj7 |');
    const keys = a.scales.map((s) => `${s.scaleId}:${s.rootPc}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('escala e arpejo por acorde', () => {
  it('campo de Dó maior: os modos do campo', () => {
    const a = adv(C, false, '| C | Dm | Em | F | G7 | Am | Bm7b5 |');
    const m = (l: string) => [forLabel(a, l).scale.scaleId, forLabel(a, l).scale.rootPc];
    expect(m('C')).toEqual(['major', 0]);
    expect(m('Dm')).toEqual(['dorian', 2]);
    expect(m('Em')).toEqual(['phrygian', 4]);
    expect(m('F')).toEqual(['lydian', 5]);
    expect(m('G7')).toEqual(['mixolydian', 7]);
    expect(m('Am')).toEqual(['natural-minor', 9]);
    expect(m('Bm7b5')).toEqual(['locrian', 11]);
    expect(a.chords.map((c) => c.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  });

  it('tom menor: i eólio, iv dórico, V dominante em frígio dominante (com a menor harmônica como alternativa), VI lídio, ♭VII mixolídio', () => {
    const a = adv(A, true, '| Am | Dm | E7 | F | G |');
    expect(forLabel(a, 'Am').scale).toMatchObject({ scaleId: 'natural-minor', rootPc: A });
    expect(forLabel(a, 'Am').alt?.scaleId).toBe('minor-pent');
    expect(forLabel(a, 'Dm').scale).toMatchObject({ scaleId: 'dorian', rootPc: 2 });
    expect(forLabel(a, 'E7').scale).toMatchObject({ scaleId: 'phrygian-dominant', rootPc: E });
    expect(forLabel(a, 'E7').alt).toMatchObject({ scaleId: 'harmonic-minor', rootPc: A });
    expect(forLabel(a, 'F').scale.scaleId).toBe('lydian');
    expect(forLabel(a, 'G').scale.scaleId).toBe('mixolydian');
    const major5 = adv(A, true, '| Am | E | Am | E |');
    expect(forLabel(major5, 'E').scale.scaleId).toBe('phrygian-dominant');
  });

  it('acordes fora do tom e qualidades especiais', () => {
    const a = adv(C, false, '| C | D7 | Fm | Bdim7 | C+ | Cm(maj7) | G7 |');
    expect(forLabel(a, 'D7').scale.scaleId).toBe('mixolydian');
    expect(forLabel(a, 'Fm').scale.scaleId).toBe('dorian');
    expect(forLabel(a, 'Bdim7').scale.scaleId).toBe('diminished');
    expect(forLabel(a, 'C+').scale.scaleId).toBe('whole-tone');
    expect(forLabel(a, 'Cm(maj7)').scale.scaleId).toBe('melodic-minor');
  });

  it('blues: dominantes ganham mixolídio e, como alternativa, a escala de blues', () => {
    const a = adv(A, false, '| A7 | D7 | A7 | E7 |');
    expect(forLabel(a, 'D7').scale.scaleId).toBe('mixolydian');
    expect(forLabel(a, 'D7').alt).toMatchObject({ scaleId: 'blues-minor', rootPc: 2 });
  });

  it('só ids de escala que existem; acordes repetidos aparecem uma vez', () => {
    const all = SCALES.map((s) => s.id);
    const a = adv(C, false, '| C | G | C | G | Am | F | C | G7 | Cmaj7 | Dm7 | Eb7 | Abmaj7 | Bdim | Csus4 | C5 |');
    for (const c of a.chords) {
      expect(all).toContain(c.scale.scaleId);
      if (c.alt) expect(all).toContain(c.alt.scaleId);
    }
    expect(a.chords.filter((c) => c.label === 'C')).toHaveLength(1);
    for (const s of a.scales) expect(all).toContain(s.scaleId);
  });

  it('sem cifra: sem acordes, mas as escalas do tom continuam', () => {
    const a = adviseKey(C, false, []);
    expect(a.chords).toEqual([]);
    expect(a.scales.length).toBeGreaterThanOrEqual(3);
  });
});
