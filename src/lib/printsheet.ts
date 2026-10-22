/**
 * Folhas para imprimir (shapes de escalas, braço inteiro, acordes, campo harmônico e braço em branco).
 *
 * Tudo aqui é puro: a configuração é validada em `normalizePrint` e `buildSheet` devolve os diagramas já
 * calculados (casas, notas, rótulos e papéis das notas). O desenho fica em PrintBoard.tsx e a tela em pages/Print.tsx.
 */
import { chordNotes, chordTypeById, findVoicings, CHORD_TYPES } from './chords';
import { FIELDS, FUNC_NAMES, buildField, fieldById } from './harmony';
import { INTERVAL_TOKENS, MAX_FRET, SCALES, buildScale, chordToneTokens, mod12, noteLabel, pcLabel, scaleById, scalePositions, tuningById, TUNINGS, type AccPref, type Lang, type Scale } from './music';

export const PRINT_KEY = 'ss.print';

export type PrintKind = 'shapes' | 'neck' | 'chord' | 'field' | 'blank';
export type LabelMode = 'note' | 'degree' | 'none';
export type Highlight = 'none' | 'root' | 'tsd' | 'chordtones';
export type NeckContent = 'scale' | 'all' | 'empty';
export type Direction = 'auto' | 'h' | 'v';
export type Paper = 'a4' | 'letter';

export interface PrintConfig {
  kind: PrintKind;
  root: number;
  scaleId: string;
  positions: number[]; // posições escolhidas (índices); vazio = todas
  region: number; // 0 = região mais grave do braço
  neckContent: NeckContent;
  fretMax: number;
  chordType: string;
  chordView: 'neck' | 'voicings';
  voicings: number;
  fieldId: string;
  fieldSize: 'triads' | 'tetrads';
  blankCount: number;
  label: LabelMode;
  highlight: Highlight;
  lang: 'auto' | Lang;
  pref: 'auto' | AccPref;
  tuningId: string;
  direction: Direction;
  leftHanded: boolean;
  showNumbers: boolean;
  showInlays: boolean;
  showStringNames: boolean;
  paper: Paper;
  landscape: boolean;
  margin: number; // mm
  cols: number; // 0 = automático
  style: 'color' | 'mono';
  showFooter: boolean;
  title: string; // vazio = título automático
}

export const DEFAULT_PRINT: PrintConfig = {
  kind: 'shapes',
  root: 9,
  scaleId: 'minor-pent',
  positions: [],
  region: 0,
  neckContent: 'scale',
  fretMax: 15,
  chordType: 'maj',
  chordView: 'voicings',
  voicings: 4,
  fieldId: 'major',
  fieldSize: 'triads',
  blankCount: 2,
  label: 'note',
  highlight: 'root',
  lang: 'auto',
  pref: 'auto',
  tuningId: 'standard',
  direction: 'auto',
  leftHanded: false,
  showNumbers: true,
  showInlays: true,
  showStringNames: true,
  paper: 'a4',
  landscape: true,
  margin: 12,
  cols: 0,
  style: 'mono',
  showFooter: true,
  title: '',
};

export const FRET_CHOICES = [12, 15, 17, 19, 22, 24];
export const MARGIN_CHOICES = [6, 10, 12, 15, 20];
export const BLANK_CHOICES = [1, 2, 3, 4, 6];
export const VOICING_CHOICES = [2, 4, 6, 8];
export const PAPER_MM: Record<Paper, { w: number; h: number; name: string }> = { a4: { w: 210, h: 297, name: 'A4' }, letter: { w: 215.9, h: 279.4, name: 'Carta' } };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback);
const int = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback);
const near = (v: unknown, list: number[], fallback: number) => (typeof v === 'number' && list.includes(v) ? v : fallback);

