import type { BoardState } from '../components/ScaleBoard';

export interface ExerciseMeta {
  id: string;
  title: string;
  desc: string;
  icon: string;
  level: 'Iniciante' | 'Intermediário' | 'Avançado';
  tags: string[];
}

export const EXERCISES: ExerciseMeta[] = [
  { id: 'note-name', title: 'Que nota é essa?', desc: 'Uma casa é destacada no braço e você diz o nome da nota.', icon: '❓', level: 'Iniciante', tags: ['notas'] },
  { id: 'note-find', title: 'Encontre a nota na corda', desc: 'Dado o nome e a corda, toque a casa certa.', icon: '📍', level: 'Iniciante', tags: ['notas', 'cordas'] },
  { id: 'find-all', title: 'Todas as ocorrências', desc: 'Encontre todas as casas de uma nota no braço inteiro.', icon: '🔎', level: 'Iniciante', tags: ['notas', 'braço'] },
  { id: 'scale-spell', title: 'Soletre a escala', desc: 'Digite, na ordem, as notas de uma escala ou modo.', icon: '🔤', level: 'Intermediário', tags: ['escalas', 'teoria'] },
  { id: 'interval-id', title: 'Qual o intervalo?', desc: 'Veja duas notas no braço e identifique o intervalo entre elas.', icon: '↔️', level: 'Intermediário', tags: ['intervalos'] },
  { id: 'interval-find', title: 'Encontre o intervalo', desc: 'A partir de uma nota, toque a 3ª, 5ª, 7ª… em qualquer corda.', icon: '🧭', level: 'Intermediário', tags: ['intervalos', 'braço'] },
  { id: 'shape-build', title: 'Monte o shape', desc: 'Reconstrua de memória a posição de uma escala, nota por nota.', icon: '🧩', level: 'Avançado', tags: ['shapes', 'escalas'] },
  { id: 'scale-id', title: 'Que escala é essa?', desc: 'Veja o desenho no braço e identifique a escala ou modo.', icon: '🎼', level: 'Avançado', tags: ['escalas', 'modos'] },
];

export interface Study {
  id: string;
  title: string;
  level: 'Iniciante' | 'Intermediário' | 'Avançado';
  desc: string;
  bpm: number;
  steps: string[];
  board: Partial<BoardState>;
  custom?: boolean;
}

