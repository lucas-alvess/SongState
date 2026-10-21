import { describe, expect, it } from 'vitest';
import { chordSymbol, detectChords } from '../src/lib/chords';
import { ALL_LESSONS } from '../src/lib/curriculum';
import { PLAYABLE_EXAMPLES } from '../src/lib/lesson-tabs';
import { buildScale, mod12, scaleById } from '../src/lib/music';
import { MAX_TAB_FRET, STANDARD_MIDI, midiAt, parseChordText, parseTab, playableOf, renderTab, type TabSpec } from '../src/lib/tabs';

const C_ARPEGGIO = 'e|-----------0---|\nB|---------1-----|\nG|-------0-------|\nD|-----2---------|\nA|---3-----------|\nE|---------------|';

describe('leitura de tablatura', () => {
  it('lê o arpejo de Dó maior da lição (notas e ordem corretas)', () => {
    const t = parseTab(C_ARPEGGIO)!;
    expect(t.steps).toHaveLength(5);
    expect(t.steps.map((s) => s.notes.map((n) => midiAt(n.string, n.fret)))).toEqual([[48], [52], [55], [60], [64]]); // C3 E3 G3 C4 E4
    expect(t.maxFret).toBe(3);
  });

  it('acordes (notas empilhadas na mesma coluna) soam juntos', () => {
    const t = parseTab('e|-0-|\nB|-1-|\nG|-0-|\nD|-2-|\nA|-3-|\nE|---|')!;
    expect(t.steps).toHaveLength(1);
    expect(t.steps[0].notes.map((n) => n.string)).toEqual([1, 2, 3, 4, 5]);
  });

  it('casas de dois dígitos, mesmo desalinhadas à direita, continuam no mesmo passo', () => {
    const t = parseTab('e|-12-|\nB|--5-|\nG|----|\nD|----|\nA|----|\nE|----|')!;
    expect(t.steps).toHaveLength(1);
    expect(t.steps[0].notes.map((n) => n.fret).sort((a, b) => a - b)).toEqual([5, 12]);
  });

  it('ligados e slides marcam a nota como legato', () => {
    const t = parseTab('e|-5h8p5/7-|\nB|----------|\nG|----------|\nD|----------|\nA|----------|\nE|----------|')!;
    expect(t.steps.map((s) => [s.notes[0].fret, s.notes[0].legato])).toEqual([[5, false], [8, true], [5, true], [7, true]]);
  });

  it('x (corda abafada) não vira nota', () => {
    const t = parseTab('e|-x-0-|\nB|-----|\nG|-----|\nD|-----|\nA|-----|\nE|-----|')!;
    expect(t.steps).toHaveLength(1);
  });

  it('recusa o que não é uma tablatura segura', () => {
    expect(parseTab('')).toBeNull();
    expect(parseTab('e|-0-|\nB|-0-|')).toBeNull(); // 2 linhas
    expect(parseTab('e|---|\nB|---|\nG|---|\nD|---|\nA|---|\nE|---|')).toBeNull(); // sem notas
    expect(parseTab('e|-0-|\nB|-0-|\nG|-0-|\nD|-0-|\nA|-0-|\nE|-<script>-|')).toBeNull(); // caractere estranho
    expect(parseTab(`e|-${MAX_TAB_FRET + 1}-|\nB|---|\nG|---|\nD|---|\nA|---|\nE|---|`)).toBeNull(); // casa impossível
    expect(parseTab('texto qualquer\nem seis\nlinhas que\nnão são\numa tab\nde verdade')).toBeNull();
  });
});

