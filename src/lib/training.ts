/**
 * Cartões do Treino diário.
 *
 * Cada cartão é identificado por um id estável (ex.: "note|standard|2|5" = nota da corda 3, casa 5), para
 * que a revisão espaçada reconheça o mesmo item em dias diferentes. `buildCard` recria o cartão a partir
 * do id; `randomId` sorteia um id novo. Tudo é puro e recebe o sorteio (`rng`), então é testável.
 */
import { CHORD_TYPES, chordNotes, chordSymbol, chordTypeById, chordPcs } from './chords';
import { FIELDS, buildField, parentMajor, signatureOf } from './harmony';
import type { Marker } from '../components/Fretboard';
import { INTERVAL_NAMES, INTERVAL_TOKENS, SCALES, TUNINGS, buildScale, mod12, noteLabel, pcAt, pcLabel, pcLabelBoth, scaleById, spellFormula, stringNumber, tuningById, type AccPref, type Lang } from './music';
import { dueIds, type SrsMap } from './srs';

export type Kind = 'note' | 'find' | 'interval' | 'degree' | 'chord' | 'fieldchord' | 'fielddeg';
export type Category = 'notas' | 'escalas' | 'acordes' | 'campos';

export const CATEGORIES: { id: Category; label: string; kinds: Kind[] }[] = [
  { id: 'notas', label: 'Notas no braço', kinds: ['note', 'find'] },
  { id: 'escalas', label: 'Escalas e intervalos', kinds: ['interval', 'degree'] },
  { id: 'acordes', label: 'Acordes', kinds: ['chord'] },
  { id: 'campos', label: 'Campos harmônicos', kinds: ['fieldchord', 'fielddeg'] },
];
export const KIND_TITLE: Record<Kind, string> = {
  note: 'Nota no braço',
  find: 'Encontre a nota',
  interval: 'Intervalo',
  degree: 'Grau da escala',
  chord: 'Notas do acorde',
  fieldchord: 'Acorde do grau',
  fielddeg: 'Grau do acorde',
};
export const kindsOf = (cats: Category[]) => CATEGORIES.filter((c) => cats.includes(c.id)).flatMap((c) => c.kinds);
export const kindOfId = (id: string) => id.split('|')[0] as Kind;

export interface Ctx {
  tuningId: string;
  pref: AccPref;
  lang: Lang;
}
export type Rng = () => number;

export interface Choice {
  key: string;
  label: string;
}

export interface Card {
  id: string;
  kind: Kind;
  prompt: string;
  sub?: string;
  board?: { tuning: number[]; fretMax: number; markers: Marker[]; stringsOff: number[]; clickable: boolean };
  choices?: Choice[]; // sem "choices": a resposta é tocar no braço
  answer: string[]; // chaves aceitas
  explain: string;
}

// ---------- utilidades ----------

