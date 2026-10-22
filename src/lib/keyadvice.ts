/**
 * Recomendações de escalas e arpejos a partir do tom (e dos acordes) de uma música.
 *
 * Regras de "escala por acorde" (chord-scale) pelo grau do acorde no tom; acordes fora do tom caem na regra
 * pela qualidade (dominante → mixolídio, menor → dórico, meio-diminuto → lócrio etc.).
 */
import { chordTypeById, type ChartSlot } from './chords';
import { mod12 } from './music';

export interface ScaleAdvice {
  scaleId: string;
  rootPc: number; // tônica da escala a tocar (pode ser diferente da do tom, ex.: pentatônica da relativa)
  why: string;
}

export interface ChordAdvice {
  label: string;
  rootPc: number;
  typeId: string;
  roman: string;
  scale: ScaleAdvice;
  alt?: ScaleAdvice;
}

export interface KeyAdvice {
  scales: ScaleAdvice[];
  chords: ChordAdvice[];
  bluesy: boolean; // a música é feita de acordes de sétima dominante (blues, funk, rock'n'roll)
}

const DOMINANT = new Set(['7', '9', '13', '7sus4', '7b5', '7#5', '7b9', '7#9']);
const MINORISH = new Set(['min', 'm7', 'm6', 'madd9', 'm9', 'm11']);
const ROMAN = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'];

type Quality = 'major' | 'minor' | 'dominant' | 'halfdim' | 'dim7' | 'aug' | 'mminor' | 'power';

function qualityOf(typeId: string): Quality {
  if (DOMINANT.has(typeId)) return 'dominant';
  if (MINORISH.has(typeId)) return 'minor';
  if (typeId === 'm7b5' || typeId === 'dim') return 'halfdim';
  if (typeId === 'dim7') return 'dim7';
  if (typeId === 'aug') return 'aug';
  if (typeId === 'mMaj7') return 'mminor';
  if (typeId === '5') return 'power';
  return 'major';
}

const roman = (deg: number, q: Quality) => {
  const base = ROMAN[deg];
  return q === 'minor' || q === 'halfdim' || q === 'dim7' || q === 'mminor' ? base.toLowerCase() + (q === 'halfdim' ? '°' : q === 'dim7' ? '°' : '') : base;
};

const adv = (scaleId: string, rootPc: number, why: string): ScaleAdvice => ({ scaleId, rootPc: mod12(rootPc), why });

/** Escala sugerida sobre um acorde, pelo grau dele no tom. */
function forChord(rootPc: number, typeId: string, keyPc: number, minor: boolean, bluesy: boolean): { scale: ScaleAdvice; alt?: ScaleAdvice } {
  const deg = mod12(rootPc - keyPc);
  const q = qualityOf(typeId);
  const r = rootPc;
  const mode = (id: string, why: string, alt?: ScaleAdvice) => ({ scale: adv(id, r, why), alt });

  if (q === 'halfdim') return mode('locrian', 'Meio-diminuto: o modo lócrio tem exatamente as notas do acorde (♭3, ♭5, ♭7).');
  if (q === 'dim7') return mode('diminished', 'Diminuto com sétima: a escala diminuta (tom–semitom) repete o desenho do acorde.');
  if (q === 'aug') return mode('whole-tone', 'Acorde aumentado: a escala de tons inteiros contém a 5ª aumentada.');
  if (q === 'mminor') return mode('melodic-minor', 'Menor com sétima maior: a menor melódica tem a 7ª maior sobre a 3ª menor.');

  if (q === 'dominant' || (minor && deg === 7 && q === 'major')) {
    if (bluesy) return { scale: adv('mixolydian', r, 'Dominante: o mixolídio tem a 3ª maior e a ♭7 do acorde.'), alt: adv('blues-minor', r, 'Num blues, a escala de blues menor da tônica do acorde dá o som característico.') };
    if (!minor && deg === 7) return mode('mixolydian', 'V do tom: o mixolídio usa as mesmas notas da escala maior do tom.');
    if (minor && deg === 7) return { scale: adv('phrygian-dominant', r, 'V de um tom menor: o frígio dominante tem a sensível (3ª maior) e a ♭9.'), alt: adv('harmonic-minor', keyPc, 'Ou a menor harmônica do tom: as mesmas notas, com a sensível.') };
    return { scale: adv('mixolydian', r, 'Dominante: o mixolídio tem a 3ª maior e a ♭7 do acorde.'), alt: adv('phrygian-dominant', r, 'Para mais tensão (resolvendo num acorde menor), use o frígio dominante.') };
  }

  if (q === 'power') return { scale: adv(minor ? 'minor-pent' : 'major-pent', keyPc, 'Power chord (sem 3ª): a pentatônica do tom funciona sobre ele.'), alt: undefined };

  if (!minor) {
    const table: Record<number, [string, string]> = {
      0: ['major', 'Tônica: a escala maior do tom (jônio).'],
      2: ['dorian', 'ii do tom: o dórico usa as mesmas notas do tom, começando neste acorde.'],
      4: ['phrygian', 'iii do tom: o frígio usa as mesmas notas do tom, começando neste acorde.'],
      5: ['lydian', 'IV do tom: o lídio (♯4) combina com o acorde e usa as notas do tom.'],
      7: ['mixolydian', 'V do tom: o mixolídio usa as mesmas notas do tom.'],
      9: ['natural-minor', 'vi do tom: o eólio (menor natural) usa as mesmas notas do tom.'],
      11: ['locrian', 'vii° do tom: o lócrio usa as mesmas notas do tom.'],
    };
    const t = table[deg];
    if (t && ((q === 'major' && [0, 5, 7].includes(deg)) || (q === 'minor' && [2, 4, 9].includes(deg)))) {
      const alt = deg === 0 ? adv('major-pent', r, 'Pentatônica maior: a opção mais segura.') : deg === 9 ? adv('minor-pent', r, 'Pentatônica menor: a opção mais segura.') : undefined;
      return { scale: adv(t[0], r, t[1]), alt };
    }
  } else {
    const table: Record<number, [string, string]> = {
      0: ['natural-minor', 'Tônica menor: o eólio (menor natural) do tom.'],
      3: ['major', 'III do tom menor: é a escala maior da relativa.'],
      5: ['dorian', 'iv do tom menor: o dórico usa as notas do tom, começando neste acorde.'],
      7: ['phrygian', 'v menor do tom: o frígio usa as notas do tom, começando neste acorde.'],
      8: ['lydian', 'VI do tom menor: o lídio usa as notas do tom, começando neste acorde.'],
      10: ['mixolydian', '♭VII do tom menor: o mixolídio usa as notas do tom, começando neste acorde.'],
    };
    const t = table[deg];
    if (t && ((q === 'minor' && [0, 5, 7].includes(deg)) || (q === 'major' && [3, 8, 10].includes(deg)))) {
      const alt = deg === 0 ? adv('minor-pent', r, 'Pentatônica menor: a opção mais segura.') : undefined;
      return { scale: adv(t[0], r, t[1]), alt };
    }
  }

  // fora do tom (empréstimo modal, dominantes secundárias já tratadas): pela qualidade
  if (q === 'minor') return mode('dorian', 'Acorde menor fora do tom: o dórico é a escolha mais neutra.', adv('minor-pent', r, 'Ou a pentatônica menor.'));
  return mode('major', 'Acorde maior fora do tom: a escala maior dele (ou o lídio para um som mais aberto).', adv('lydian', r, 'O lídio (♯4) soa mais aberto.'));
}