/** Valida uma configuração vinda do armazenamento (ou de um backup): valores inválidos voltam ao padrão. */
export function normalizePrint(raw: unknown): PrintConfig {
  const r = isObj(raw) ? raw : {};
  const D = DEFAULT_PRINT;
  return {
    kind: oneOf(r.kind, ['shapes', 'neck', 'chord', 'field', 'blank'], D.kind),
    root: int(r.root, 0, 11, D.root),
    scaleId: typeof r.scaleId === 'string' && SCALES.some((s) => s.id === r.scaleId) ? r.scaleId : D.scaleId,
    positions: Array.isArray(r.positions) ? [...new Set(r.positions.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 12))].sort((a, b) => a - b) : [],
    region: int(r.region, 0, 3, D.region),
    neckContent: oneOf(r.neckContent, ['scale', 'all', 'empty'], D.neckContent),
    fretMax: near(r.fretMax, FRET_CHOICES, D.fretMax),
    chordType: typeof r.chordType === 'string' && CHORD_TYPES.some((t) => t.id === r.chordType) ? r.chordType : D.chordType,
    chordView: oneOf(r.chordView, ['neck', 'voicings'], D.chordView),
    voicings: near(r.voicings, VOICING_CHOICES, D.voicings),
    fieldId: typeof r.fieldId === 'string' && FIELDS.some((f) => f.id === r.fieldId) ? r.fieldId : D.fieldId,
    fieldSize: oneOf(r.fieldSize, ['triads', 'tetrads'], D.fieldSize),
    blankCount: near(r.blankCount, BLANK_CHOICES, D.blankCount),
    label: oneOf(r.label, ['note', 'degree', 'none'], D.label),
    highlight: oneOf(r.highlight, ['none', 'root', 'tsd', 'chordtones'], D.highlight),
    lang: oneOf(r.lang, ['auto', 'letters', 'latin'], D.lang),
    pref: oneOf(r.pref, ['auto', 'sharp', 'flat'], D.pref),
    tuningId: typeof r.tuningId === 'string' && TUNINGS.some((t) => t.id === r.tuningId) ? r.tuningId : D.tuningId,
    direction: oneOf(r.direction, ['auto', 'h', 'v'], D.direction),
    leftHanded: r.leftHanded === true,
    showNumbers: r.showNumbers !== false,
    showInlays: r.showInlays !== false,
    showStringNames: r.showStringNames !== false,
    paper: oneOf(r.paper, ['a4', 'letter'], D.paper),
    landscape: r.landscape !== false,
    margin: near(r.margin, MARGIN_CHOICES, D.margin),
    cols: int(r.cols, 0, 4, D.cols),
    style: oneOf(r.style, ['color', 'mono'], D.style),
    showFooter: r.showFooter !== false,
    title: typeof r.title === 'string' ? r.title.slice(0, 80) : '',
  };
}

// ---------- diagramas ----------

/** Papel da nota no desenho: define forma e cor. */
export type Role = 'root' | 'sub' | 'dom' | 'chord' | 'tone';

export interface PMarker {
  string: number; // 0 = corda mais grave
  fret: number;
  label?: string;
  role: Role;
}

export interface BoardSpec {
  tuning: number[];
  fretMin: number;
  fretMax: number;
  markers: PMarker[];
  muted: number[]; // cordas que não se tocam (✕)
}

export interface Diagram {
  id: string;
  title: string;
  subtitle?: string;
  board: BoardSpec;
  vertical: boolean;
  description: string; // para leitores de tela
}

export interface LegendItem {
  role: Role;
  text: string;
}

export interface Sheet {
  title: string;
  subtitle: string;
  diagrams: Diagram[];
  legend: LegendItem[];
  cols: number;
  warnings: string[];
}

export interface Names {
  lang: Lang;
  pref: AccPref;
}

const LEGEND_TEXT: Record<Role, string> = {
  root: 'Tônica',
  sub: 'Subdominante (4º grau)',
  dom: 'Dominante (5º grau)',
  chord: 'Notas do acorde (1 · 3 · 5 · 7)',
  tone: 'Demais notas',
};

/** Papel de uma nota, pela distância (em semitons) até a tônica e o destaque pedido. */
export function roleOf(semis: number, highlight: Highlight, inChord = false): Role {
  if (highlight === 'none') return 'tone';
  if (semis === 0) return 'root';
  if (highlight === 'tsd') return semis === 5 ? 'sub' : semis === 7 ? 'dom' : 'tone';
  if (highlight === 'chordtones') return inChord ? 'chord' : 'tone';
  return 'tone';
}

