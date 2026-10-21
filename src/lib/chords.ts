import { mod12, pcLabel, spellFormula, tokenSemis, type AccPref, type ScaleNote } from './music';

export interface ChordType {
  id: string;
  symbol: string; // sufixo da cifra
  name: string; // nome por extenso (após o nome da nota)
  tokens: string[];
  aliases: string[]; // formas aceitas ao digitar cifras
  group: string;
}

export const CHORD_GROUPS = ['Tríades', 'Sétimas', 'Sextas e extensões', 'Alterados'];

export const CHORD_TYPES: ChordType[] = [
  { id: 'maj', symbol: '', name: 'maior', tokens: ['1', '3', '5'], aliases: ['', 'maj', 'M'], group: 'Tríades' },
  { id: 'min', symbol: 'm', name: 'menor', tokens: ['1', 'b3', '5'], aliases: ['m', 'min', '-'], group: 'Tríades' },
  { id: 'dim', symbol: 'dim', name: 'diminuto', tokens: ['1', 'b3', 'b5'], aliases: ['dim', '°', 'o'], group: 'Tríades' },
  { id: 'aug', symbol: 'aug', name: 'aumentado', tokens: ['1', '3', '#5'], aliases: ['aug', '+', '#5'], group: 'Tríades' },
  { id: 'sus2', symbol: 'sus2', name: 'com segunda suspensa', tokens: ['1', '2', '5'], aliases: ['sus2'], group: 'Tríades' },
  { id: 'sus4', symbol: 'sus4', name: 'com quarta suspensa', tokens: ['1', '4', '5'], aliases: ['sus4', 'sus'], group: 'Tríades' },
  { id: '5', symbol: '5', name: 'quinta (power chord)', tokens: ['1', '5'], aliases: ['5'], group: 'Tríades' },

  { id: '7', symbol: '7', name: 'com sétima (dominante)', tokens: ['1', '3', '5', 'b7'], aliases: ['7', 'dom7'], group: 'Sétimas' },
  { id: 'maj7', symbol: 'maj7', name: 'maior com sétima maior', tokens: ['1', '3', '5', '7'], aliases: ['maj7', 'M7', 'Δ', 'Δ7', 'maj7'], group: 'Sétimas' },
  { id: 'm7', symbol: 'm7', name: 'menor com sétima', tokens: ['1', 'b3', '5', 'b7'], aliases: ['m7', 'min7', '-7'], group: 'Sétimas' },
  { id: 'm7b5', symbol: 'm7♭5', name: 'meio-diminuto (menor com sétima e quinta bemol)', tokens: ['1', 'b3', 'b5', 'b7'], aliases: ['m7b5', 'm7♭5', 'ø', 'ø7', 'min7b5'], group: 'Sétimas' },
  { id: 'dim7', symbol: 'dim7', name: 'diminuto com sétima diminuta', tokens: ['1', 'b3', 'b5', 'bb7'], aliases: ['dim7', '°7', 'o7'], group: 'Sétimas' },
  { id: 'mMaj7', symbol: 'm(maj7)', name: 'menor com sétima maior', tokens: ['1', 'b3', '5', '7'], aliases: ['m(maj7)', 'mMaj7', 'mM7', 'm7+', 'minmaj7'], group: 'Sétimas' },
  { id: '7sus4', symbol: '7sus4', name: 'com sétima e quarta suspensa', tokens: ['1', '4', '5', 'b7'], aliases: ['7sus4', '7sus'], group: 'Sétimas' },
  { id: '7b5', symbol: '7(♭5)', name: 'com sétima e quinta bemol', tokens: ['1', '3', 'b5', 'b7'], aliases: ['7b5', '7(b5)', '7(♭5)'], group: 'Sétimas' },
  { id: '7#5', symbol: '7(♯5)', name: 'com sétima e quinta aumentada', tokens: ['1', '3', '#5', 'b7'], aliases: ['7#5', '7(#5)', '7(♯5)', '7+', 'aug7'], group: 'Sétimas' },

  { id: '6', symbol: '6', name: 'maior com sexta', tokens: ['1', '3', '5', '6'], aliases: ['6', 'maj6'], group: 'Sextas e extensões' },
  { id: 'm6', symbol: 'm6', name: 'menor com sexta', tokens: ['1', 'b3', '5', '6'], aliases: ['m6', 'min6'], group: 'Sextas e extensões' },
  { id: 'add9', symbol: 'add9', name: 'maior com nona adicionada', tokens: ['1', '3', '5', '9'], aliases: ['add9', 'add2', '(add9)'], group: 'Sextas e extensões' },
  { id: 'madd9', symbol: 'm(add9)', name: 'menor com nona adicionada', tokens: ['1', 'b3', '5', '9'], aliases: ['madd9', 'm(add9)', 'madd2'], group: 'Sextas e extensões' },
  { id: '69', symbol: '6/9', name: 'maior com sexta e nona', tokens: ['1', '3', '5', '6', '9'], aliases: ['6/9', '69'], group: 'Sextas e extensões' },
  { id: '9', symbol: '9', name: 'com nona (dominante)', tokens: ['1', '3', '5', 'b7', '9'], aliases: ['9'], group: 'Sextas e extensões' },
  { id: 'maj9', symbol: 'maj9', name: 'maior com sétima maior e nona', tokens: ['1', '3', '5', '7', '9'], aliases: ['maj9', 'M9', 'Δ9'], group: 'Sextas e extensões' },
  { id: 'm9', symbol: 'm9', name: 'menor com sétima e nona', tokens: ['1', 'b3', '5', 'b7', '9'], aliases: ['m9', 'min9'], group: 'Sextas e extensões' },
  { id: '13', symbol: '13', name: 'com sétima e décima terceira', tokens: ['1', '3', '5', 'b7', '13'], aliases: ['13'], group: 'Sextas e extensões' },
  { id: 'm11', symbol: 'm11', name: 'menor com sétima, nona e décima primeira', tokens: ['1', 'b3', '5', 'b7', '9', '11'], aliases: ['m11', 'min11'], group: 'Sextas e extensões' },

  { id: '7b9', symbol: '7(♭9)', name: 'com sétima e nona bemol', tokens: ['1', '3', '5', 'b7', 'b9'], aliases: ['7b9', '7(b9)', '7(♭9)'], group: 'Alterados' },
  { id: '7#9', symbol: '7(♯9)', name: 'com sétima e nona aumentada (acorde Hendrix)', tokens: ['1', '3', '5', 'b7', '#9'], aliases: ['7#9', '7(#9)', '7(♯9)'], group: 'Alterados' },
  { id: 'maj7#11', symbol: 'maj7(♯11)', name: 'maior com sétima maior e décima primeira aumentada', tokens: ['1', '3', '5', '7', '#11'], aliases: ['maj7#11', 'maj7(#11)', 'maj7(♯11)', 'M7#11'], group: 'Alterados' },
];

