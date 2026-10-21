/**
 * Transforma uma progressão de um campo harmônico em uma música tocável no Backing.
 * O id é determinístico (campo + tom + graus), então tocar a mesma progressão duas vezes reaproveita a música
 * em vez de duplicá-la.
 */
import { chordSymbol } from './chords';
import type { Field } from './harmony';
import { noteLabel, type Lang } from './music';
import type { Song } from './songs';

export const MAX_PROGRESSION = 12;

const roman = (f: Field, degree: number, tetrad: boolean) => (tetrad ? f.chords[degree - 1].romanTetrad : f.chords[degree - 1].roman);
/**
 * Cifra do acorde. Se a grafia do campo exigir dupla alteração (F𝄪, B𝄫), que a leitura de cifras não entende,
 * reescreve só a fundamental com a grafia enarmônica simples (mesmas notas, mesmo som).
 */
function symbol(f: Field, degree: number, tetrad: boolean): string {
  const c = f.chords[degree - 1];
  const s = tetrad ? c.symbolTetrad : c.symbol;
  if (!/♯♯|♭♭/.test(s)) return s;
  return chordSymbol(c.rootPc, tetrad ? c.tetrad : c.triad, c.rootPc, /♯♯/.test(s) ? 'flat' : 'sharp');
}

/** Só graus de 1 a 7, no máximo 12 acordes. */
export const cleanDegrees = (degrees: number[]) => degrees.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7).slice(0, MAX_PROGRESSION);

/** Cifra em texto, um acorde por compasso: "| G | D | Em | C |". */
export function fieldChart(field: Field, degrees: number[], tetrad: boolean): string {
  const ds = cleanDegrees(degrees);
  return `| ${ds.map((d) => symbol(field, d, tetrad)).join(' | ')} |`;
}

export function fieldSongId(field: Field, degrees: number[], tetrad: boolean): string {
  return `campo-${field.def.id}-${field.rootPc}-${cleanDegrees(degrees).join('')}-${tetrad ? 4 : 3}`;
}

export function fieldSong(field: Field, degrees: number[], tetrad: boolean, lang: Lang, note?: string, now = Date.now()): Song | null {
  const ds = cleanDegrees(degrees);
  if (!ds.length) return null;
  const short = field.def.name.split(' (')[0];
  const tonic = field.chords[0];
  return {
    id: fieldSongId(field, ds, tetrad),
    title: `${noteLabel(field.scale.root, lang)} ${short}: ${ds.map((d) => roman(field, d, tetrad)).join(' – ')}`,
    artist: 'Campos harmônicos',
    keyPc: field.rootPc,
    minor: tonic.triad.id === 'min' || tonic.triad.id === 'dim',
    bpm: tetrad ? 84 : 96,
    style: tetrad ? 'shuffle' : 'rock',
    chart: fieldChart(field, ds, tetrad),
    tags: ['campo harmônico', short],
    notes: `Progressão criada a partir do campo harmônico de ${noteLabel(field.scale.root, lang)} ${short} (${tetrad ? 'tétrades' : 'tríades'}).${note ? ` ${note}` : ''}`,
    sources: [],
    createdAt: now,
  };
}