function legendFor(h: Highlight, used: Set<Role>): LegendItem[] {
  const order: Role[] = h === 'tsd' ? ['root', 'sub', 'dom', 'tone'] : h === 'chordtones' ? ['root', 'chord', 'tone'] : h === 'root' ? ['root', 'tone'] : [];
  return order.filter((r) => used.has(r)).map((role) => ({ role, text: LEGEND_TEXT[role] }));
}

// ---------- geometria do desenho (usada pelo SVG e pelo cálculo de layout) ----------

export const SS = 26; // espaço entre cordas (unidades do desenho)

export interface Geometry {
  N: number;
  hasNut: boolean;
  nF: number;
  CELL: number;
  OPEN: number;
  L: number; // comprimento do braço
  across: number;
  topExtra: number;
  padAlong: number;
  X0: number;
  Y0: number;
  vbW: number;
  vbH: number;
}

export function boardGeometry(board: BoardSpec, vertical: boolean, showNumbers: boolean, showStringNames: boolean): Geometry {
  const { tuning, fretMin, fretMax, muted } = board;
  const N = tuning.length;
  const hasNut = fretMin === 0;
  const nF = fretMax - fretMin + 1;
  const CELL = vertical ? 36 : 42;
  const OPEN = hasNut ? (vertical ? 30 : 34) : 0;
  const L = hasNut ? OPEN + fretMax * CELL : nF * CELL;
  const across = (N - 1) * SS;
  const topExtra = vertical ? (showStringNames ? 16 : 0) + (!hasNut && muted.length ? 14 : 0) : 0;
  const padAlong = vertical ? 8 : showStringNames ? 28 : 12;
  const X0 = vertical ? (showNumbers ? 26 : 10) : padAlong;
  const Y0 = vertical ? 8 + topExtra : 18;
  const vbW = vertical ? X0 + across + 20 : padAlong + L + padAlong;
  const vbH = vertical ? Y0 + L + 10 : Y0 + across + 18 + (showNumbers ? 20 : 0);
  return { N, hasNut, nF, CELL, OPEN, L, across, topExtra, padAlong, X0, Y0, vbW, vbH };
}

export interface LayoutOpts {
  showNumbers: boolean;
  showStringNames: boolean;
}

const GAP_MM = 4; // espaço entre diagramas
const CAPTION_MM = 6;

/** Páginas necessárias para `rows` linhas de altura `rowH` (mm), com um cabeçalho de `headH` na primeira página. */
export function pagesFor(rows: number, rowH: number, pageH: number, headH: number): number {
  let pages = 1;
  let left = pageH - headH;
  for (let i = 0; i < rows; i++) {
    if (rowH > left && left < pageH) {
      pages++;
      left = pageH;
    }
    left -= rowH + GAP_MM;
  }
  return pages;
}

/**
 * "Automático": entre 1 e 6 diagramas por linha, escolhe o menor número de colunas (= diagramas maiores)
 * que resulta no menor número de páginas.
 */
export function autoCols(diagrams: Diagram[], area: { w: number; h: number }, opts: LayoutOpts, headH: number): number {
  const n = diagrams.length;
  if (n <= 1) return 1;
  const maxCols = Math.min(6, n);
  let best = 1;
  let bestPages = Infinity;
  for (let cols = 1; cols <= maxCols; cols++) {
    const cardW = (area.w - GAP_MM * (cols - 1)) / cols;
    let rowH = 0;
    for (const d of diagrams) {
      const g = boardGeometry(d.board, d.vertical, opts.showNumbers, opts.showStringNames);
      const h = Math.min(cardW * (g.vbH / g.vbW), area.h - headH - CAPTION_MM) + (d.title || d.subtitle ? CAPTION_MM : 0);
      rowH = Math.max(rowH, h);
    }
    const pages = pagesFor(Math.ceil(n / cols), rowH, area.h, headH);
    if (pages < bestPages) {
      bestPages = pages;
      best = cols;
    }
  }
  return best;
}