export const chordTypeById = (id: string) => CHORD_TYPES.find((t) => t.id === id) ?? CHORD_TYPES[0];

const semisOf = (t: ChordType) => t.tokens.map(tokenSemis);
const typePcs = (t: ChordType, root: number) => [...new Set(semisOf(t).map((s) => mod12(root + s)))];

export const chordPcs = (rootPc: number, typeId: string) => typePcs(chordTypeById(typeId), rootPc);
export const chordHasMinorThird = (typeId: string) => chordTypeById(typeId).tokens.includes('b3');

export function chordSymbol(rootPc: number, type: ChordType, bassPc: number, pref: AccPref) {
  const root = pcLabel(rootPc, pref, 'letters');
  const bass = mod12(bassPc) !== mod12(rootPc) ? `/${pcLabel(bassPc, pref, 'letters')}` : '';
  return `${root}${type.symbol}${bass}`;
}

export function chordFullName(rootPc: number, type: ChordType, bassPc: number, pref: AccPref) {
  const root = pcLabel(rootPc, pref, 'latin');
  const bass = mod12(bassPc) !== mod12(rootPc) ? ` com baixo em ${pcLabel(bassPc, pref, 'latin')}` : '';
  return `${root} ${type.name}${bass}`;
}

/** Notas do acorde com a grafia correta (Eb G Bb) e seus graus. */
export function chordNotes(rootPc: number, type: ChordType, pref: AccPref): ScaleNote[] {
  return spellFormula(rootPc, type.tokens, pref);
}

