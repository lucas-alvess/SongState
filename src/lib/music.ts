export type Lang = 'letters' | 'latin';
export type AccPref = 'sharp' | 'flat';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LATIN = ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

export interface Spelled {
  letter: number;
  acc: number;
}

const SHARP_SP: [number, number][] = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
const FLAT_SP: [number, number][] = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];

export const mod12 = (n: number) => ((n % 12) + 12) % 12;

export function pcSpelling(pc: number, pref: AccPref): Spelled {
  const [letter, acc] = (pref === 'sharp' ? SHARP_SP : FLAT_SP)[mod12(pc)];
  return { letter, acc };
}

export function noteLabel(n: Spelled, lang: Lang): string {
  const base = lang === 'latin' ? LATIN[n.letter] : LETTERS[n.letter];
  const a = n.acc > 0 ? '♯'.repeat(n.acc) : n.acc < 0 ? '♭'.repeat(-n.acc) : '';
  return base + a;
}

export function pcLabel(pc: number, pref: AccPref, lang: Lang): string {
  return noteLabel(pcSpelling(pc, pref), lang);
}

/** Nome com as duas grafias quando há acidente, ex.: "C♯/D♭". */
export function pcLabelBoth(pc: number, lang: Lang): string {
  const s = pcLabel(pc, 'sharp', lang);
  const f = pcLabel(pc, 'flat', lang);
  return s === f ? s : `${s}/${f}`;
}

// ---------- Escalas ----------

export interface ScaleDef {
  id: string;
  name: string;
  group: string;
  formula: string[];
}

export const SCALE_GROUPS = ['Maior / Menor', 'Pentatônicas e Blues', 'Modos', 'Outras'];