export function resolveDirection(c: PrintConfig): boolean {
  if (c.direction === 'h') return false;
  if (c.direction === 'v') return true;
  return (c.kind === 'chord' && c.chordView === 'voicings') || c.kind === 'field';
}

const describe = (title: string, markers: PMarker[], tuning: number[]) => {
  const list = markers.slice(0, 30).map((m) => `corda ${tuning.length - m.string} casa ${m.fret}${m.label ? ` ${m.label}` : ''}`);
  return `${title}.${list.length ? ` Notas: ${list.join('; ')}${markers.length > list.length ? ` e mais ${markers.length - list.length}` : ''}.` : ' Sem notas marcadas.'}`;
};

/** Janela de casas para um conjunto de notas (formas de escala): começa na casa mais baixa e mostra ao menos 5 casas. */
export function windowFor(frets: number[]): { fretMin: number; fretMax: number } {
  const lo = Math.min(...frets);
  const hi = Math.max(...frets);
  const fretMin = lo <= 1 ? 0 : lo;
  return { fretMin, fretMax: Math.min(MAX_FRET, Math.max(hi, fretMin + 4)) };
}

export function buildSheet(raw: PrintConfig, names: Names): Sheet {
  const c = raw;
  const tuning = tuningById(c.tuningId).midi;
  const vertical = resolveDirection(c);
  const warnings: string[] = [];
  const used = new Set<Role>();
  const diagrams: Diagram[] = [];
  const label = (text: string | undefined) => (c.label === 'none' ? undefined : text);
  const mark = (m: PMarker) => {
    used.add(m.role);
    return m;
  };
  let title = '';
  let subtitle = '';
  let highlight = c.highlight;

  const rootName = pcLabel(c.root, names.pref, names.lang);
  const scale: Scale = buildScale(scaleById(c.scaleId), c.root, names.pref);
  const scaleTitle = `${noteLabel(scale.root, names.lang)} ${scale.def.name}`;

  /** Rótulo e papel de uma nota da escala. */
  const scaleMark = (s: number, f: number, chordTok: Set<string>): PMarker | null => {
    const pc = mod12(tuning[s] + f);
    const note = scale.byPc.get(pc);
    if (!note) return null;
    const role = roleOf(mod12(pc - c.root), highlight, chordTok.has(note.token));
    const text = c.label === 'degree' ? note.token : noteLabel(note.spelled, names.lang);
    return mark({ string: s, fret: f, label: label(text), role });
  };

  if (c.kind === 'shapes') {
    title = `${scaleTitle} — shapes`;
    subtitle = `${scale.notes.map((n) => noteLabel(n.spelled, names.lang)).join(' · ')}  |  ${scale.def.formula.join(' ')}`;
    const chordTok = chordToneTokens(scale);
    const positions = scalePositions(scale, tuning);
    const wanted = c.positions.length ? c.positions.filter((i) => i < positions.length) : positions.map((p) => p.index);
    if (c.positions.length && wanted.length < c.positions.length) warnings.push('Algumas posições escolhidas não existem nesta escala e foram ignoradas.');
    for (const i of wanted) {
      const pos = positions[i];
      const cluster = pos.clusters[Math.min(c.region, pos.clusters.length - 1)];
      if (!cluster || !cluster.length) {
        warnings.push(`A posição ${i + 1} não cabe neste braço (afinação ou número de cordas).`);
        continue;
      }
      const win = windowFor(cluster.map((n) => n.fret));
      const markers = cluster.map((n) => scaleMark(n.string, n.fret, chordTok)).filter((m): m is PMarker => !!m);
      const lo = Math.min(...cluster.map((n) => n.fret));
      const hi = Math.max(...cluster.map((n) => n.fret));
      const t = `Posição ${i + 1}`;
      diagrams.push({ id: `pos-${i}`, title: t, subtitle: `casas ${lo}–${hi}`, board: { tuning, ...win, markers, muted: [] }, vertical, description: describe(`${scaleTitle}, ${t}`, markers, tuning) });
    }
  } else if (c.kind === 'neck') {
    const chordTok = chordToneTokens(scale);
    const markers: PMarker[] = [];
    if (c.neckContent !== 'empty') {
      for (let s = 0; s < tuning.length; s++) {
        for (let f = 0; f <= c.fretMax; f++) {
          const pc = mod12(tuning[s] + f);
          if (c.neckContent === 'scale') {
            const m = scaleMark(s, f, chordTok);
            if (m) markers.push(m);
          } else {
            const note = scale.byPc.get(pc);
            const semis = mod12(pc - c.root);
            const text = c.label === 'degree' ? (note?.token ?? INTERVAL_TOKENS[semis]) : note ? noteLabel(note.spelled, names.lang) : pcLabel(pc, names.pref, names.lang);
            markers.push(mark({ string: s, fret: f, label: label(text), role: roleOf(semis, highlight, !!note && chordTok.has(note.token)) }));
          }
        }
      }
    }
    if (c.neckContent === 'scale') {
      title = `${scaleTitle} — braço`;
      subtitle = scale.notes.map((n) => noteLabel(n.spelled, names.lang)).join(' · ');
    } else if (c.neckContent === 'all') {
      title = `Todas as notas do braço`;
      subtitle = `Referência: tônica ${rootName}`;
    } else {
      title = 'Braço em branco';
      highlight = 'none';
    }
    diagrams.push({ id: 'neck', title: '', board: { tuning, fretMin: 0, fretMax: c.fretMax, markers, muted: [] }, vertical, description: describe(title, markers, tuning) });
  } else if (c.kind === 'chord') {
    const type = chordTypeById(c.chordType);
    const notes = chordNotes(c.root, type, names.pref);
    const byPc = new Map(notes.map((n) => [n.pc, n]));
    const symbol = `${rootName}${type.symbol}`;
    title = `${symbol} — ${pcLabel(c.root, names.pref, 'latin')} ${type.name}`;
    subtitle = `Notas: ${notes.map((n) => noteLabel(n.spelled, names.lang)).join(' · ')}  |  ${type.tokens.join(' ')}`;
    highlight = highlight === 'none' ? 'none' : 'root';
    const at = (s: number, f: number): PMarker | null => {
      const n = byPc.get(mod12(tuning[s] + f));
      if (!n) return null;
      return mark({ string: s, fret: f, label: label(c.label === 'degree' ? n.token : noteLabel(n.spelled, names.lang)), role: roleOf(mod12(n.pc - c.root), highlight) });
    };
    if (c.chordView === 'neck') {
      const markers: PMarker[] = [];
      for (let s = 0; s < tuning.length; s++) for (let f = 0; f <= c.fretMax; f++) {
        const m = at(s, f);
        if (m) markers.push(m);
      }
      diagrams.push({ id: 'chord-neck', title: '', board: { tuning, fretMin: 0, fretMax: c.fretMax, markers, muted: [] }, vertical, description: describe(title, markers, tuning) });
    } else {
      const found = findVoicings(c.root, type, tuning, c.voicings);
      if (!found.length) warnings.push('Não encontrei digitações para este acorde nesta afinação.');
      found.forEach((v, i) => {
        diagrams.push(voicingDiagram(`voicing-${i}`, `Forma ${i + 1}`, v.frets, tuning, at, vertical, title));
      });
    }
  } else if (c.kind === 'field') {
    const def = fieldById(c.fieldId);
    const field = buildField(def, c.root, names.pref);
    const tetrad = c.fieldSize === 'tetrads';
    title = `Campo harmônico de ${noteLabel(field.scale.root, names.lang)} — ${def.name} (${tetrad ? 'tétrades' : 'tríades'})`;
    subtitle = field.scale.notes.map((n) => noteLabel(n.spelled, names.lang)).join(' · ');
    highlight = highlight === 'none' ? 'none' : 'root';
    for (const fc of field.chords) {
      const type = tetrad ? fc.tetrad : fc.triad;
      const notes = tetrad ? fc.tetradNotes : fc.triadNotes;
      const byPc = new Map(notes.map((n) => [n.pc, n]));
      const symbol = tetrad ? fc.symbolTetrad : fc.symbol;
      const at = (s: number, f: number): PMarker | null => {
        const n = byPc.get(mod12(tuning[s] + f));
        if (!n) return null;
        const idx = notes.indexOf(n);
        const degree = ['1', '3', '5', '7'][idx] ?? n.token;
        return mark({ string: s, fret: f, label: label(c.label === 'degree' ? degree : noteLabel(n.spelled, names.lang)), role: roleOf(mod12(n.pc - fc.rootPc), highlight) });
      };
      const v = findVoicings(fc.rootPc, type, tuning, 1)[0];
      const head = `${tetrad ? fc.romanTetrad : fc.roman} — ${symbol}`;
      if (!v) {
        warnings.push(`Sem digitação para ${symbol} nesta afinação.`);
        continue;
      }
      const d = voicingDiagram(`field-${fc.degree}`, head, v.frets, tuning, at, vertical, head);
      d.subtitle = [fc.func ? FUNC_NAMES[fc.func].name : '', d.subtitle].filter(Boolean).join(' · ');
      diagrams.push(d);
    }
  } else {
    title = 'Braço em branco';
    highlight = 'none';
    for (let i = 0; i < c.blankCount; i++) {
      diagrams.push({ id: `blank-${i}`, title: '', board: { tuning, fretMin: 0, fretMax: c.fretMax, markers: [], muted: [] }, vertical, description: `Braço em branco, casas 0 a ${c.fretMax}.` });
    }
  }

  const customTitle = c.title.trim();
  const full = customTitle || title;
  const baseSub = subtitle;
  const sub = [baseSub, `Afinação: ${tuningById(c.tuningId).name}`].filter(Boolean).join('  ·  ');
  const area = printableMm(c);
  const headH = 12 + (sub ? 5 : 0) + (legendFor(highlight, used).length ? 8 : 0) + (c.showFooter ? 8 : 0);
  const cols = c.cols > 0 ? Math.min(c.cols, Math.max(1, diagrams.length)) : autoCols(diagrams, area, { showNumbers: c.showNumbers, showStringNames: c.showStringNames }, headH);
  return { title: full, subtitle: sub, diagrams, legend: legendFor(highlight, used), cols, warnings };
}