// ---------- Detecção ----------

export interface ChordMatch {
  rootPc: number;
  type: ChordType;
  bassPc: number;
  omit5: boolean;
}

export function detectChords(pcs: number[], bassPc: number): ChordMatch[] {
  const set = new Set(pcs.map(mod12));
  if (set.size < 2) return [];
  const found: { m: ChordMatch; score: number }[] = [];
  for (const root of set) {
    const rel = new Set([...set].map((p) => mod12(p - root)));
    CHORD_TYPES.forEach((type, i) => {
      const t = new Set(semisOf(type));
      const same = (a: Set<number>, b: Set<number>) => a.size === b.size && [...a].every((x) => b.has(x));
      const slash = root !== mod12(bassPc) ? 5 : 0;
      if (same(rel, t)) found.push({ m: { rootPc: root, type, bassPc, omit5: false }, score: slash + i * 0.01 });
      else if (t.size >= 4 && t.has(7)) {
        const no5 = new Set([...t].filter((x) => x !== 7));
        if (same(rel, no5)) found.push({ m: { rootPc: root, type, bassPc, omit5: true }, score: 3 + slash + i * 0.01 });
      }
    });
  }
  found.sort((a, b) => a.score - b.score);
  const seen = new Set<string>();
  return found
    .map((f) => f.m)
    .filter((m) => {
      const k = `${m.rootPc}-${m.type.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 5);
}

// ---------- Leitura de cifras ----------

const ALIAS = new Map<string, ChordType>();
for (const t of CHORD_TYPES) for (const a of t.aliases) if (!ALIAS.has(a)) ALIAS.set(a, t);

const LETTER_TO_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const accOf = (c: string | undefined) => (c === '#' || c === '♯' ? 1 : c === 'b' || c === '♭' ? -1 : 0);

export interface ParsedChord {
  rootPc: number;
  bassPc: number;
  type: ChordType;
  flat: boolean; // grafia digitada usa bemol
  sharp: boolean;
}

export function parseChord(raw: string): ParsedChord | null {
  const m = /^([A-G])([#b♯♭]?)([^/]*)(?:\/([A-G])([#b♯♭]?))?$/.exec(raw.trim());
  if (!m) return null;
  const type = ALIAS.get(m[3]);
  if (!type) return null;
  const rootPc = mod12(LETTER_TO_PC[m[1]] + accOf(m[2]));
  const bassPc = m[4] ? mod12(LETTER_TO_PC[m[4]] + accOf(m[5])) : rootPc;
  const flat = accOf(m[2]) < 0 || accOf(m[5]) < 0;
  const sharp = accOf(m[2]) > 0 || accOf(m[5]) > 0;
  return { rootPc, bassPc, type, flat, sharp };
}

export interface ChartSlot {
  rootPc: number;
  bassPc: number;
  typeId: string;
  label: string; // como foi digitado
  len: number; // em semicolcheias (16 = 1 compasso)
  bar: number;
}

export interface Chart {
  slots: ChartSlot[];
  bars: number;
  unknown: string[];
  pref: AccPref;
}

/**
 * Cifra em texto → linha do tempo. Compassos separados por "|", acordes no mesmo
 * compasso dividem o tempo, "%" repete o compasso anterior, "#" ou [Seção] são comentários.
 */
export function parseChart(text: string, fallbackPref: AccPref = 'sharp'): Chart {
  const bars: string[][] = [];
  const unknown: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || /^\[.*\]$/.test(line)) continue;
    const segs = line.includes('|') ? line.split('|').map((s) => s.trim()).filter(Boolean) : line.split(/\s+/);
    for (const seg of segs) bars.push(seg.split(/\s+/).filter(Boolean));
  }

  const slots: ChartSlot[] = [];
  let flats = 0;
  let sharps = 0;
  let barNo = 0;
  let prev: string[] = [];
  for (const tokens of bars) {
    const toks = tokens.length === 1 && tokens[0] === '%' ? prev : tokens;
    const parsed: { p: ParsedChord; tok: string }[] = [];
    for (const tok of toks) {
      if (/^(N\.?C\.?|-|\.|%)$/i.test(tok)) continue;
      const p = parseChord(tok);
      if (p) parsed.push({ p, tok });
      else unknown.push(tok);
    }
    if (!parsed.length) continue;
    prev = toks;
    const n = parsed.length;
    parsed.forEach(({ p, tok }, i) => {
      const len = Math.round(((i + 1) * 16) / n) - Math.round((i * 16) / n);
      if (p.flat) flats++;
      if (p.sharp) sharps++;
      slots.push({ rootPc: p.rootPc, bassPc: p.bassPc, typeId: p.type.id, label: tok, len, bar: barNo });
    });
    barNo++;
  }
  const pref: AccPref = flats > sharps ? 'flat' : sharps > flats ? 'sharp' : fallbackPref;
  return { slots, bars: barNo, unknown: [...new Set(unknown)], pref };
}

// ---------- Digitações (voicings) ----------

export interface Voicing {
  frets: number[]; // por corda (da mais grave): -1 = não tocada
  score: number;
}

/** Procura digitações viáveis no braço para um acorde (janela de 4 casas). */
export function findVoicings(rootPc: number, type: ChordType, tuning: number[], limit = 8): Voicing[] {
  const pcs = typePcs(type, rootPc);
  const pcSet = new Set(pcs);
  const fifth = mod12(rootPc + 7);
  const required = new Set(pcs);
  if (pcs.length >= 4 && pcSet.has(fifth)) required.delete(fifth);
  const minStrings = type.id === '5' ? 2 : Math.min(tuning.length, Math.max(3, required.size));
  const N = tuning.length;
  const seen = new Set<string>();
  const out: Voicing[] = [];

  for (let w = 1; w <= 12; w++) {
    const allowed = (f: number) => (f === 0 && w <= 3) || (f >= w && f <= w + 3);
    const opts: number[][] = tuning.map((open) => {
      const o = [-1];
      for (let f = 0; f <= w + 3; f++) if (allowed(f) && pcSet.has(mod12(open + f))) o.push(f);
      return o;
    });
    const cur: number[] = [];
    const dfs = (s: number) => {
      if (s === N) {
        const played = cur.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
        if (played.length < minStrings) return;
        if (played[played.length - 1] - played[0] + 1 !== played.length) return; // sem cordas mudas no meio
        const covered = new Set(played.map((i) => mod12(tuning[i] + cur[i])));
        for (const r of required) if (!covered.has(r)) return;
        const fretted = played.map((i) => cur[i]).filter((f) => f > 0);
        const lo = fretted.length ? Math.min(...fretted) : 0;
        const span = fretted.length ? Math.max(...fretted) - lo : 0;
        if (span > 3) return;
        const key = cur.join(',');
        if (seen.has(key)) return;
        seen.add(key);
        const bassPc = mod12(tuning[played[0]] + cur[played[0]]);
        const opens = played.filter((i) => cur[i] === 0).length;
        const score = (bassPc === rootPc ? 0 : 6) + (N - played.length) * 1.2 + span * 0.6 + lo * 0.25 - opens * 0.3;
        out.push({ frets: [...cur], score });
        return;
      }
      for (const f of opts[s]) {
        cur[s] = f;
        dfs(s + 1);
      }
    };
    dfs(0);
  }
  return out.sort((a, b) => a.score - b.score).slice(0, limit);
}
