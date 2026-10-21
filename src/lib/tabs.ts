/**
 * Tablaturas e acordes em texto que o site consegue TOCAR e mostrar no braço.
 *
 * Dois formatos reconhecidos nos exemplos das lições:
 *  - tablatura ASCII de 6 linhas (e B G D A E), com h, p, / e \ para ligados e slides;
 *  - acorde em texto: "corda: 6 5 4 3 2 1" / "casa: x 3 2 0 1 0".
 */

export interface TabNote {
  string: number; // 0 = corda mais grave
  fret: number;
  legato: boolean; // veio de ligado/slide: soa mais suave
}
export interface TabStep {
  notes: TabNote[];
  col: number; // coluna do texto onde o passo começa
}
export type Playable = { kind: 'tab'; steps: TabStep[]; maxFret: number } | { kind: 'chord'; frets: number[] };

export const STANDARD_MIDI = [40, 45, 50, 55, 59, 64];
export const MAX_TAB_FRET = 24;
const ROW = /^\s*([eEBGDAa-g])\s*\|(.*)$/;
const BODY = /^[\d\-\s|hpbr/\\~x()^.]*$/;

/** Reconhece um bloco de 6 linhas de tablatura. Devolve null se não for uma tablatura válida. */
export function parseTab(text: string): Extract<Playable, { kind: 'tab' }> | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length !== 6) return null;
  const bodies: string[] = [];
  for (const l of lines) {
    const m = ROW.exec(l);
    if (!m || !BODY.test(m[2])) return null;
    bodies.push(m[2]);
  }

  interface Raw {
    row: number;
    start: number;
    end: number;
    fret: number;
    legato: boolean;
  }
  const raws: Raw[] = [];
  bodies.forEach((body, row) => {
    for (const m of body.matchAll(/\d+/g)) {
      const start = m.index!;
      raws.push({ row, start, end: start + m[0].length - 1, fret: Number(m[0]), legato: start > 0 && 'hp/\\'.includes(body[start - 1]) });
    }
  });
  if (!raws.length || raws.some((r) => r.fret > MAX_TAB_FRET)) return null;

  // notas que se sobrepõem em colunas soam juntas (acorde); as demais viram passos em sequência
  raws.sort((a, b) => a.start - b.start || a.row - b.row);
  const steps: TabStep[] = [];
  let groupEnd = -1;
  for (const r of raws) {
    if (!steps.length || r.start > groupEnd) {
      steps.push({ notes: [], col: r.start });
      groupEnd = r.end;
    } else groupEnd = Math.max(groupEnd, r.end);
    const note: TabNote = { string: 5 - r.row, fret: r.fret, legato: r.legato };
    const step = steps[steps.length - 1];
    if (!step.notes.some((n) => n.string === note.string)) step.notes.push(note);
  }
  for (const s of steps) s.notes.sort((a, b) => a.string - b.string);
  return { kind: 'tab', steps, maxFret: Math.max(...raws.map((r) => r.fret)) };
}

/** "corda: 6 5 4 3 2 1" + "casa: x 3 2 0 1 0" → casas por corda (da mais grave para a mais aguda; -1 = não tocar). */
export function parseChordText(text: string): Extract<Playable, { kind: 'chord' }> | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length !== 2) return null;
  const strings = /^corda:\s*(.+)$/i.exec(lines[0])?.[1].split(/\s+/);
  const frets = /^casa:\s*(.+)$/i.exec(lines[1])?.[1].split(/\s+/);
  if (!strings || !frets || strings.join(' ') !== '6 5 4 3 2 1' || frets.length !== 6) return null;
  const out = frets.map((f) => (/^x$/i.test(f) ? -1 : /^\d{1,2}$/.test(f) ? Number(f) : NaN));
  if (out.some((f) => Number.isNaN(f) || f > MAX_TAB_FRET)) return null;
  return out.filter((f) => f >= 0).length >= 2 ? { kind: 'chord', frets: out } : null;
}

export function playableOf(text: string): Playable | null {
  return parseTab(text) ?? parseChordText(text);
}

export const midiAt = (string: number, fret: number, tuning: number[] = STANDARD_MIDI) => tuning[string] + fret;

// ---------- geração de tablatura em texto (para escrever exemplos sem errar o alinhamento) ----------

export interface TabSpec {
  str: number; // 1 = corda mais aguda … 6 = mais grave (como se fala)
  fret: number;
  link?: 'h' | 'p' | '/' | '\\'; // ligado/slide a partir da nota anterior
}

const LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];

/** Monta a tablatura ASCII a partir de uma lista de passos (cada passo = notas que soam juntas). */
export function renderTab(steps: TabSpec[][]): string {
  const rows = LABELS.map((l) => `${l}|-`);
  for (const step of steps) {
    const width = 1 + Math.max(...step.map((n) => String(n.fret).length));
    for (let r = 0; r < 6; r++) {
      const n = step.find((x) => x.str === r + 1);
      rows[r] += n ? `${n.link ?? '-'}${n.fret}`.padEnd(width, '-') : '-'.repeat(width);
    }
  }
  return rows.map((r) => `${r}-|`).join('\n');
}