/** Diagrama de acorde (digitação): janela de casas, notas tocadas e cordas silenciadas. */
function voicingDiagram(id: string, title: string, frets: number[], tuning: number[], at: (s: number, f: number) => PMarker | null, vertical: boolean, desc: string): Diagram {
  const fretted = frets.filter((f) => f > 0);
  const maxF = fretted.length ? Math.max(...fretted) : 0;
  const minF = fretted.length ? Math.min(...fretted) : 1;
  const low = maxF <= 4;
  const fretMin = low ? 0 : minF;
  const fretMax = low ? Math.max(4, maxF) : fretMin + 4;
  const markers: PMarker[] = [];
  const muted: number[] = [];
  frets.forEach((f, s) => {
    if (f < 0) {
      muted.push(s);
      return;
    }
    const m = at(s, f);
    if (m) markers.push(m);
  });
  const sub = frets.map((f) => (f < 0 ? 'x' : f)).join(frets.some((f) => f > 9) ? '-' : '');
  return { id, title, subtitle: sub, board: { tuning, fretMin, fretMax, markers, muted }, vertical, description: describe(`${desc}, ${title}, casas ${sub}`, markers, tuning) };
}

/** Altura útil (mm) de uma página, descontadas as margens, para limitar o tamanho dos diagramas. */
export function printableMm(c: Pick<PrintConfig, 'paper' | 'landscape' | 'margin'>): { w: number; h: number } {
  const p = PAPER_MM[c.paper];
  const [w, h] = c.landscape ? [p.h, p.w] : [p.w, p.h];
  return { w: w - 2 * c.margin, h: h - 2 * c.margin };
}

/** Título do arquivo/da impressão. */
export const printDocTitle = (sheet: Sheet) => `${sheet.title} — SongState`;