export const STUDIES: Study[] = [
  {
    id: 'naturals-low-strings',
    title: 'Notas naturais nas cordas 6 e 5',
    level: 'Iniciante',
    desc: 'Base de tudo: saiba o nome de cada nota nas duas cordas graves, onde a maioria das tônicas dos power chords e riffs mora.',
    bpm: 60,
    board: { root: 0, scaleId: 'major', pos: null, stringsOff: [2, 3, 4, 5], fretMax: 12, label: 'note' },
    steps: [
      'Percorra a 6ª corda de solta até a casa 12 falando o nome de cada nota',
      'Repita na 5ª corda',
      'Pule as notas: toque só as naturais e diga o nome antes de tocar',
      'Aleatório: peça a si mesmo "onde está o Lá?" e encontre nas duas cordas',
      'Faça o exercício "Encontre a nota na corda" até 20 acertos seguidos',
    ],
  },
  {
    id: 'pent-minor-boxes',
    title: 'Pentatônica menor — as 5 caixas',
    level: 'Iniciante',
    desc: 'Aprenda as 5 caixas da pentatônica menor de Lá e como elas se conectam ao longo do braço.',
    bpm: 60,
    board: { root: 9, scaleId: 'minor-pent', pos: 0, label: 'note', fretMax: 17 },
    steps: [
      'Caixa 1: suba e desça devagar, falando o nome das notas',
      'Localize as tônicas (rosa) em cada caixa',
      'Toque em colcheias a 60 BPM, sem errar, 5 vezes seguidas',
      'Aprenda a caixa 2 e conecte com a 1 usando uma mesma corda',
      'Percorra as 5 caixas em ordem sem olhar o braço (use o modo teste)',
      'Transponha tudo para Mi menor',
    ],
  },
  {
    id: 'major-7-positions',
    title: 'Escala maior — as 7 posições',
    level: 'Intermediário',
    desc: 'O sistema de 3 notas por corda em Dó maior. Cada posição começa em um grau diferente da escala.',
    bpm: 60,
    board: { root: 0, scaleId: 'major', pos: 0, label: 'degree', fretMax: 17 },
    steps: [
      'Posição 1: toque subindo e descendo em semínimas a 60 BPM',
      'Repita as posições 2 e 3, sempre observando em que grau cada uma começa',
      'Posições 4 a 7: uma por dia',
      'Troque o rótulo para "Nenhum" e toque de memória',
      'Toque a escala em tercas (1-3, 2-4, 3-5…) dentro de cada posição',
      'Passe de uma posição para a seguinte sem parar',
    ],
  },
  {
    id: 'natural-minor-connect',
    title: 'Menor natural — conectando posições',
    level: 'Intermediário',
    desc: 'Lá menor natural em 7 posições. Observe como o desenho é o mesmo da escala maior relativa (Dó).',
    bpm: 70,
    board: { root: 9, scaleId: 'natural-minor', pos: 0, label: 'degree', fretMax: 17 },
    steps: [
      'Toque as 7 posições na ordem e perceba a igualdade com Dó maior',
      'Compare os graus: b3, b6 e b7 são o que diferencia o menor',
      'Improvise 4 compassos sobre um backing em Lá menor usando a posição 1',
      'Mude de posição a cada 2 compassos',
    ],
  },
  {
    id: 'blues-in-e',
    title: 'Blues menor em Mi',
    level: 'Intermediário',
    desc: 'Pentatônica menor + a blue note (b5). A base do vocabulário de blues e rock.',
    bpm: 80,
    board: { root: 4, scaleId: 'blues-minor', pos: 0, label: 'degree', fretMax: 15 },
    steps: [
      'Toque a pentatônica menor e identifique onde a b5 se encaixa',
      'Faça bends na 4ª e na b5 resolvendo na 5ª',
      'Use o Jam Track "Blues menor 12 compassos" em Mi',
      'Improvise usando apenas 3 notas por 12 compassos',
    ],
  },
  {
    id: 'dorian-vamp',
    title: 'Dórico sobre um vamp',
    level: 'Avançado',
    desc: 'Ré dórico: o som menor com a 6ª maior. Ideal para vamps de dois acordes (Dm7 – G7).',
    bpm: 90,
    board: { root: 2, scaleId: 'dorian', pos: 0, label: 'degree', fretMax: 17, chordTones: true },
    steps: [
      'Compare Ré dórico com Ré menor natural: qual nota muda? (6ª)',
      'Encontre as notas do acorde (1 b3 5 b7) em cada posição',
      'Toque sobre o Jam Track "Vamp dórico" no tom de Lá',
      'Enfatize a 6ª maior para soar dórico',
    ],
  },
  {
    id: 'mixolydian-g',
    title: 'Mixolídio em Sol',
    level: 'Intermediário',
    desc: 'O som dominante do rock e do blues-rock: maior com a 7ª menor.',
    bpm: 80,
    board: { root: 7, scaleId: 'mixolydian', pos: 0, label: 'degree', fretMax: 17 },
    steps: [
      'Compare com Sol maior: qual nota muda? (b7)',
      'Percorra as 7 posições',
      'Improvise sobre I – bVII – IV',
    ],
  },
  {
    id: 'harmonic-minor-a',
    title: 'Menor harmônica em Lá',
    level: 'Avançado',
    desc: 'O som clássico/neoclássico: menor com a 7ª maior, criando o intervalo de 2ª aumentada (b6 → 7).',
    bpm: 70,
    board: { root: 9, scaleId: 'harmonic-minor', pos: 0, label: 'degree', fretMax: 17 },
    steps: [
      'Identifique a 2ª aumentada entre F e G♯',
      'Toque as 7 posições devagar',
      'Resolva a 7ª (G♯) para a tônica (A) em cada posição',
    ],
  },
];

export const studyById = (id: string, custom: Study[]) => [...STUDIES, ...custom].find((s) => s.id === id);