export function adviseKey(keyPc: number, minor: boolean, slots: ChartSlot[]): KeyAdvice {
  const weight = slots.reduce((n, s) => n + s.len, 0) || 1;
  const domW = slots.filter((s) => qualityOf(s.typeId) === 'dominant').reduce((n, s) => n + s.len, 0);
  const bluesy = slots.length >= 3 && domW / weight >= 0.5;
  const has = (pred: (deg: number, q: Quality, typeId: string) => boolean) => slots.some((s) => pred(mod12(s.rootPc - keyPc), qualityOf(s.typeId), s.typeId));

  const scales: ScaleAdvice[] = [];
  const push = (a: ScaleAdvice) => scales.every((x) => !(x.scaleId === a.scaleId && x.rootPc === a.rootPc)) && scales.push(a);
  if (!minor) {
    push(adv('major-pent', keyPc, 'A mais segura: soa bem sobre todos os acordes do tom.'));
    push(adv('major', keyPc, 'Todas as notas do tom.'));
    push(adv('minor-pent', keyPc + 9, 'Pentatônica menor da relativa: o mesmo desenho da pentatônica maior, com a "cara" de rock e blues.'));
    if (has((d, q) => d === 10 || (d === 0 && q === 'dominant') || (d === 5 && q === 'dominant'))) push(adv('mixolydian', keyPc, 'Há ♭VII ou acordes de sétima dominante: o mixolídio (♭7) acompanha melhor.'));
    if (has((d, _q, id) => d === 5 && (id === 'maj7' || id === 'maj9' || id === 'maj7#11'))) push(adv('lydian', keyPc, 'O IV com sétima maior combina com o lídio (♯4).'));
    if (bluesy) push(adv('blues-major', keyPc, 'Música de acordes dominantes: a escala de blues maior dá o tempero.'));
  } else {
    push(adv('minor-pent', keyPc, 'A mais segura: soa bem sobre todos os acordes do tom.'));
    push(adv('natural-minor', keyPc, 'Todas as notas do tom.'));
    push(adv('blues-minor', keyPc, 'Dá o clima blues (a ♭5 é nota de passagem, não de repouso).'));
    if (has((d, q) => d === 5 && q === 'major')) push(adv('dorian', keyPc, 'Há um IV maior: o dórico (6ª maior) combina com ele.'));
    if (has((d, q) => d === 7 && (q === 'major' || q === 'dominant'))) push(adv('harmonic-minor', keyPc, 'O V é maior (ou dominante): a menor harmônica traz a sensível dele.'));
    push(adv('major-pent', keyPc + 3, 'Pentatônica maior da relativa: o mesmo desenho da pentatônica menor, com som mais aberto.'));
  }

  const chords: ChordAdvice[] = [];
  const seen = new Set<string>();
  for (const s of slots) {
    const id = `${s.rootPc}:${s.typeId}`;
    if (seen.has(id) || chords.length >= 16) continue;
    seen.add(id);
    const q = qualityOf(s.typeId);
    const { scale, alt } = forChord(s.rootPc, s.typeId, keyPc, minor, bluesy);
    chords.push({ label: s.label, rootPc: s.rootPc, typeId: s.typeId, roman: roman(mod12(s.rootPc - keyPc), q), scale, alt });
  }
  return { scales, chords, bluesy };
}

/** Nome curto do tipo do acorde (símbolo) para mostrar nas tabelas. */
export const chordSymbolOf = (typeId: string) => chordTypeById(typeId).symbol;
