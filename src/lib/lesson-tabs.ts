/**
 * Exemplos tocáveis das lições (tablaturas e acordes). Cada um é escrito como dados e convertido em texto
 * por `renderTab`, então o alinhamento nunca fica errado. Os testes conferem que as notas pertencem à escala
 * ou ao acorde anunciados no título.
 */
import { renderTab, type TabSpec } from './tabs';

export interface PlayableExample {
  lesson: string;
  title: string;
  text: string;
  /** conferido nos testes: notas dentro da escala (tônica, id) ou cifra do acorde */
  expect: { scale?: [number, string]; chord?: string };
}

const asc = (...notes: [number, number][]): TabSpec[][] => notes.map(([str, fret]) => [{ str, fret }]);
const chord = (title: string, cifra: string, casas: string): { title: string; text: string; expect: { chord: string } } => ({
  title: `${title} (${cifra}) — x = não tocar, 0 = solta`,
  text: `corda:  6  5  4  3  2  1\ncasa:   ${casas}`,
  expect: { chord: cifra },
});

// Pentatônica menor de Lá, caixa 1 (casas 5–8)
const PENT_UP = asc([6, 5], [6, 8], [5, 5], [5, 7], [4, 5], [4, 7], [3, 5], [3, 7], [2, 5], [2, 8], [1, 5], [1, 8]);

export const PLAYABLE_EXAMPLES: PlayableExample[] = [
  { lesson: 'pent-menor-caixa1', title: 'Caixa 1 de Lá menor pentatônica, subindo (toque devagar, alternando a palhetada)', text: renderTab(PENT_UP), expect: { scale: [9, 'minor-pent'] } },
  { lesson: 'pent-menor-caixa1', title: 'A mesma caixa, descendo', text: renderTab([...PENT_UP].reverse()), expect: { scale: [9, 'minor-pent'] } },
  { lesson: 'maior-pos1', title: 'Escala de Dó maior em posição aberta (uma oitava)', text: renderTab(asc([5, 3], [4, 0], [4, 2], [4, 3], [3, 0], [3, 2], [2, 0], [2, 1])), expect: { scale: [0, 'major'] } },
  { lesson: 'ligados', title: 'Hammer-on (h) e pull-off (p) na pentatônica de Lá: na corda 3 e na corda 2', text: renderTab([[{ str: 3, fret: 5 }], [{ str: 3, fret: 7, link: 'h' }], [{ str: 3, fret: 5, link: 'p' }], [{ str: 2, fret: 5 }], [{ str: 2, fret: 8, link: 'h' }], [{ str: 2, fret: 5, link: 'p' }]]), expect: { scale: [9, 'minor-pent'] } },
  { lesson: 'palhetada-alternada', title: 'Exercício cromático 1-2-3-4 na corda 6 (palhetada para baixo e para cima, alternando)', text: renderTab(asc([6, 5], [6, 6], [6, 7], [6, 8], [6, 8], [6, 7], [6, 6], [6, 5])), expect: {} },
  { lesson: 'blues-menor-mi', title: 'Escala de blues menor de Mi na primeira posição (a "blue note" é o Si♭: corda 5, casa 1)', text: renderTab(asc([6, 0], [6, 3], [5, 0], [5, 1], [5, 2], [4, 0], [4, 2])), expect: { scale: [4, 'blues-minor'] } },
  { lesson: 'arpejos-escala', title: 'Arpejo de Lá menor (A C E) em posição aberta', text: renderTab(asc([5, 0], [4, 2], [3, 2], [2, 1], [1, 0])), expect: { chord: 'Am' } },
  { lesson: 'acordes-abertos', ...chord('Mi menor', 'Em', '0  2  2  0  0  0') },
  { lesson: 'acordes-abertos', ...chord('Lá menor', 'Am', 'x  0  2  2  1  0') },
  { lesson: 'acordes-abertos', ...chord('Dó maior', 'C', 'x  3  2  0  1  0') },
  { lesson: 'acordes-abertos', ...chord('Sol maior', 'G', '3  2  0  0  0  3') },
  { lesson: 'acordes-abertos', ...chord('Ré maior', 'D', 'x  x  0  2  3  2') },
  { lesson: 'power-chords', ...chord('Power chord de Lá', 'A5', 'x  0  2  2  x  x') },
  { lesson: 'power-chords', ...chord('Power chord de Mi', 'E5', '0  2  2  x  x  x') },
  { lesson: 'power-chords', ...chord('Power chord de Sol', 'G5', '3  5  5  x  x  x') },
];

export const PLAYABLE_BY_LESSON: Record<string, { title: string; text: string }[]> = {};
for (const e of PLAYABLE_EXAMPLES) (PLAYABLE_BY_LESSON[e.lesson] ??= []).push({ title: e.title, text: e.text });
