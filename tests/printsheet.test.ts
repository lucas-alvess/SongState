import { describe, expect, it } from 'vitest';
import { CHORD_TYPES, chordPcs } from '../src/lib/chords';
import { FIELDS } from '../src/lib/harmony';
import { SCALES, TUNINGS, mod12, tokenSemis } from '../src/lib/music';
import { DEFAULT_PRINT, FRET_CHOICES, PAPER_MM, autoCols, boardGeometry, buildSheet, normalizePrint, pagesFor, printableMm, resolveDirection, roleOf, windowFor, type PrintConfig } from '../src/lib/printsheet';

const names = { lang: 'letters' as const, pref: 'sharp' as const };
const cfg = (o: Partial<PrintConfig> = {}): PrintConfig => ({ ...DEFAULT_PRINT, ...o });
const STD = TUNINGS[0].midi;
const pcOf = (s: number, f: number, tuning = STD) => mod12(tuning[s] + f);

describe('normalizePrint', () => {
  it('lixo ou valores inválidos voltam ao padrão', () => {
    expect(normalizePrint(null)).toEqual(DEFAULT_PRINT);
    expect(normalizePrint('x')).toEqual(DEFAULT_PRINT);
    expect(normalizePrint([1, 2])).toEqual(DEFAULT_PRINT);
    const n = normalizePrint({ kind: 'foo', root: 99, scaleId: 'nope', positions: [1, 1, -3, 99, 'a', 2.5, 0], fretMax: 13, paper: 'a0', margin: 3, cols: 50, style: 7, title: 'x'.repeat(200), tuningId: 'x', chordType: 'zzz', fieldId: 'q' });
    expect(n.kind).toBe('shapes');
    expect(n.root).toBe(11);
    expect(n.scaleId).toBe(DEFAULT_PRINT.scaleId);
    expect(n.positions).toEqual([0, 1]);
    expect(n.fretMax).toBe(DEFAULT_PRINT.fretMax);
    expect(n.paper).toBe('a4');
    expect(n.margin).toBe(DEFAULT_PRINT.margin);
    expect(n.cols).toBe(4);
    expect(n.style).toBe('mono');
    expect(n.title).toHaveLength(80);
    expect(n.tuningId).toBe('standard');
    expect(n.chordType).toBe(DEFAULT_PRINT.chordType);
    expect(n.fieldId).toBe(DEFAULT_PRINT.fieldId);
  });

  it('valores válidos são mantidos', () => {
    const c = cfg({ kind: 'field', root: 3, scaleId: 'dorian', positions: [0, 2], fretMax: 22, paper: 'letter', landscape: false, margin: 20, cols: 3, style: 'color', leftHanded: true, label: 'degree', highlight: 'tsd' });
    expect(normalizePrint(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });

  it('é idempotente', () => {
    const once = normalizePrint({ kind: 'neck', root: 5.6, fretMax: 17 });
    expect(normalizePrint(once)).toEqual(once);
  });
});

describe('papéis das notas', () => {
  it('tônica, subdominante (4ª justa) e dominante (5ª justa)', () => {
    expect([0, 5, 7, 3].map((s) => roleOf(s, 'tsd'))).toEqual(['root', 'sub', 'dom', 'tone']);
    expect([0, 5, 7].map((s) => roleOf(s, 'root'))).toEqual(['root', 'tone', 'tone']);
    expect([0, 5].map((s) => roleOf(s, 'none'))).toEqual(['tone', 'tone']);
    expect(roleOf(4, 'chordtones', true)).toBe('chord');
    expect(roleOf(2, 'chordtones', false)).toBe('tone');
    expect(roleOf(0, 'chordtones', true)).toBe('root');
  });
});

describe('shapes da escala', () => {
  it('pentatônica menor de Lá: 5 posições, 12 notas cada, só notas da escala', () => {
    const s = buildSheet(cfg({ kind: 'shapes', root: 9, scaleId: 'minor-pent' }), names);
    expect(s.diagrams).toHaveLength(5);
    const pcs = new Set([9, 0, 2, 4, 7]);
    for (const d of s.diagrams) {
      expect(d.board.markers).toHaveLength(12);
      for (const m of d.board.markers) {
        expect(pcs.has(pcOf(m.string, m.fret))).toBe(true);
        expect(m.fret).toBeGreaterThanOrEqual(d.board.fretMin);
        expect(m.fret).toBeLessThanOrEqual(d.board.fretMax);
      }
      expect(d.board.fretMax - d.board.fretMin).toBeGreaterThanOrEqual(4);
    }
    expect(s.title).toContain('Pentatônica menor');
    expect(s.title).toContain('A');
  });

  it('só as posições escolhidas, e posições inexistentes geram aviso', () => {
    const s = buildSheet(cfg({ kind: 'shapes', positions: [0, 3] }), names);
    expect(s.diagrams.map((d) => d.id)).toEqual(['pos-0', 'pos-3']);
    const w = buildSheet(cfg({ kind: 'shapes', positions: [0, 9] }), names);
    expect(w.diagrams).toHaveLength(1);
    expect(w.warnings.join(' ')).toMatch(/não existem/);
  });

  it('escala de 7 notas: 5 formas (CAGED, padrão) ou 7 posições de 3 notas por corda', () => {
    expect(buildSheet(cfg({ kind: 'shapes', scaleId: 'major', root: 0 }), names).diagrams).toHaveLength(5);
    expect(buildSheet(cfg({ kind: 'shapes', scaleId: 'major', root: 0, system: 'caged' }), names).diagrams).toHaveLength(5);
    expect(buildSheet(cfg({ kind: 'shapes', scaleId: 'major', root: 0, system: 'seven' }), names).diagrams).toHaveLength(7);
    expect(buildSheet(cfg({ kind: 'shapes', scaleId: 'minor-pent', system: 'seven' }), names).diagrams).toHaveLength(5);
  });

  it('Lá menor natural em 5 formas: a forma 1 é a caixa das casas 5 a 8', () => {
    const s = buildSheet(cfg({ kind: 'shapes', scaleId: 'natural-minor', root: 9, label: 'note' }), names);
    expect(s.title).toMatch(/(5 formas)/);
    const d = s.diagrams[0];
    expect(d.board.fretMin).toBe(5);
    expect(d.board.fretMax).toBe(9);
    const frets = (str: number) => d.board.markers.filter((m) => m.string === str).map((m) => m.fret).sort((a, b) => a - b);
    expect([0, 1, 2, 3, 4, 5].map(frets)).toEqual([[5, 7, 8], [5, 7, 8], [5, 7], [5, 7], [5, 6, 8], [5, 7, 8]]);
    expect(buildSheet(cfg({ kind: 'shapes', scaleId: 'natural-minor', root: 9, system: 'seven' }), names).title).toMatch(/(7 posições)/);
  });

  it('destaque: tônica = 1 por corda grave, subdominante e dominante nas notas certas', () => {
    const s = buildSheet(cfg({ kind: 'shapes', root: 9, scaleId: 'minor-pent', highlight: 'tsd' }), names);
    const all = s.diagrams.flatMap((d) => d.board.markers);
    for (const m of all) {
      const semis = mod12(pcOf(m.string, m.fret) - 9);
      expect(m.role).toBe(semis === 0 ? 'root' : semis === 5 ? 'sub' : semis === 7 ? 'dom' : 'tone');
    }
    expect(s.legend.map((l) => l.role)).toEqual(['root', 'sub', 'dom', 'tone']);
    expect(buildSheet(cfg({ kind: 'shapes', highlight: 'none' }), names).legend).toEqual([]);
    expect(buildSheet(cfg({ kind: 'shapes', highlight: 'root' }), names).legend.map((l) => l.role)).toEqual(['root', 'tone']);
  });

  it('rótulos: nome da nota, grau ou nada; latim e bemóis', () => {
    const note = buildSheet(cfg({ kind: 'shapes', label: 'note' }), names).diagrams[0].board.markers.map((m) => m.label);
    expect(note.every((l) => /^[A-G]/.test(l ?? ''))).toBe(true);
    const deg = buildSheet(cfg({ kind: 'shapes', label: 'degree' }), names).diagrams[0].board.markers.map((m) => m.label);
    expect(new Set(deg)).toEqual(new Set(['1', 'b3', '4', '5', 'b7'].filter((t) => deg.includes(t))));
    expect(deg.every((l) => ['1', 'b3', '4', '5', 'b7'].includes(l ?? ''))).toBe(true);
    expect(buildSheet(cfg({ kind: 'shapes', label: 'none' }), names).diagrams[0].board.markers.every((m) => m.label === undefined)).toBe(true);
    const latin = buildSheet(cfg({ kind: 'shapes', root: 3, scaleId: 'major' }), { lang: 'latin', pref: 'flat' }).diagrams[0].board.markers.map((m) => m.label);
    expect(latin).toContain('Mi♭');
    expect(latin).toContain('Sol');
  });

  it('a "região" escolhe outra oitava do mesmo shape', () => {
    const low = buildSheet(cfg({ kind: 'shapes', positions: [0], region: 0 }), names).diagrams[0].board;
    const high = buildSheet(cfg({ kind: 'shapes', positions: [0], region: 1 }), names).diagrams[0].board;
    expect(high.fretMin).toBeGreaterThan(low.fretMin);
  });

  it('janela de casas: usa o nut perto do início e sempre ≥ 5 casas', () => {
    expect(windowFor([1, 3])).toEqual({ fretMin: 0, fretMax: 4 });
    expect(windowFor([5, 8])).toEqual({ fretMin: 5, fretMax: 9 });
    expect(windowFor([20, 24])).toEqual({ fretMin: 20, fretMax: 24 });
  });
});

describe('braço inteiro', () => {
  it('"todas as notas" marca cada casa de cada corda', () => {
    const s = buildSheet(cfg({ kind: 'neck', neckContent: 'all', fretMax: 12 }), names);
    expect(s.diagrams[0].board.markers).toHaveLength(6 * 13);
    expect(s.title).toMatch(/Todas as notas/);
  });

  it('"só da escala" marca só notas da escala; "em branco" não marca nada', () => {
    const sc = buildSheet(cfg({ kind: 'neck', neckContent: 'scale', root: 0, scaleId: 'major', fretMax: 12 }), names).diagrams[0].board.markers;
    const major = new Set([0, 2, 4, 5, 7, 9, 11]);
    expect(sc.every((m) => major.has(pcOf(m.string, m.fret)))).toBe(true);
    expect(sc.length).toBeGreaterThan(40);
    const empty = buildSheet(cfg({ kind: 'neck', neckContent: 'empty' }), names);
    expect(empty.diagrams[0].board.markers).toEqual([]);
    expect(empty.legend).toEqual([]);
  });

  it('todas as notas: os graus são relativos à tônica', () => {
    const m = buildSheet(cfg({ kind: 'neck', neckContent: 'all', label: 'degree', root: 4, fretMax: 12 }), names).diagrams[0].board.markers;
    const open6 = m.find((x) => x.string === 0 && x.fret === 0)!; // corda E solta com tônica E
    expect(open6.label).toBe('1');
    expect(open6.role).toBe('root');
  });

  it('a quantidade de casas vem da configuração', () => {
    for (const n of FRET_CHOICES) expect(buildSheet(cfg({ kind: 'neck', fretMax: n }), names).diagrams[0].board.fretMax).toBe(n);
  });
});

describe('acordes', () => {
  it('tríade no braço todo: só notas do acorde, tônica destacada', () => {
    const s = buildSheet(cfg({ kind: 'chord', root: 0, chordType: 'maj', chordView: 'neck', fretMax: 12 }), names);
    const pcs = new Set(chordPcs(0, 'maj'));
    const mk = s.diagrams[0].board.markers;
    expect(mk.every((m) => pcs.has(pcOf(m.string, m.fret)))).toBe(true);
    expect(mk.filter((m) => m.role === 'root').every((m) => pcOf(m.string, m.fret) === 0)).toBe(true);
    expect(s.title).toMatch(/^C — /);
  });

  it('digitações: no máximo o pedido, notas do acorde e cordas mudas marcadas', () => {
    const s = buildSheet(cfg({ kind: 'chord', root: 7, chordType: 'maj7', voicings: 4 }), names);
    expect(s.diagrams.length).toBeGreaterThan(0);
    expect(s.diagrams.length).toBeLessThanOrEqual(4);
    const pcs = new Set(chordPcs(7, 'maj7'));
    for (const d of s.diagrams) {
      expect(d.vertical).toBe(true);
      expect(d.board.markers.every((m) => pcs.has(pcOf(m.string, m.fret)))).toBe(true);
      expect(d.board.markers.length + d.board.muted.length).toBeLessThanOrEqual(6);
      expect(d.subtitle).toMatch(/^[x\d-]+$/);
      const played = new Set(d.board.markers.map((m) => m.string));
      expect(d.board.muted.every((m) => !played.has(m))).toBe(true);
    }
  });

  it('tétrade e símbolo corretos no título', () => {
    const s = buildSheet(cfg({ kind: 'chord', root: 2, chordType: 'm7', voicings: 2 }), names);
    expect(s.title).toMatch(/^Dm7 — Ré menor com sétima/);
  });

  it('para escalas fora do padrão a janela de uma digitação sempre tem 5 casas e o nut só perto do início', () => {
    const s = buildSheet(cfg({ kind: 'chord', root: 9, chordType: 'min', voicings: 8 }), names);
    for (const d of s.diagrams) {
      expect(d.board.fretMax - d.board.fretMin).toBeGreaterThanOrEqual(3);
      if (d.board.fretMin > 0) expect(d.board.fretMax - d.board.fretMin).toBe(4);
    }
  });
});

describe('campo harmônico', () => {
  it('tríades de Dó maior: 7 acordes com algarismo romano e função', () => {
    const s = buildSheet(cfg({ kind: 'field', root: 0, fieldId: 'major', fieldSize: 'triads' }), names);
    expect(s.diagrams).toHaveLength(7);
    expect(s.diagrams.map((d) => d.title.split(' — ')[1])).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    expect(s.diagrams[0].title.startsWith('I —')).toBe(true);
    expect(s.diagrams[3].subtitle).toMatch(/^Subdominante/);
    expect(s.diagrams[4].subtitle).toMatch(/^Dominante/);
  });

  it('tétrades de Dó maior', () => {
    const s = buildSheet(cfg({ kind: 'field', root: 0, fieldId: 'major', fieldSize: 'tetrads' }), names);
    expect(s.diagrams.map((d) => d.title.split(' — ')[1])).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5']);
  });

  it('cada acorde usa só as notas dele', () => {
    const s = buildSheet(cfg({ kind: 'field', root: 7, fieldId: 'major', fieldSize: 'triads' }), names);
    expect(s.diagrams.length).toBeGreaterThanOrEqual(6);
    for (const d of s.diagrams) {
      const pcs = new Set(d.board.markers.map((m) => pcOf(m.string, m.fret)));
      expect(pcs.size).toBeLessThanOrEqual(3);
    }
  });
});

describe('braço em branco', () => {
  it('a quantidade pedida, sem notas e sem legenda', () => {
    const s = buildSheet(cfg({ kind: 'blank', blankCount: 4, fretMax: 12 }), names);
    expect(s.diagrams).toHaveLength(4);
    expect(s.diagrams.every((d) => d.board.markers.length === 0 && d.board.fretMax === 12)).toBe(true);
    expect(s.legend).toEqual([]);
  });
});

describe('afinações e robustez', () => {
  it('toda afinação gera folha sem erro (inclui baixo de 4 e 7 cordas)', () => {
    for (const t of TUNINGS) {
      for (const kind of ['shapes', 'neck', 'chord', 'field', 'blank'] as const) {
        const s = buildSheet(cfg({ kind, tuningId: t.id, scaleId: 'major', root: 2 }), names);
        expect(Array.isArray(s.diagrams)).toBe(true);
        for (const d of s.diagrams) expect(d.board.markers.every((m) => m.string >= 0 && m.string < t.midi.length)).toBe(true);
      }
    }
  });

  it('toda escala, tipo de acorde e campo, em todas as tônicas, funciona', () => {
    for (let root = 0; root < 12; root++) {
      for (const sc of SCALES) {
        const s = buildSheet(cfg({ kind: 'shapes', scaleId: sc.id, root }), names);
        expect(s.diagrams.length + s.warnings.length).toBeGreaterThan(0);
        const allowed = new Set(sc.formula.map((t) => mod12(root + tokenSemis(t))));
        for (const d of s.diagrams) expect(d.board.markers.every((m) => allowed.has(pcOf(m.string, m.fret)))).toBe(true);
      }
    }
    for (const t of CHORD_TYPES) for (const view of ['neck', 'voicings'] as const) expect(() => buildSheet(cfg({ kind: 'chord', chordType: t.id, chordView: view, root: 6 }), names)).not.toThrow();
    for (const f of FIELDS) for (const size of ['triads', 'tetrads'] as const) {
      const s = buildSheet(cfg({ kind: 'field', fieldId: f.id, fieldSize: size, root: 1 }), { lang: 'latin', pref: 'flat' });
      expect(s.diagrams.length + s.warnings.length).toBeGreaterThanOrEqual(7);
    }
  });
});

describe('papel e layout', () => {
  it('área útil: A4 e Carta, paisagem e retrato, descontadas as margens', () => {
    expect(printableMm({ paper: 'a4', landscape: true, margin: 10 })).toEqual({ w: 277, h: 190 });
    expect(printableMm({ paper: 'a4', landscape: false, margin: 12 })).toEqual({ w: 186, h: 273 });
    expect(printableMm({ paper: 'letter', landscape: false, margin: 10 }).w).toBeCloseTo(PAPER_MM.letter.w - 20);
  });

  it('direção automática: acordes e campo ficam na vertical; escala e braço, na horizontal', () => {
    expect(resolveDirection(cfg({ kind: 'shapes' }))).toBe(false);
    expect(resolveDirection(cfg({ kind: 'neck' }))).toBe(false);
    expect(resolveDirection(cfg({ kind: 'chord', chordView: 'voicings' }))).toBe(true);
    expect(resolveDirection(cfg({ kind: 'chord', chordView: 'neck' }))).toBe(false);
    expect(resolveDirection(cfg({ kind: 'field' }))).toBe(true);
    expect(resolveDirection(cfg({ kind: 'shapes', direction: 'v' }))).toBe(true);
    expect(resolveDirection(cfg({ kind: 'field', direction: 'h' }))).toBe(false);
  });

  it('colunas manuais valem (limitadas ao número de diagramas); automático busca o menor número de páginas', () => {
    expect(buildSheet(cfg({ kind: 'shapes', cols: 3 }), names).cols).toBe(3);
    expect(buildSheet(cfg({ kind: 'shapes', cols: 4, positions: [0, 1] }), names).cols).toBe(2);
    expect(buildSheet(cfg({ kind: 'neck' }), names).cols).toBe(1);
    const a = buildSheet(cfg({ kind: 'shapes', cols: 0, landscape: true }), names);
    const area = printableMm(cfg({ landscape: true }));
    const opts = { showNumbers: true, showStringNames: true };
    const pagesAt = (cols: number) => {
      const n = a.diagrams.length;
      const cardW = (area.w - 4 * (cols - 1)) / cols;
      const g = boardGeometry(a.diagrams[0].board, false, true, true);
      return pagesFor(Math.ceil(n / cols), (cardW * g.vbH) / g.vbW + 6, area.h, 30);
    };
    const best = Math.min(...[1, 2, 3, 4, 5].map(pagesAt));
    expect(pagesAt(a.cols)).toBe(best);
    expect(autoCols(a.diagrams, area, opts, 30)).toBeGreaterThanOrEqual(1);
  });

  it('pagesFor: cabeçalho ocupa a 1ª página e linhas não se partem', () => {
    expect(pagesFor(1, 50, 190, 30)).toBe(1);
    expect(pagesFor(3, 80, 190, 30)).toBe(2); // 1 linha na 1ª página; 2 na 2ª
    expect(pagesFor(0, 80, 190, 30)).toBe(1);
    expect(pagesFor(4, 80, 190, 0)).toBe(2); // 2 linhas por página
    expect(pagesFor(4, 100, 190, 0)).toBe(4); // só 1 linha cabe por página
  });

  it('geometria: braço horizontal é mais largo que alto; vertical, mais alto que largo', () => {
    const board = buildSheet(cfg({ kind: 'neck', fretMax: 15 }), names).diagrams[0].board;
    const h = boardGeometry(board, false, true, true);
    const v = boardGeometry(board, true, true, true);
    expect(h.vbW).toBeGreaterThan(h.vbH);
    expect(v.vbH).toBeGreaterThan(v.vbW);
    expect(boardGeometry(board, false, false, false).vbH).toBeLessThan(h.vbH);
  });

  it('título próprio substitui o automático', () => {
    expect(buildSheet(cfg({ kind: 'blank', title: ' Meu treino ' }), names).title).toBe('Meu treino');
  });

  it('a afinação aparece no subtítulo', () => {
    expect(buildSheet(cfg({ kind: 'blank', tuningId: 'drop-d' }), names).subtitle).toContain('Drop D');
  });
});
