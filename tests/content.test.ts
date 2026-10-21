import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chordTypeById } from '../src/lib/chords';
import { ALL_LESSONS, LEVELS } from '../src/lib/curriculum';
import { EXERCISES } from '../src/lib/exercises';
import { PROGRESSIONS } from '../src/lib/jam';
import { BUILTIN_SONGS } from '../src/lib/library';
import { scaleById, SCALES } from '../src/lib/music';
import { fieldById, FIELDS } from '../src/lib/harmony';
import { GLOSSARY } from '../src/lib/reference';
import { parseChart } from '../src/lib/chords';

/** Rotas reais do App (lidas do código, para o teste acompanhar o que for adicionado). */
const routes = [...readFileSync('src/App.tsx', 'utf8').matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
const validRoute = (to: string) => {
  const path = to.replace(/^#/, '').split('?')[0];
  return routes.some((r) => new RegExp('^' + r.replace(/:\w+/g, '[^/]+') + '$').test(path));
};

describe('estudos', () => {
  const lessons = ALL_LESSONS.map((x) => x.lesson);

  it('há lições nos 3 níveis e os ids são únicos', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(['iniciante', 'intermediario', 'avancado']);
    expect(lessons.length).toBeGreaterThan(50);
    const ids = lessons.map((l) => l.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i), 'ids repetidos').toEqual([]);
  });

  it('todos os capítulos têm lições', () => {
    for (const lv of LEVELS) for (const ch of lv.chapters) expect(ch.lessons.length, `${lv.id}/${ch.id}`).toBeGreaterThan(0);
  });

  it('toda lição tem título, passos e um andamento válido', () => {
    for (const l of lessons) {
      expect(l.title.trim(), l.id).not.toBe('');
      expect(l.steps.length, l.id).toBeGreaterThan(0);
      expect(l.bpm, l.id).toBeGreaterThanOrEqual(30);
      expect(l.bpm, l.id).toBeLessThanOrEqual(240);
    }
  });

  it('as referências de cada lição existem (escala, exercício, progressão, campo, acorde, rota)', () => {
    const exIds = new Set(EXERCISES.map((e) => e.id));
    const progIds = new Set(PROGRESSIONS.map((p) => p.id));
    for (const l of lessons) {
      if (l.board.scaleId) expect(SCALES.some((s) => s.id === l.board.scaleId), `${l.id}: escala ${l.board.scaleId}`).toBe(true);
      for (const e of l.exercises ?? []) expect(exIds.has(e), `${l.id}: exercício ${e}`).toBe(true);
      if (l.jam) expect(progIds.has(l.jam), `${l.id}: progressão ${l.jam}`).toBe(true);
      if (l.field) {
        expect(FIELDS.some((f) => f.id === l.field!.fieldId), `${l.id}: campo ${l.field.fieldId}`).toBe(true);
        expect(l.field.root).toBeGreaterThanOrEqual(0);
        expect(l.field.root).toBeLessThan(12);
      }
      if (l.chord) {
        expect(chordTypeById(l.chord.type).id, `${l.id}: acorde ${l.chord.type}`).toBe(l.chord.type);
        expect(l.chord.root).toBeGreaterThanOrEqual(0);
        expect(l.chord.root).toBeLessThan(12);
      }
      for (const link of l.links ?? []) expect(validRoute(link.to), `${l.id}: rota ${link.to}`).toBe(true);
    }
  });

  it('as lições com exemplo não têm blocos vazios', () => {
    for (const l of lessons) for (const ex of l.example ?? []) expect(ex.text.trim().length, l.id).toBeGreaterThan(0);
  });
});

describe('exercícios', () => {
  it('cada exercício tem um runner no ExerciseRunner', () => {
    const src = readFileSync('src/pages/ExerciseRunner.tsx', 'utf8');
    for (const e of EXERCISES) expect(src.includes(`'${e.id}':`), `runner de ${e.id}`).toBe(true);
  });

  it('ids únicos', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });
});

describe('progressões e biblioteca', () => {
  it('toda progressão usa escalas e tipos de acorde existentes', () => {
    for (const p of PROGRESSIONS) {
      for (const s of p.scales) expect(scaleById(s).id, `${p.id}: ${s}`).toBe(s);
      for (const st of p.steps) expect(chordTypeById(st.q).id, `${p.id}: ${st.q}`).toBe(st.q);
    }
  });

  it('toda música embutida tem cifra legível, sem acordes desconhecidos', () => {
    for (const s of BUILTIN_SONGS) {
      if (!s.chart) continue;
      const c = parseChart(s.chart);
      expect(c.unknown, s.title).toEqual([]);
      expect(c.slots.length, s.title).toBeGreaterThan(0);
    }
  });
});

describe('glossário', () => {
  it('sem termos repetidos nem definições vazias', () => {
    const terms = GLOSSARY.map((g) => g.term);
    expect(terms.filter((t, i) => terms.indexOf(t) !== i)).toEqual([]);
    for (const g of GLOSSARY) expect(g.def.trim().length, g.term).toBeGreaterThan(10);
  });

  it('campos harmônicos continuam acessíveis por id', () => {
    expect(fieldById('major').id).toBe('major');
  });
});