const rint = (n: number, rng: Rng) => Math.floor(rng() * n);
const pickOf = <T>(arr: readonly T[], rng: Rng): T => arr[rint(arr.length, rng)];
export function shuffled<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rint(i + 1, rng);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const int = (s: string | undefined, min: number, max: number): number | null => {
  if (s === undefined || !/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
};

const FRET_MAX = 12;
const SCALE_POOL = ['major', 'natural-minor', 'major-pent', 'minor-pent', 'dorian', 'mixolydian', 'lydian', 'phrygian', 'harmonic-minor'].filter((id) => SCALES.some((s) => s.id === id));
const CHORD_POOL = ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4', '7', 'maj7', 'm7', 'm7b5', 'dim7'].filter((id) => CHORD_TYPES.some((t) => t.id === id));
const FIELD_POOL = ['major', 'natural-minor', 'harmonic-minor', 'dorian', 'mixolydian', 'lydian'].filter((id) => FIELDS.some((f) => f.id === id));
const pcChoices = (lang: Lang): Choice[] => Array.from({ length: 12 }, (_, pc) => ({ key: `pc:${pc}`, label: pcLabelBoth(pc, lang) }));

/** Tonalidades com bemóis usam bemol; com sustenidos, sustenido; sem acidentes, a preferência. */
function fieldPref(parentPc: number, fallback: AccPref): AccPref {
  const n = signatureOf(parentPc).count;
  return n < 0 ? 'flat' : n > 0 ? 'sharp' : fallback;
}
const shortName = (name: string) => name.split(' (')[0];

// ---------- sorteio de ids ----------

export function randomId(kind: Kind, ctx: Ctx, rng: Rng = Math.random): string {
  const root = rint(12, rng);
  switch (kind) {
    case 'note': {
      const t = tuningById(ctx.tuningId);
      return `note|${t.id}|${rint(t.midi.length, rng)}|${rint(FRET_MAX + 1, rng)}`;
    }
    case 'find': {
      const t = tuningById(ctx.tuningId);
      return `find|${t.id}|${rint(t.midi.length, rng)}|${root}`;
    }
    case 'interval':
      return `interval|${root}|${1 + rint(11, rng)}`;
    case 'degree': {
      const id = pickOf(SCALE_POOL, rng);
      return `degree|${id}|${root}|${1 + rint(scaleById(id).formula.length - 1, rng)}`;
    }
    case 'chord':
      return `chord|${root}|${pickOf(CHORD_POOL, rng)}`;
    case 'fieldchord':
    case 'fielddeg':
      return `${kind}|${pickOf(FIELD_POOL, rng)}|${root}|${1 + rint(7, rng)}|${rng() < 0.5 ? 3 : 4}`;
  }
}

// ---------- construção dos cartões ----------

export function buildCard(id: string, ctx: Ctx, rng: Rng = Math.random): Card | null {
  const [kind, ...p] = id.split('|');
  switch (kind as Kind) {
    case 'note': return buildNote(id, p, ctx);
    case 'find': return buildFind(id, p, ctx);
    case 'interval': return buildInterval(id, p, ctx);
    case 'degree': return buildDegree(id, p, ctx);
    case 'chord': return buildChord(id, p, ctx, rng);
    case 'fieldchord': return buildFieldChord(id, p, ctx);
    case 'fielddeg': return buildFieldDeg(id, p, ctx);
    default: return null;
  }
}

const tuningOf = (id: string | undefined) => TUNINGS.find((t) => t.id === id);

function buildNote(id: string, p: string[], ctx: Ctx): Card | null {
  const t = tuningOf(p[0]);
  const s = t ? int(p[1], 0, t.midi.length - 1) : null;
  const f = int(p[2], 0, FRET_MAX);
  if (!t || s === null || f === null) return null;
  const pc = pcAt(t.midi, s, f);
  return {
    id,
    kind: 'note',
    prompt: 'Que nota é esta?',
    sub: `Corda ${stringNumber(s, t.midi.length)}, casa ${f}`,
    board: { tuning: t.midi, fretMax: FRET_MAX, markers: [{ string: s, fret: f, kind: 'target', label: '?' }], stringsOff: [], clickable: false },
    choices: pcChoices(ctx.lang),
    answer: [`pc:${pc}`],
    explain: `Corda ${stringNumber(s, t.midi.length)}, casa ${f} é ${pcLabel(pc, ctx.pref, ctx.lang)}.`,
  };
}

function buildFind(id: string, p: string[], ctx: Ctx): Card | null {
  const t = tuningOf(p[0]);
  const s = t ? int(p[1], 0, t.midi.length - 1) : null;
  const pc = int(p[2], 0, 11);
  if (!t || s === null || pc === null) return null;
  const frets: number[] = [];
  for (let f = 0; f <= FRET_MAX; f++) if (pcAt(t.midi, s, f) === pc) frets.push(f);
  const label = pcLabelBoth(pc, ctx.lang);
  return {
    id,
    kind: 'find',
    prompt: `Toque ${label} na corda ${stringNumber(s, t.midi.length)}`,
    board: { tuning: t.midi, fretMax: FRET_MAX, markers: [], stringsOff: t.midi.map((_, i) => i).filter((i) => i !== s), clickable: true },
    answer: [`${s}:${pc}`],
    explain: `${label} na corda ${stringNumber(s, t.midi.length)} fica na casa ${frets.join(' e ')}.`,
  };
}

function buildInterval(id: string, p: string[], ctx: Ctx): Card | null {
  const root = int(p[0], 0, 11);
  const semis = int(p[1], 1, 11);
  if (root === null || semis === null) return null;
  const note = spellFormula(root, [INTERVAL_TOKENS[semis]], ctx.pref)[0];
  const target = mod12(root + semis);
  return {
    id,
    kind: 'interval',
    prompt: `${INTERVAL_NAMES[semis]} acima de ${pcLabel(root, ctx.pref, ctx.lang)}`,
    sub: 'Que nota é essa?',
    choices: pcChoices(ctx.lang),
    answer: [`pc:${target}`],
    explain: `${INTERVAL_NAMES[semis]} acima de ${pcLabel(root, ctx.pref, ctx.lang)} = ${noteLabel(note.spelled, ctx.lang)} (${semis} semitons).`,
  };
}

function buildDegree(id: string, p: string[], ctx: Ctx): Card | null {
  const def = SCALES.find((s) => s.id === p[0]);
  const root = int(p[1], 0, 11);
  const idx = def ? int(p[2], 1, def.formula.length - 1) : null;
  if (!def || root === null || idx === null) return null;
  const scale = buildScale(def, root, ctx.pref);
  const target = scale.notes[idx];
  return {
    id,
    kind: 'degree',
    prompt: `Qual é o ${idx + 1}º grau de ${def.name} em ${pcLabel(root, ctx.pref, ctx.lang)}?`,
    choices: pcChoices(ctx.lang),
    answer: [`pc:${target.pc}`],
    explain: `${def.name} em ${pcLabel(root, ctx.pref, ctx.lang)}: ${scale.notes.map((n) => noteLabel(n.spelled, ctx.lang)).join(' · ')}. O ${idx + 1}º grau é ${noteLabel(target.spelled, ctx.lang)}.`,
  };
}

const setKey = (pcs: number[]) => [...new Set(pcs.map(mod12))].sort((a, b) => a - b).join(',');

function buildChord(id: string, p: string[], ctx: Ctx, rng: Rng): Card | null {
  const root = int(p[0], 0, 11);
  const type = CHORD_TYPES.find((t) => t.id === p[1]);
  if (root === null || !type) return null;
  const notes = chordNotes(root, type, ctx.pref);
  const mine = setKey(chordPcs(root, type.id));
  const label = (r: number, t: (typeof CHORD_TYPES)[number]) => chordSymbol(r, t, r, ctx.pref);

  // alternativas: mesma fundamental com outros tipos, e tipos iguais em fundamentais vizinhas (sem repetir as mesmas notas)
  const seenSets = new Set([mine]);
  const seenLabels = new Set([label(root, type)]);
  const options: { key: string; label: string }[] = [];
  const candidates = shuffled(
    CHORD_POOL.flatMap((tid) => [root, mod12(root + 7), mod12(root + 5), mod12(root + 3)].map((r) => ({ r, t: chordTypeById(tid) }))),
    rng,
  ).sort((a, b) => Number(b.r === root) - Number(a.r === root)); // prioriza a mesma fundamental (mais confundível)
  for (const c of candidates) {
    if (options.length >= 3) break;
    const k = setKey(chordPcs(c.r, c.t.id));
    const l = label(c.r, c.t);
    if (seenSets.has(k) || seenLabels.has(l)) continue;
    seenSets.add(k);
    seenLabels.add(l);
    options.push({ key: `chord:${c.r}:${c.t.id}`, label: l });
  }
  const right = { key: `chord:${root}:${type.id}`, label: label(root, type) };
  return {
    id,
    kind: 'chord',
    prompt: 'Qual acorde tem estas notas?',
    sub: notes.map((n) => noteLabel(n.spelled, ctx.lang)).join(' · '),
    choices: shuffled([right, ...options], rng),
    answer: [right.key],
    explain: `${right.label} = ${notes.map((n) => noteLabel(n.spelled, ctx.lang)).join(' · ')}.`,
  };
}

function fieldFrom(p: string[], ctx: Ctx) {
  const def = FIELDS.find((f) => f.id === p[0]);
  const root = int(p[1], 0, 11);
  const degree = int(p[2], 1, 7);
  const t = p[3] === '3' ? false : p[3] === '4' ? true : null;
  if (!def || root === null || degree === null || t === null) return null;
  const field = buildField(def, root, fieldPref(parentMajor(def, root), ctx.pref));
  return { def, root, degree, tetrad: t, field, chord: field.chords[degree - 1] };
}

function buildFieldChord(id: string, p: string[], ctx: Ctx): Card | null {
  const f = fieldFrom(p, ctx);
  if (!f) return null;
  const sym = (c: (typeof f.field.chords)[number]) => (f.tetrad ? c.symbolTetrad : c.symbol);
  const rom = (c: (typeof f.field.chords)[number]) => (f.tetrad ? c.romanTetrad : c.roman);
  const answerLabel = sym(f.chord);
  return {
    id,
    kind: 'fieldchord',
    prompt: `Em ${noteLabel(f.field.scale.root, ctx.lang)} ${shortName(f.def.name)}, qual é o acorde do grau ${rom(f.chord)}?`,
    sub: f.tetrad ? 'Com sétima (tétrades)' : 'Tríades',
    choices: f.field.chords.map((c, i) => ({ key: `deg:${i + 1}`, label: sym(c) })),
    answer: f.field.chords.flatMap((c, i) => (sym(c) === answerLabel ? [`deg:${i + 1}`] : [])),
    explain: `${rom(f.chord)} = ${answerLabel} (${f.tetrad ? f.chord.fullNameTetrad : f.chord.fullName}). Campo completo: ${f.field.chords.map(sym).join(' · ')}.`,
  };
}

function buildFieldDeg(id: string, p: string[], ctx: Ctx): Card | null {
  const f = fieldFrom(p, ctx);
  if (!f) return null;
  const sym = (c: (typeof f.field.chords)[number]) => (f.tetrad ? c.symbolTetrad : c.symbol);
  const rom = (c: (typeof f.field.chords)[number]) => (f.tetrad ? c.romanTetrad : c.roman);
  const answerLabel = rom(f.chord);
  return {
    id,
    kind: 'fielddeg',
    prompt: `Em ${noteLabel(f.field.scale.root, ctx.lang)} ${shortName(f.def.name)}, que grau é o acorde ${sym(f.chord)}?`,
    sub: f.tetrad ? 'Com sétima (tétrades)' : 'Tríades',
    choices: f.field.chords.map((c, i) => ({ key: `deg:${i + 1}`, label: rom(c) })),
    answer: f.field.chords.flatMap((c, i) => (rom(c) === answerLabel ? [`deg:${i + 1}`] : [])),
    explain: `${sym(f.chord)} é o ${answerLabel} de ${noteLabel(f.field.scale.root, ctx.lang)} ${shortName(f.def.name)}. Campo completo: ${f.field.chords.map((c) => `${rom(c)} ${sym(c)}`).join(' · ')}.`,
  };
}

export const isCorrect = (card: Card, key: string) => card.answer.includes(key);

// ---------- montagem da sessão ----------

export interface SessionPlan {
  ids: string[];
  due: number; // quantos são revisões vencidas
  fresh: number; // quantos são itens novos ou de reforço
}

/**
 * Sessão = primeiro as revisões vencidas (as mais atrasadas), depois itens novos sorteados de forma
 * equilibrada entre os tipos escolhidos. Sem repetir ids. A ordem final é embaralhada.
 */
export function planSession(opts: { srs: SrsMap; now: number; size: number; kinds: Kind[]; ctx: Ctx; rng?: Rng }): SessionPlan {
  const { srs, now, size, kinds, ctx } = opts;
  const rng = opts.rng ?? Math.random;
  if (!kinds.length) return { ids: [], due: 0, fresh: 0 };
  const accept = (id: string) => kinds.includes(kindOfId(id)) && buildCard(id, ctx, rng) !== null;
  const due = dueIds(srs, now, accept).slice(0, size);
  const chosen = new Set(due);

  const fresh: string[] = [];
  let attempts = 0;
  let allowSeen = false;
  while (chosen.size + fresh.length < size && attempts < size * 80) {
    const id = randomId(kinds[(fresh.length + attempts) % kinds.length], ctx, rng);
    attempts++;
    if (attempts > size * 40) allowSeen = true; // universo pequeno já visto: aceita reforço de itens ainda não vencidos
    if (chosen.has(id) || fresh.includes(id)) continue;
    if (srs[id] && !allowSeen) continue;
    fresh.push(id);
  }
  return { ids: shuffled([...due, ...fresh], rng), due: due.length, fresh: fresh.length };
}