export const SCALES: ScaleDef[] = [
  { id: 'major', name: 'Maior (Jônio)', group: 'Maior / Menor', formula: ['1', '2', '3', '4', '5', '6', '7'] },
  { id: 'natural-minor', name: 'Menor natural (Eólio)', group: 'Maior / Menor', formula: ['1', '2', 'b3', '4', '5', 'b6', 'b7'] },
  { id: 'harmonic-minor', name: 'Menor harmônica', group: 'Maior / Menor', formula: ['1', '2', 'b3', '4', '5', 'b6', '7'] },
  { id: 'melodic-minor', name: 'Menor melódica', group: 'Maior / Menor', formula: ['1', '2', 'b3', '4', '5', '6', '7'] },
  { id: 'harmonic-major', name: 'Maior harmônica', group: 'Maior / Menor', formula: ['1', '2', '3', '4', '5', 'b6', '7'] },
  { id: 'major-pent', name: 'Pentatônica maior', group: 'Pentatônicas e Blues', formula: ['1', '2', '3', '5', '6'] },
  { id: 'minor-pent', name: 'Pentatônica menor', group: 'Pentatônicas e Blues', formula: ['1', 'b3', '4', '5', 'b7'] },
  { id: 'blues-minor', name: 'Blues menor', group: 'Pentatônicas e Blues', formula: ['1', 'b3', '4', 'b5', '5', 'b7'] },
  { id: 'blues-major', name: 'Blues maior', group: 'Pentatônicas e Blues', formula: ['1', '2', 'b3', '3', '5', '6'] },
  { id: 'dorian', name: 'Dórico', group: 'Modos', formula: ['1', '2', 'b3', '4', '5', '6', 'b7'] },
  { id: 'phrygian', name: 'Frígio', group: 'Modos', formula: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'] },
  { id: 'lydian', name: 'Lídio', group: 'Modos', formula: ['1', '2', '3', '#4', '5', '6', '7'] },
  { id: 'mixolydian', name: 'Mixolídio', group: 'Modos', formula: ['1', '2', '3', '4', '5', '6', 'b7'] },
  { id: 'locrian', name: 'Lócrio', group: 'Modos', formula: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'] },
  { id: 'phrygian-dominant', name: 'Frígio dominante', group: 'Outras', formula: ['1', 'b2', '3', '4', '5', 'b6', 'b7'] },
  { id: 'lydian-dominant', name: 'Lídio dominante', group: 'Outras', formula: ['1', '2', '3', '#4', '5', '6', 'b7'] },
  { id: 'altered', name: 'Alterada (Super lócrio)', group: 'Outras', formula: ['1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'] },
  { id: 'hungarian-minor', name: 'Húngara menor', group: 'Outras', formula: ['1', '2', 'b3', '#4', '5', 'b6', '7'] },
  { id: 'whole-tone', name: 'Tons inteiros', group: 'Outras', formula: ['1', '2', '3', '#4', '#5', 'b7'] },
  { id: 'diminished', name: 'Diminuta (tom-semitom)', group: 'Outras', formula: ['1', '2', 'b3', '4', 'b5', 'b6', '6', '7'] },
];

export const scaleById = (id: string) => SCALES.find((s) => s.id === id) ?? SCALES[0];

const MAJOR_SEMIS: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 };

export function tokenSemis(token: string): number {
  const m = /^([b#]*)(\d+)$/.exec(token)!;
  const acc = [...m[1]].reduce((a, c) => a + (c === '#' ? 1 : -1), 0);
  return mod12(MAJOR_SEMIS[((+m[2] - 1) % 7) + 1] + acc);
}

export const INTERVAL_TOKENS = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
export const INTERVAL_NAMES = ['Uníssono', '2ª menor', '2ª maior', '3ª menor', '3ª maior', '4ª justa', 'Trítono', '5ª justa', '6ª menor', '6ª maior', '7ª menor', '7ª maior'];

export interface ScaleNote {
  index: number;
  token: string;
  semis: number;
  pc: number;
  spelled: Spelled;
}

export interface Scale {
  def: ScaleDef;
  rootPc: number;
  root: Spelled;
  notes: ScaleNote[];
  byPc: Map<number, ScaleNote>;
}

/** Nomeia as notas de uma fórmula (graus) sobre uma tônica, respeitando as letras (Eb G Bb, não D# G A#). */
export function spellFormula(rootPc: number, formula: string[], pref: AccPref): ScaleNote[] {
  const root = pcSpelling(rootPc, pref);
  return formula.map((token, index) => {
    const semis = tokenSemis(token);
    const pc = mod12(rootPc + semis);
    const degree = +token.replace(/[b#]/g, '');
    const letter = (root.letter + degree - 1) % 7;
    const acc = mod12(pc - LETTER_PC[letter] + 6) - 6;
    const spelled = Math.abs(acc) > 2 ? pcSpelling(pc, pref) : { letter, acc };
    return { index, token, semis, pc, spelled };
  });
}

export function buildScale(def: ScaleDef, rootPc: number, pref: AccPref): Scale {
  const root = pcSpelling(rootPc, pref);
  const notes = spellFormula(rootPc, def.formula, pref);
  return { def, rootPc, root, notes, byPc: new Map(notes.map((n) => [n.pc, n])) };
}

/** Notas do arpejo/acorde dentro da escala (1, 3, 5, 7). */
export function chordToneTokens(scale: Scale): Set<string> {
  const has = new Set(scale.def.formula);
  const out = new Set(['1', 'b3', '3', '5', 'b7', '7'].filter((t) => has.has(t)));
  if (!out.has('5') && has.has('b5')) out.add('b5');
  return out;
}

// ---------- Afinações ----------

export interface Tuning {
  id: string;
  name: string;
  midi: number[]; // da corda mais grave para a mais aguda
}

export const TUNINGS: Tuning[] = [
  { id: 'standard', name: 'Padrão (E A D G B E)', midi: [40, 45, 50, 55, 59, 64] },
  { id: 'half-down', name: 'Meio tom abaixo (Eb)', midi: [39, 44, 49, 54, 58, 63] },
  { id: 'd-standard', name: 'Tom abaixo (D)', midi: [38, 43, 48, 53, 57, 62] },
  { id: 'drop-d', name: 'Drop D', midi: [38, 45, 50, 55, 59, 64] },
  { id: 'dadgad', name: 'DADGAD', midi: [38, 45, 50, 55, 57, 62] },
  { id: 'open-g', name: 'Open G (D G D G B D)', midi: [38, 43, 50, 55, 59, 62] },
  { id: 'open-d', name: 'Open D (D A D F# A D)', midi: [38, 45, 50, 54, 57, 62] },
  { id: 'seven', name: '7 cordas (B E A D G B E)', midi: [35, 40, 45, 50, 55, 59, 64] },
  { id: 'bass', name: 'Baixo 4 cordas (E A D G)', midi: [28, 33, 38, 43] },
];

export const tuningById = (id: string) => TUNINGS.find((t) => t.id === id) ?? TUNINGS[0];

export const pcAt = (tuning: number[], string: number, fret: number) => mod12(tuning[string] + fret);

// ---------- Posições (shapes) ----------

export interface FretNote {
  string: number;
  fret: number;
  pc: number;
}

export interface Position {
  index: number; // 0-based: grau da escala onde a posição começa na corda mais grave
  label: string;
  clusters: FretNote[][]; // a mesma forma repetida em oitavas diferentes
  notes: FretNote[];
}

export const MAX_FRET = 24;

/**
 * Posições "contínuas": cada corda recebe as próximas N notas da escala
 * (3 por corda em escalas de 7 notas, 2 nas pentatônicas), como nos sistemas
 * de 7 posições e 5 caixas.
 */
function sevenPositions(scale: Scale, tuning: number[]): Position[] {
  const semis = scale.notes.map((n) => n.semis);
  const n = semis.length;
  const nStr = tuning.length;
  const counts = n === 5 ? [2] : n === 6 ? [2, 3] : [3];

  const positions: Position[] = [];
  for (let k = 0; k < n; k++) {
    const pitchAt = (p0: number, j: number) => p0 + semis[(k + j) % n] + 12 * Math.floor((k + j) / n) - semis[k];

    let f0 = 0;
    while (mod12(tuning[0] + f0 - scale.rootPc) !== semis[k]) f0++;
    const base = tuning[0] + f0;

    const build = (shift: number): FretNote[] | null => {
      const p0 = base + shift;
      const notes: FretNote[] = [];
      let j = 0;
      let firstFret = 0;
      let prevC = 0;
      for (let s = 0; s < nStr; s++) {
        let c = counts[0];
        if (counts.length > 1) {
          if (s === nStr - 1) c = prevC === 3 ? 2 : 3;
          else {
            let best = Infinity;
            for (const cand of counts) {
              const next = pitchAt(p0, j + cand) - tuning[s + 1];
              const cost = Math.abs(next - firstFret) + (next < 0 ? 99 : 0);
              if (cost < best) {
                best = cost;
                c = cand;
              }
            }
          }
        }
        for (let i = 0; i < c; i++) {
          const pitch = pitchAt(p0, j + i);
          const fret = pitch - tuning[s];
          if (fret < 0 || fret > MAX_FRET) return null;
          if (i === 0) firstFret = fret;
          notes.push({ string: s, fret, pc: mod12(pitch) });
        }
        j += c;
        prevC = c;
      }
      return notes;
    };

    const clusters = [-12, 0, 12, 24].map(build).filter((c): c is FretNote[] => !!c);
    clusters.sort((a, b) => Math.min(...a.map((x) => x.fret)) - Math.min(...b.map((x) => x.fret)));
    positions.push({
      index: k,
      label: `${k + 1}`,
      clusters,
      notes: clusters.flat(),
    });
  }
  return positions;
}

/** Sistema de posições: "seven" = 7 posições de 3 notas por corda; "caged" = as 5 formas (caixas) usadas com o CAGED. */
export type PositionSystem = 'seven' | 'caged';

/** Escalas que são modos da maior: a distância (em semitons) da tônica do modo até a tônica da maior "pai". */
const MODE_OFFSET: Record<string, number> = { major: 0, dorian: 2, phrygian: 4, lydian: 5, mixolydian: 7, 'natural-minor': 9, locrian: 11 };

/** Existem 5 formas para escalas de 7 notas. */
export const hasCagedShapes = (scale: Scale) => scale.notes.length === 7;

/**
 * As 5 formas do CAGED: cada forma é "todas as notas da escala" dentro da janela de casas de uma das 5 caixas da
 * pentatônica (maior pentatônica da maior "pai", nos modos; menor ou maior pentatônica da tônica, nas demais).
 * Ex.: Lá menor natural, forma 1 = casas 5 a 8 (E: 5 7 8 · A: 5 7 8 · D: 5 7 · G: 5 7 · B: 5 6 8 · e: 5 7 8).
 * A forma 1 é a caixa que começa na tônica (ou no grau da pentatônica logo acima dela) na corda mais grave.
 */
export function cagedPositions(scale: Scale, tuning: number[]): Position[] | null {
  if (!hasCagedShapes(scale)) return null;
  const offset = MODE_OFFSET[scale.def.id];
  const pentDef = scaleById(offset !== undefined ? 'major-pent' : scale.def.formula.includes('b3') ? 'minor-pent' : 'major-pent');
  const pentRoot = offset !== undefined ? mod12(scale.rootPc - offset) : scale.rootPc;
  const pent = buildScale(pentDef, pentRoot, 'sharp');
  const boxes = sevenPositions(pent, tuning); // numa pentatônica são as 5 caixas
  if (boxes.length !== 5 || boxes.some((b) => !b.clusters.length)) return null;

  let start = 0;
  let best = 12;
  pent.notes.forEach((n, i) => {
    const d = mod12(n.pc - scale.rootPc);
    if (d < best) {
      best = d;
      start = i;
    }
  });

  return Array.from({ length: 5 }, (_, n) => {
    const box = boxes[(start + n) % 5];
    const clusters = box.clusters
      .map((c) => {
        const lo = Math.min(...c.map((x) => x.fret));
        const hi = Math.max(...c.map((x) => x.fret));
        const notes: FretNote[] = [];
        for (let st = 0; st < tuning.length; st++) {
          for (let f = lo; f <= hi; f++) {
            const pc = mod12(tuning[st] + f);
            if (scale.byPc.has(pc)) notes.push({ string: st, fret: f, pc });
          }
        }
        return notes;
      })
      .filter((c) => c.length > 0);
    return { index: n, label: `${n + 1}`, clusters, notes: clusters.flat() };
  });
}

/** Posições da escala no sistema pedido (se a escala não tem 5 formas, volta às 7 posições). */
export function scalePositions(scale: Scale, tuning: number[], system: PositionSystem = 'seven'): Position[] {
  if (system === 'caged') {
    const caged = cagedPositions(scale, tuning);
    if (caged) return caged;
  }
  return sevenPositions(scale, tuning);
}

export const stringNumber = (string: number, total: number) => total - string; // 1 = mais aguda

// ---------- Utilidades ----------

export const randInt = (n: number) => Math.floor(Math.random() * n);
export const pick = <T,>(arr: readonly T[]): T => arr[randInt(arr.length)];
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