describe('renderTab ↔ parseTab (ida e volta)', () => {
  function rng(seed: number) {
    let a = seed;
    return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  it('qualquer sequência gerada é lida de volta idêntica', () => {
    const r = rng(11);
    for (let n = 0; n < 300; n++) {
      const steps: TabSpec[][] = Array.from({ length: 1 + Math.floor(r() * 8) }, () => {
        const strs = new Set<number>();
        const count = 1 + Math.floor(r() * 3);
        while (strs.size < count) strs.add(1 + Math.floor(r() * 6));
        return [...strs].map((str) => ({ str, fret: Math.floor(r() * (MAX_TAB_FRET + 1)) }));
      });
      const parsed = parseTab(renderTab(steps))!;
      expect(parsed, renderTab(steps)).not.toBeNull();
      expect(parsed.steps).toHaveLength(steps.length);
      steps.forEach((step, i) => {
        const want = step.map((s) => `${6 - s.str}:${s.fret}`).sort();
        const got = parsed.steps[i].notes.map((x) => `${x.string}:${x.fret}`).sort();
        expect(got, renderTab(steps)).toEqual(want);
      });
    }
  });

  it('ligados gerados com link voltam como legato', () => {
    const text = renderTab([[{ str: 3, fret: 5 }], [{ str: 3, fret: 7, link: 'h' }], [{ str: 3, fret: 12, link: 'p' }]]);
    expect(parseTab(text)!.steps.map((s) => s.notes[0].legato)).toEqual([false, true, true]);
  });
});

describe('acorde em texto', () => {
  it('lê o formato "corda/casa"', () => {
    const c = parseChordText('corda:  6  5  4  3  2  1\ncasa:   x  3  2  0  1  0')!;
    expect(c.frets).toEqual([-1, 3, 2, 0, 1, 0]);
  });

  it('recusa formatos inválidos', () => {
    expect(parseChordText('corda:  6  5  4  3  2  1\ncasa:   x  3  2  0  1')).toBeNull();
    expect(parseChordText('corda:  1  2  3  4  5  6\ncasa:   0  0  0  0  0  0')).toBeNull();
    expect(parseChordText('corda:  6  5  4  3  2  1\ncasa:   x  x  x  x  x  3')).toBeNull(); // uma nota só
    expect(parseChordText('corda:  6  5  4  3  2  1\ncasa:   x  99 2  0  1  0')).toBeNull();
    expect(parseChordText('casa: 0 0 0 0 0 0')).toBeNull();
  });

  it('playableOf escolhe o formato certo e ignora texto comum', () => {
    expect(playableOf(C_ARPEGGIO)?.kind).toBe('tab');
    expect(playableOf('corda:  6  5  4  3  2  1\ncasa:   0  2  2  0  0  0')?.kind).toBe('chord');
    expect(playableOf('Dó maior | Sol maior\nnada tocável aqui')).toBeNull();
  });
});

describe('exemplos tocáveis das lições', () => {
  it('todos são reconhecidos e pertencem a lições que existem', () => {
    const ids = new Set(ALL_LESSONS.map((x) => x.lesson.id));
    for (const e of PLAYABLE_EXAMPLES) {
      expect(ids.has(e.lesson), `lição ${e.lesson}`).toBe(true);
      expect(playableOf(e.text), e.title).not.toBeNull();
    }
  });

  it('chegam às lições (depois dos exemplos de texto) sem duplicar títulos', () => {
    for (const id of new Set(PLAYABLE_EXAMPLES.map((e) => e.lesson))) {
      const lesson = ALL_LESSONS.find((x) => x.lesson.id === id)!.lesson;
      const titles = (lesson.example ?? []).map((e) => e.title);
      expect(new Set(titles).size, id).toBe(titles.length);
      for (const e of PLAYABLE_EXAMPLES.filter((x) => x.lesson === id)) expect(titles, id).toContain(e.title);
    }
  });

  it('escalas: todas as notas da tablatura pertencem à escala anunciada', () => {
    for (const e of PLAYABLE_EXAMPLES.filter((x) => x.expect.scale)) {
      const [root, scaleId] = e.expect.scale!;
      const inScale = new Set(buildScale(scaleById(scaleId), root, 'sharp').notes.map((n) => n.pc));
      const p = playableOf(e.text)!;
      expect(p.kind).toBe('tab');
      if (p.kind !== 'tab') continue;
      for (const s of p.steps) for (const n of s.notes) expect(inScale.has(mod12(midiAt(n.string, n.fret))), `${e.title}: ${midiAt(n.string, n.fret)}`).toBe(true);
    }
  });

  it('escalas de uma oitava começam e terminam na tônica; a caixa cobre as 5 notas da pentatônica', () => {
    const find = (t: string) => PLAYABLE_EXAMPLES.find((e) => e.title.startsWith(t))!;
    const pcsOf = (text: string) => {
      const p = parseTab(text)!;
      return p.steps.flatMap((s) => s.notes.map((n) => mod12(midiAt(n.string, n.fret))));
    };
    const c = pcsOf(find('Escala de Dó maior').text);
    expect([c[0], c[c.length - 1]]).toEqual([0, 0]);
    expect(new Set(pcsOf(find('Caixa 1').text))).toEqual(new Set([9, 0, 2, 4, 7])); // A C D E G
  });

  it('acordes: as notas formam exatamente a cifra do título', () => {
    for (const e of PLAYABLE_EXAMPLES.filter((x) => x.expect.chord)) {
      const p = playableOf(e.text)!;
      const midis: number[] = [];
      if (p.kind === 'chord') p.frets.forEach((f, s) => f >= 0 && midis.push(midiAt(s, f)));
      else for (const s of p.steps) for (const n of s.notes) midis.push(midiAt(n.string, n.fret));
      const pcs = midis.map(mod12);
      const bass = mod12(Math.min(...midis));
      const names = detectChords(pcs, bass).map((m) => chordSymbol(m.rootPc, m.type, m.rootPc, 'sharp'));
      expect(names, `${e.title} → ${names.join(', ')}`).toContain(e.expect.chord);
    }
  });

  it('o midi usa a afinação padrão', () => {
    expect(STANDARD_MIDI).toEqual([40, 45, 50, 55, 59, 64]);
  });
});
