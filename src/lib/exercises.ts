export type ExLevel = 'Iniciante' | 'Intermediário' | 'Avançado';

export interface ExerciseMeta {
  id: string;
  title: string;
  desc: string;
  icon: 'target' | 'fretboard' | 'chord' | 'ear' | 'book' | 'wheel';
  level: ExLevel;
  category: 'Notas' | 'Escalas e shapes' | 'Intervalos' | 'Acordes' | 'Campo harmônico' | 'Ouvido';
}

export const EXERCISES: ExerciseMeta[] = [
  { id: 'note-name', title: 'Que nota é essa?', desc: 'Uma casa é destacada no braço e você diz o nome da nota.', icon: 'target', level: 'Iniciante', category: 'Notas' },
  { id: 'note-find', title: 'Encontre a nota na corda', desc: 'Dado o nome e a corda, toque a casa certa.', icon: 'fretboard', level: 'Iniciante', category: 'Notas' },
  { id: 'find-all', title: 'Todas as ocorrências', desc: 'Encontre todas as casas de uma nota no braço inteiro.', icon: 'fretboard', level: 'Iniciante', category: 'Notas' },
  { id: 'scale-spell', title: 'Soletre a escala', desc: 'Informe, na ordem, as notas de uma escala ou modo.', icon: 'book', level: 'Intermediário', category: 'Escalas e shapes' },
  { id: 'shape-build', title: 'Monte o shape', desc: 'Reconstrua de memória a posição de uma escala, nota por nota.', icon: 'fretboard', level: 'Avançado', category: 'Escalas e shapes' },
  { id: 'scale-id', title: 'Que escala é essa?', desc: 'Veja o desenho no braço e identifique a escala ou modo.', icon: 'target', level: 'Avançado', category: 'Escalas e shapes' },
  { id: 'interval-id', title: 'Qual o intervalo?', desc: 'Veja duas notas no braço e identifique o intervalo entre elas.', icon: 'target', level: 'Intermediário', category: 'Intervalos' },
  { id: 'interval-find', title: 'Encontre o intervalo', desc: 'A partir de uma nota, toque a 3ª, 5ª, 7ª… em qualquer corda.', icon: 'fretboard', level: 'Intermediário', category: 'Intervalos' },
  { id: 'chord-spell', title: 'Notas do acorde', desc: 'Dado um acorde (ex.: Dm7), informe as notas que o formam.', icon: 'chord', level: 'Intermediário', category: 'Acordes' },
  { id: 'chord-build', title: 'Monte o acorde', desc: 'Dado o nome do acorde, marque as notas no braço.', icon: 'chord', level: 'Avançado', category: 'Acordes' },
  { id: 'field-chord', title: 'Acorde do grau', desc: 'Dado o campo harmônico e o grau (ex.: IV de Sol maior), escolha o acorde.', icon: 'wheel', level: 'Intermediário', category: 'Campo harmônico' },
  { id: 'field-degree', title: 'Que grau é este acorde?', desc: 'Dado um acorde e o tom, descubra o grau no campo harmônico.', icon: 'wheel', level: 'Intermediário', category: 'Campo harmônico' },
  { id: 'field-build', title: 'Monte o campo harmônico', desc: 'Escolha, na ordem, os 7 acordes do campo de um tom sorteado.', icon: 'wheel', level: 'Avançado', category: 'Campo harmônico' },
  { id: 'ear-interval', title: 'Ouça o intervalo', desc: 'Ouça duas notas e identifique o intervalo entre elas.', icon: 'ear', level: 'Intermediário', category: 'Ouvido' },
  { id: 'ear-chord', title: 'Ouça o acorde', desc: 'Ouça um acorde e diga se é maior, menor, diminuto, aumentado ou de sétima.', icon: 'ear', level: 'Avançado', category: 'Ouvido' },
];

export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id);
