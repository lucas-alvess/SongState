import type { BoardState } from '../components/ScaleBoard';

export interface Lesson {
  id: string;
  title: string;
  desc: string;
  bpm: number;
  theory?: string[];
  steps: string[];
  board: Partial<BoardState>;
  exercises?: string[]; // ids de exercícios relacionados
  chord?: { root: number; type: string }; // atalho para o dicionário
  jam?: string; // id de progressão para praticar em Backing tracks
  custom?: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  desc: string;
  lessons: Lesson[];
}

export interface Level {
  id: 'iniciante' | 'intermediario' | 'avancado';
  title: string;
  desc: string;
  chapters: Chapter[];
}

export const LEVELS: Level[] = [
  {
    id: 'iniciante',
    title: 'Iniciante',
    desc: 'Aprenda a se localizar no braço, as primeiras escalas e a base de técnica e ritmo.',
    chapters: [
      {
        id: 'c1',
        title: 'Capítulo 1 · Conhecendo o braço',
        desc: 'O mapa: cordas, casas, nomes das notas e oitavas.',
        lessons: [
          {
            id: 'cordas-casas',
            title: 'Cordas, casas e afinação',
            desc: 'Como o braço é organizado e por que a 12ª casa é especial.',
            bpm: 60,
            theory: [
              'As cordas são numeradas da mais fina para a mais grossa: 1ª (Mi agudo) até a 6ª (Mi grave). Na afinação padrão, da 6ª para a 1ª: Mi – Lá – Ré – Sol – Si – Mi.',
              'Cada casa sobe um semitom. Doze casas formam uma oitava: a 12ª casa toca a mesma nota da corda solta, só que mais aguda. Por isso o desenho das notas se repete a partir da casa 12.',
            ],
            steps: [
              'Diga os nomes das 6 cordas soltas, da grave para a aguda, sem olhar',
              'Toque a 6ª corda de solta até a casa 12 contando os semitons',
              'Localize as marcações (casas 3, 5, 7, 9 e 12) e use-as como referência',
              'Toque a corda solta e a casa 12 da mesma corda e ouça a oitava',
            ],
            board: { root: 0, scaleId: 'major', pos: null, label: 'note', ghost: 'all', fretMax: 12 },
            exercises: ['note-name'],
          },
          {
            id: 'naturais-6-5',
            title: 'Notas naturais nas cordas 6 e 5',
            desc: 'As duas cordas graves, onde moram as tônicas de riffs e power chords.',
            bpm: 60,
            theory: [
              'As notas naturais são Dó, Ré, Mi, Fá, Sol, Lá, Si. Entre Mi–Fá e Si–Dó existe apenas um semitom (uma casa); entre as demais, um tom (duas casas).',
              'Na 6ª corda: Mi (solta), Fá (1), Sol (3), Lá (5), Si (7), Dó (8), Ré (10), Mi (12). Na 5ª corda: Lá (solta), Si (2), Dó (3), Ré (5), Mi (7), Fá (8), Sol (10), Lá (12).',
            ],
            steps: [
              'Percorra a 6ª corda de solta até a casa 12 dizendo o nome de cada nota',
              'Repita na 5ª corda',
              'Escolha uma nota (ex.: Lá) e ache-a nas duas cordas o mais rápido possível',
              'Faça o exercício "Encontre a nota na corda" até 20 acertos seguidos',
            ],
            board: { root: 0, scaleId: 'major', pos: null, label: 'note', stringsOff: [2, 3, 4, 5], fretMax: 12 },
            exercises: ['note-find', 'note-name'],
          },
          {
            id: 'naturais-4-3-2-1',
            title: 'Notas naturais nas cordas 4, 3, 2 e 1',
            desc: 'As cordas agudas e a exceção da afinação: Sol → Si.',
            bpm: 60,
            theory: [
              'As cordas são afinadas em quartas (5 casas de distância), exceto Sol → Si, que é uma terça maior (4 casas). Por isso o desenho das formas "dá um passo" ao passar pela 2ª corda.',
              'A 1ª corda tem as mesmas notas da 6ª (duas oitavas acima), o que ajuda: o que você aprendeu na 6ª vale na 1ª.',
            ],
            steps: [
              'Percorra cada corda (4ª, 3ª, 2ª e 1ª) até a casa 12 dizendo as notas',
              'Compare a 1ª e a 6ª corda: as notas coincidem casa a casa',
              'Pratique ir de uma nota na 5ª corda para a mesma nota na 4ª e 3ª',
              'Faça "Todas as ocorrências" com as notas Sol, Si e Ré',
            ],
            board: { root: 0, scaleId: 'major', pos: null, label: 'note', stringsOff: [0, 1], fretMax: 12 },
            exercises: ['find-all', 'note-find'],
          },
          {
            id: 'oitavas',
            title: 'Formas de oitava',
            desc: 'Uma nota, duas alturas: o atalho para navegar pelo braço.',
            bpm: 70,
            theory: [
              'A mesma nota em cordas diferentes forma oitavas com padrões fixos: 6ª → 4ª corda: duas casas acima; 5ª → 3ª: duas casas acima; 4ª → 2ª: três casas acima; 3ª → 1ª: três casas acima.',
              'Memorizar esses saltos permite achar qualquer nota em segundos a partir de outra que você já conhece.',
            ],
            steps: [
              'Toque Dó na 5ª corda (casa 3) e ache o Dó uma oitava acima na 3ª corda (casa 5)',
              'Repita com Sol na 6ª corda (casa 3) → 4ª corda (casa 5)',
              'Toque a forma de oitava subindo cromaticamente de casa em casa',
              'Faça "Encontre o intervalo" pedindo a oitava (uníssono) de notas aleatórias',
            ],
            board: { root: 0, scaleId: 'major', pos: null, label: 'note', degrees: ['1'], fretMax: 15 },
            exercises: ['find-all'],
          },
          {
            id: 'sustenidos-bemois',
            title: 'Sustenidos e bemóis',
            desc: 'As notas pretas do piano e seus dois nomes.',
            bpm: 60,
            theory: [
              'Um sustenido (♯) sobe a nota um semitom; um bemol (♭) desce um semitom. Dó♯ e Ré♭ são a mesma casa com nomes diferentes (enarmonia). O nome certo depende da tonalidade.',
              'No braço, a nota "preta" fica na casa entre duas naturais — exceto entre Mi–Fá e Si–Dó, onde não há nota entre elas.',
            ],
            steps: [
              'Na 6ª corda, diga o nome sustenido e bemol de cada casa (1 = Fá, 2 = Fá♯/Sol♭…)',
              'Ligue as ideias: casa seguinte = ♯, casa anterior = ♭',
              'Ative "Incluir sustenidos e bemóis" nos exercícios de nota',
              'Chegue a 90% de acerto em "Que nota é essa?" com acidentes',
            ],
            board: { root: 0, scaleId: 'major', pos: null, label: 'note', ghost: 'all', fretMax: 12 },
            exercises: ['note-name', 'note-find'],
          },
        ],
      },
      {
        id: 'c2',
        title: 'Capítulo 2 · Primeiras escalas',
        desc: 'Pentatônicas e a escala maior: o vocabulário de quase todo solo.',
        lessons: [
          {
            id: 'pent-menor-caixa1',
            title: 'Pentatônica menor — caixa 1',
            desc: 'A forma mais usada da guitarra. Comece só por ela.',
            bpm: 60,
            theory: [
              'A pentatônica menor tem 5 notas: 1 – ♭3 – 4 – 5 – ♭7. Em Lá menor: Lá, Dó, Ré, Mi, Sol. A caixa 1 começa na tônica da 6ª corda (casa 5 em Lá).',
              'Duas notas por corda, em um desenho de duas "colunas" de casas. As tônicas (em rosa) são seus pontos de referência.',
            ],
            steps: [
              'Toque a caixa 1 subindo e descendo, devagar, dizendo os nomes das notas',
              'Localize as 3 tônicas (Lá) dentro da caixa',
              'Toque em colcheias com o metrônomo a 60 BPM',
              'Improvise 8 compassos sobre a Jam track "Rock menor" em Lá',
            ],
            board: { root: 9, scaleId: 'minor-pent', pos: 0, label: 'note', fretMax: 9, focus: true },
            exercises: ['shape-build'],
            jam: 'rock-minor',
          },
          {
            id: 'pent-menor-5-caixas',
            title: 'Pentatônica menor — as 5 caixas',
            desc: 'Como as caixas se conectam e cobrem o braço inteiro.',
            bpm: 60,
            theory: ['As cinco caixas são o mesmo conjunto de 5 notas em cinco "janelas" diferentes. Cada caixa termina onde a seguinte começa, formando um encaixe contínuo até a casa 12, onde tudo se repete.'],
            steps: [
              'Caixa 2: toque e perceba quais notas ela compartilha com a caixa 1',
              'Aprenda as caixas 3, 4 e 5 (uma por dia)',
              'Percorra as 5 caixas em ordem sem olhar o braço (use o modo teste)',
              'Transponha tudo para Mi menor e Ré menor',
            ],
            board: { root: 9, scaleId: 'minor-pent', pos: null, label: 'note', fretMax: 17 },
            exercises: ['shape-build', 'scale-id'],
          },
          {
            id: 'pent-maior',
            title: 'Pentatônica maior',
            desc: 'O som doce do country, do pop e do blues-rock.',
            bpm: 70,
            theory: [
              'A pentatônica maior é 1 – 2 – 3 – 5 – 6. Ela tem as mesmas notas da pentatônica menor da sua relativa: Dó maior pentatônica = Lá menor pentatônica. Muda só a tônica (a "casa" do som).',
              'Dica: para tocar pentatônica maior, pense na menor 3 casas abaixo (Dó maior → use Lá menor).',
            ],
            steps: [
              'Toque Dó maior pentatônica e compare com a caixa 1 de Lá menor: mesmas notas',
              'Dê destaque à tônica (Dó) ao terminar frases',
              'Improvise sobre a Jam track "Pop clássico" em Dó',
              'Alterne pentatônica menor e maior em um blues em Mi',
            ],
            board: { root: 0, scaleId: 'major-pent', pos: 0, label: 'degree', fretMax: 12 },
            jam: 'pop',
            exercises: ['scale-id'],
          },
          {
            id: 'maior-pos1',
            title: 'Escala maior — primeira posição',
            desc: 'As 7 notas da escala maior em uma única posição (3 notas por corda).',
            bpm: 60,
            theory: [
              'A escala maior segue o padrão tom – tom – semitom – tom – tom – tom – semitom. Ela é a "régua" da música: todos os outros modos e escalas são comparados a ela.',
              'No sistema de 3 notas por corda, cada posição começa em um grau diferente. Comece pela posição 1, que inicia na tônica da 6ª corda.',
            ],
            steps: [
              'Toque a posição 1 de Dó maior subindo e descendo, dizendo os nomes',
              'Troque o rótulo para "Grau" e diga 1-2-3-4-5-6-7',
              'Encontre os dois semitons (3→4 e 7→1) dentro da posição',
              'Toque em semínimas a 60 BPM, sem erros, 5 vezes seguidas',
            ],
            board: { root: 0, scaleId: 'major', pos: 0, label: 'note', fretMax: 15 },
            exercises: ['scale-spell', 'shape-build'],
          },
        ],
      },
      {
        id: 'c3',
        title: 'Capítulo 3 · Técnica e ritmo',
        desc: 'Mãos sincronizadas e tempo firme.',
        lessons: [
          {
            id: 'palhetada-alternada',
            title: 'Palhetada alternada',
            desc: 'Para baixo, para cima, sem parar — a base da velocidade.',
            bpm: 60,
            theory: ['Alterne sempre ↓ ↑ ↓ ↑, mesmo ao trocar de corda. Notas nos tempos ficam com ↓ e as notas "e" (entre os tempos) com ↑. Isso mantém a mão sempre em movimento, no ritmo.'],
            steps: [
              'Toque uma corda solta em colcheias (↓↑) a 60 BPM, só ouvindo o metrônomo',
              'Toque a caixa 1 da pentatônica menor com palhetada alternada',
              'Aumente de 5 em 5 BPM só quando 5 repetições seguidas saírem limpas',
              'Pratique mudar de corda mantendo a alternância',
            ],
            board: { root: 9, scaleId: 'minor-pent', pos: 0, label: 'none', fretMax: 9, focus: true },
          },
          {
            id: 'ligados',
            title: 'Ligados: hammer-on e pull-off',
            desc: 'Tocar notas com a mão esquerda, sem palhetar todas.',
            bpm: 60,
            theory: ['Hammer-on: bata o dedo na casa para soar uma nota mais aguda sem palhetar. Pull-off: puxe o dedo levemente de lado para soar a nota mais grave que já estava presa. Use força de dedos, não do braço.'],
            steps: [
              'Faça hammer-on 5 → 7 na 1ª corda, palhetando só a primeira nota',
              'Faça pull-off 7 → 5 e depois combine: 5-7-5',
              'Aplique nos pares de notas de cada corda da caixa 1',
              'Toque a caixa 1 inteira com ligados em tercinas',
            ],
            board: { root: 9, scaleId: 'minor-pent', pos: 0, label: 'note', fretMax: 9, focus: true },
          },
          {
            id: 'subdivisoes',
            title: 'Subdivisões e tempo',
            desc: 'Semínima, colcheia, tercina e semicolcheia.',
            bpm: 70,
            theory: ['Um compasso 4/4 tem 4 tempos. Subdividindo cada tempo: 1 nota (semínima), 2 (colcheias), 3 (tercinas) ou 4 (semicolcheias). Treinar subdivisões com o metrônomo dá controle sobre qualquer ritmo.'],
            steps: [
              'Toque uma nota por clique (semínimas) por 2 minutos',
              'Duas notas por clique (colcheias), depois três (tercinas), depois quatro',
              'Alterne a subdivisão a cada compasso sem perder o tempo',
              'Faça o mesmo percorrendo uma escala',
            ],
            board: { root: 0, scaleId: 'major', pos: 0, label: 'none', fretMax: 15 },
          },
        ],
      },
    ],
  },
  {
    id: 'intermediario',
    title: 'Intermediário',
    desc: 'Escalas completas, o idioma do blues e rock e as primeiras ligações com acordes.',
    chapters: [
      {
        id: 'c4',
        title: 'Capítulo 4 · Escala maior e menor completas',
        desc: 'As 7 posições e como pensar em graus.',
        lessons: [
          {
            id: 'maior-7-posicoes',
            title: 'Escala maior — as 7 posições',
            desc: 'O sistema de 3 notas por corda em Dó maior.',
            bpm: 60,
            theory: ['Cada posição começa em um grau diferente (1 a 7) na corda mais grave. O desenho do braço inteiro é a soma das 7, que se encaixam sem sobra. Aprender todas permite tocar qualquer escala maior em qualquer lugar.'],
            steps: [
              'Posição 1: suba e desça em semínimas a 60 BPM',
              'Posições 2 e 3 — perceba em qual grau cada uma começa',
              'Posições 4 a 7: uma por dia',
              'Troque o rótulo para "Nenhum" e toque de memória',
              'Toque a escala em terças (1-3, 2-4, 3-5…) dentro de cada posição',
              'Passe de uma posição para a seguinte sem parar',
            ],
            board: { root: 0, scaleId: 'major', pos: 0, label: 'degree', fretMax: 17 },
            exercises: ['shape-build', 'scale-spell'],
          },
          {
            id: 'menor-natural',
            title: 'Menor natural — conectando posições',
            desc: 'Lá menor natural: o mesmo desenho de Dó maior com outra tônica.',
            bpm: 70,
            theory: ['A escala menor natural é o 6º modo da maior (Eólio): 1 – 2 – ♭3 – 4 – 5 – ♭6 – ♭7. Lá menor e Dó maior usam exatamente as mesmas notas e shapes; o que muda é onde "está a casa".'],
            steps: [
              'Toque as 7 posições na ordem e perceba a igualdade com Dó maior',
              'Compare os graus: ♭3, ♭6 e ♭7 são o que diferencia o menor do maior',
              'Improvise 4 compassos sobre "Balada menor" em Lá usando a posição 1',
              'Mude de posição a cada 2 compassos',
            ],
            board: { root: 9, scaleId: 'natural-minor', pos: 0, label: 'degree', fretMax: 17 },
            jam: 'minor-emotional',
          },
          {
            id: 'formulas-graus',
            title: 'Fórmulas e graus',
            desc: 'Descrever qualquer escala por números.',
            bpm: 60,
            theory: [
              'Uma escala é descrita por graus em relação à tônica: maior = 1 2 3 4 5 6 7; menor natural = 1 2 ♭3 4 5 ♭6 ♭7; pentatônica menor = 1 ♭3 4 5 ♭7.',
              'Pensar em graus (e não em letras) permite transpor tudo: a mesma fórmula funciona em qualquer tom.',
            ],
            steps: [
              'Compare as fórmulas de maior e menor natural: quais graus são diferentes?',
              'Ative a cor "por grau" e observe o desenho de cada grau no braço',
              'Escreva a fórmula da pentatônica maior e da blues de memória',
              'Faça o exercício "Qual o intervalo?" até 85%',
            ],
            board: { root: 7, scaleId: 'major', pos: null, label: 'degree', color: 'degree', fretMax: 12 },
            exercises: ['interval-id', 'interval-find'],
          },
          {
            id: 'relativas',
            title: 'Relativas e paralelas',
            desc: 'Dó maior ↔ Lá menor e Dó maior ↔ Dó menor.',
            bpm: 60,
            theory: [
              'Tonalidades relativas compartilham as mesmas notas: a relativa menor está 3 casas abaixo da maior (Dó → Lá). Tonalidades paralelas compartilham a tônica: Dó maior e Dó menor, que mudam 3 notas (3ª, 6ª e 7ª).',
            ],
            steps: [
              'Toque Dó maior e Lá menor na mesma posição e compare o "ponto de repouso"',
              'Toque Dó maior e Dó menor natural: quais notas mudam?',
              'Para uma música em Lá menor, ache a relativa maior e use as mesmas posições',
              'Pratique com a Jam track "Balada menor" e depois "Pop clássico" na relativa',
            ],
            board: { root: 0, scaleId: 'natural-minor', pos: 0, label: 'degree', fretMax: 15 },
            exercises: ['scale-id'],
          },
        ],
      },
      {
        id: 'c5',
        title: 'Capítulo 5 · Blues e rock',
        desc: 'Notas de passagem, bends e o vocabulário da guitarra solo.',
        lessons: [
          {
            id: 'blues-menor-mi',
            title: 'Blues menor em Mi',
            desc: 'Pentatônica menor + a blue note (♭5).',
            bpm: 80,
            theory: ['A escala de blues menor é a pentatônica menor com uma nota extra: a ♭5 (blue note). Ela funciona como nota de passagem entre a 4ª e a 5ª, criando tensão: não a sustente, resolva para a 5ª.'],
            steps: [
              'Toque a pentatônica menor e identifique onde a ♭5 se encaixa',
              'Faça bends na 4ª e na ♭5 resolvendo na 5ª',
              'Use a Jam track "Blues menor" em Mi',
              'Improvise usando apenas 3 notas por 12 compassos',
            ],
            board: { root: 4, scaleId: 'blues-minor', pos: 0, label: 'degree', fretMax: 15 },
            jam: 'blues-minor',
          },
          {
            id: 'blues-maior',
            title: 'Blues maior e mistura menor/maior',
            desc: 'A 3ª maior dentro do blues: o toque de swing.',
            bpm: 90,
            theory: ['A escala blues maior (1 2 ♭3 3 5 6) mistura o ♭3 com a 3ª maior. Sobre acordes dominantes, alternar a 3ª menor (tensão) e a maior (resolução) é uma marca de B.B. King e muito do blues-rock.'],
            steps: [
              'Toque a blues maior e identifique o ♭3 e a 3ª juntos',
              'Resolva frases do ♭3 para a 3ª sobre o acorde I',
              'Use a Jam track "Blues 12 compassos (maior)" em Lá',
              'Alterne frases menores (acorde I) e maiores (acorde IV)',
            ],
            board: { root: 9, scaleId: 'blues-major', pos: 0, label: 'degree', fretMax: 15 },
            jam: 'blues-major',
          },
          {
            id: 'mixolidio-sol',
            title: 'Mixolídio em Sol',
            desc: 'O som dominante do rock: maior com sétima menor.',
            bpm: 80,
            theory: ['O modo mixolídio (1 2 3 4 5 6 ♭7) é a escala maior com a 7ª rebaixada. Ele é a escolha natural sobre acordes dominantes (G7) e em progressões I – ♭VII – IV do rock clássico.'],
            steps: [
              'Compare com Sol maior: qual nota muda? (♭7 = Fá)',
              'Percorra as 7 posições',
              'Improvise sobre "Rock mixolídio" em Sol',
              'Faça frases terminando na ♭7 e resolvendo na tônica',
            ],
            board: { root: 7, scaleId: 'mixolydian', pos: 0, label: 'degree', fretMax: 17 },
            jam: 'rock-mixo',
          },
          {
            id: 'bends-vibrato',
            title: 'Bends e vibrato',
            desc: 'Fazer a guitarra "cantar".',
            bpm: 60,
            theory: ['Um bend de tom sobe a nota 2 casas; de meio-tom, 1 casa. O objetivo é afinar a nota-alvo: toque a nota de destino primeiro e depois procure chegar nela com o bend. O vibrato é uma oscilação leve dessa afinação.'],
            steps: [
              'Toque a nota-alvo (ex.: casa 7 na 3ª corda) e depois a casa 5 com bend até igualar',
              'Faça bends de tom na 1ª e 2ª cordas usando 3 dedos juntos',
              'Pratique vibrato lento e largo, depois rápido e estreito',
              'Faça uma frase com 3 notas: duas normais e um bend final com vibrato',
            ],
            board: { root: 9, scaleId: 'minor-pent', pos: 0, label: 'note', fretMax: 9, focus: true },
          },
        ],
      },
      {
        id: 'c6',
        title: 'Capítulo 6 · Acordes e arpejos',
        desc: 'Como acordes e escalas se conectam.',
        lessons: [
          {
            id: 'triades',
            title: 'Tríades: maiores e menores',
            desc: 'O acorde com três notas: 1 – 3 – 5.',
            bpm: 60,
            theory: [
              'Tríade maior = 1 – 3 – 5 (Dó, Mi, Sol). Tríade menor = 1 – ♭3 – 5 (Dó, Mi♭, Sol). A única nota diferente é a terça.',
              'Todo acorde pode ser encontrado no dicionário de acordes: marque as notas e o site mostra o nome.',
            ],
            steps: [
              'Abra o dicionário e monte C, F e G no braço',
              'Identifique, dentro da escala de Dó maior, as notas 1-3-5 de cada tríade',
              'Toque os acordes e depois as notas separadas (arpejo)',
              'Troque a terça para ♭3 e ouça a mudança de maior para menor',
            ],
            board: { root: 0, scaleId: 'major', pos: 0, label: 'degree', chordTones: true, fretMax: 15 },
            chord: { root: 0, type: 'maj' },
          },
          {
            id: 'setimas',
            title: 'Acordes com sétima',
            desc: 'maj7, m7 e dominante: três cores que aparecem em tudo.',
            bpm: 60,
            theory: ['Adicione a sétima à tríade: maior com 7ª maior (Cmaj7: 1 3 5 7), menor com 7ª menor (Cm7: 1 ♭3 5 ♭7) e dominante (C7: 1 3 5 ♭7). O dominante tem tensão e "pede" resolução.'],
            steps: [
              'Abra o dicionário e compare Cmaj7, Cm7 e C7',
              'Em uma tonalidade (Dó maior), ache quais acordes de sétima nascem em cada grau',
              'Toque a progressão ii–V–I (Dm7 – G7 – Cmaj7) no braço',
              'Use a Jam track "ii – V – I" em Dó e ouça cada acorde',
            ],
            board: { root: 0, scaleId: 'major', pos: null, label: 'degree', chordTones: true, fretMax: 12 },
            chord: { root: 0, type: 'maj7' },
            jam: 'ii-v-i',
          },
          {
            id: 'arpejos-escala',
            title: 'Arpejos dentro da escala',
            desc: 'Tocar as notas do acorde dentro do desenho da escala.',
            bpm: 70,
            theory: ['Um arpejo é um acorde tocado nota por nota. Dentro de uma posição da escala, as notas 1-3-5-7 formam o arpejo; solos que "soam como os acordes" usam essas notas nos tempos fortes.'],
            steps: [
              'Marque apenas os graus 1, 3, 5 e 7 e toque-os subindo e descendo',
              'Ative "Destacar notas do acorde" e toque a escala enfatizando essas notas',
              'Toque o arpejo de Cmaj7 e depois de Am7 na mesma posição',
              'Improvise com a Jam track "Pop clássico" usando só notas do acorde atual',
            ],
            board: { root: 0, scaleId: 'major', pos: 0, label: 'degree', degrees: ['1', '3', '5', '7'], ghost: 'scale', fretMax: 15 },
            jam: 'pop',
          },
          {
            id: 'power-chords',
            title: 'Power chords',
            desc: 'Só tônica e quinta: o som do rock.',
            bpm: 90,
            theory: ['O power chord usa apenas a tônica e a quinta (1 – 5), sem terça, por isso não é nem maior nem menor — funciona bem com distorção. Com o dedo indicador na tônica (6ª ou 5ª corda), a quinta fica 2 casas acima, uma corda ao lado.'],
            steps: [
              'Monte A5 (5ª corda, casa 0 + 4ª corda, casa 2) e E5 na 6ª corda',
              'Mova a forma pela 6ª corda: casa 3 = G5, casa 5 = A5',
              'Toque uma progressão I – IV – V só com power chords',
              'Use a Jam track "Rock menor" em Mi e mude a forma conforme o acorde',
            ],
            board: { root: 4, scaleId: 'major-pent', pos: null, label: 'degree', degrees: ['1', '5'], ghost: 'scale', fretMax: 12 },
            chord: { root: 4, type: '5' },
            jam: 'rock-minor',
          },
        ],
      },
    ],
  },
  {
    id: 'avancado',
    title: 'Avançado',
    desc: 'Modos, escalas além do básico e improvisação sobre harmonias.',
    chapters: [
      {
        id: 'c7',
        title: 'Capítulo 7 · Modos',
        desc: 'Sete sons diferentes nas mesmas notas.',
        lessons: [
          {
            id: 'modos-mesma-escala',
            title: 'Os sete modos da escala maior',
            desc: 'Mesmas notas, tônica diferente, cor diferente.',
            bpm: 60,
            theory: [
              'Os modos são rotações da escala maior: Jônio (1º grau), Dórico (2º), Frígio (3º), Lídio (4º), Mixolídio (5º), Eólio (6º) e Lócrio (7º). Em Dó maior: Dó, Ré, Mi, Fá, Sol, Lá, Si — cada nota inicia um modo.',
              'O som do modo vem da relação com um acorde de fundo: toque sobre um acorde estático (vamp) e enfatize a nota característica.',
            ],
            steps: [
              'Toque a posição 1 de Dó maior e depois a mesma forma começando em Ré (Ré dórico)',
              'Repita para todos os graus, sempre começando e terminando na nota do modo',
              'Monte um quadro com a nota característica de cada modo (♭7 mixolídio, ♯4 lídio…)',
              'Faça "Que escala é essa?" com o conjunto "Modos"',
            ],
            board: { root: 0, scaleId: 'major', pos: 0, label: 'degree', fretMax: 17 },
            exercises: ['scale-id', 'scale-spell'],
          },
          {
            id: 'dorico',
            title: 'Dórico sobre um vamp',
            desc: 'O som menor com a 6ª maior.',
            bpm: 90,
            theory: ['Dórico = 1 2 ♭3 4 5 6 ♭7: um modo menor "mais brilhante" que o menor natural, por causa da 6ª maior. É o som de "So What" e de muito funk/soul.'],
            steps: [
              'Compare Ré dórico e Ré menor natural: qual nota muda? (6ª: Si em vez de Si♭)',
              'Encontre as notas do acorde (1 ♭3 5 ♭7) em cada posição',
              'Toque sobre a Jam track "Vamp dórico" em Ré',
              'Enfatize a 6ª maior para soar dórico',
            ],
            board: { root: 2, scaleId: 'dorian', pos: 0, label: 'degree', chordTones: true, fretMax: 17 },
            jam: 'dorian-vamp',
          },
          {
            id: 'frigio',
            title: 'Frígio',
            desc: 'Escuro e espanhol: a segunda menor.',
            bpm: 80,
            theory: ['Frígio = 1 ♭2 ♭3 4 5 ♭6 ♭7. A ♭2 logo acima da tônica cria o som "espanhol/metal". É o 3º modo: Mi frígio usa as notas de Dó maior.'],
            steps: [
              'Toque Mi frígio (mesmas notas de Dó maior) e ouça a ♭2 (Fá)',
              'Toque um riff com a tônica e a ♭2 alternadas',
              'Use a Jam track "Cadência andaluza" em Lá e solte a frase frígia',
              'Compare com Mi menor natural',
            ],
            board: { root: 4, scaleId: 'phrygian', pos: 0, label: 'degree', fretMax: 17 },
            jam: 'andalusian',
          },
          {
            id: 'lidio',
            title: 'Lídio',
            desc: 'Brilhante e flutuante: a quarta aumentada.',
            bpm: 80,
            theory: ['Lídio = 1 2 3 ♯4 5 6 7: a escala maior com a 4ª aumentada. É o 4º modo: Fá lídio usa as notas de Dó maior. Dá um som "aberto", típico de trilhas de cinema e do rock de Joe Satriani.'],
            steps: [
              'Toque Fá lídio e compare com Fá maior: qual nota muda? (Si natural em vez de Si♭)',
              'Toque frases enfatizando a ♯4',
              'Improvise sobre um acorde Fmaj7 estático',
              'Alterne com a escala maior sobre o mesmo acorde e ouça a diferença',
            ],
            board: { root: 5, scaleId: 'lydian', pos: 0, label: 'degree', fretMax: 17 },
          },
        ],
      },
      {
        id: 'c8',
        title: 'Capítulo 8 · Escalas além do básico',
        desc: 'Menor harmônica e melódica, dominante frígia e escalas simétricas.',
        lessons: [
          {
            id: 'menor-harmonica',
            title: 'Menor harmônica em Lá',
            desc: 'A 7ª maior sobre a base menor.',
            bpm: 70,
            theory: ['Menor harmônica = 1 2 ♭3 4 5 ♭6 7. A 7ª maior cria a "sensível" que resolve na tônica, e gera o intervalo de 2ª aumentada entre ♭6 e 7 — o som árabe/clássico.'],
            steps: [
              'Identifique a 2ª aumentada entre Fá e Sol♯',
              'Toque as 7 posições devagar',
              'Resolva a 7ª (Sol♯) para a tônica (Lá) em cada posição',
              'Use sobre o acorde E7 na Jam track "Cadência andaluza"',
            ],
            board: { root: 9, scaleId: 'harmonic-minor', pos: 0, label: 'degree', fretMax: 17 },
            jam: 'andalusian',
          },
          {
            id: 'menor-melodica',
            title: 'Menor melódica',
            desc: 'Menor com 6ª e 7ª maiores: a escala do jazz.',
            bpm: 70,
            theory: ['Menor melódica (jazz) = 1 2 ♭3 4 5 6 7: é uma escala maior com ♭3. Dela nascem a escala alterada e a lídio dominante. Sobre um acorde Am(maj7) ela soa naturalmente.'],
            steps: [
              'Compare com a menor natural: que notas mudam? (6ª e 7ª)',
              'Toque a escala subindo e descendo igual (no jazz não se muda a descida)',
              'Improvise sobre um acorde Am(maj7)',
              'Use a mesma forma começando uma 4ª acima para obter o lídio dominante',
            ],
            board: { root: 9, scaleId: 'melodic-minor', pos: 0, label: 'degree', fretMax: 17 },
          },
          {
            id: 'frigio-dominante',
            title: 'Frígio dominante (escala espanhola)',
            desc: 'O 5º modo da menor harmônica.',
            bpm: 80,
            theory: ['Frígio dominante = 1 ♭2 3 4 5 ♭6 ♭7: uma escala com ♭2 e 3ª maior. Ela soa sobre acordes dominantes (E7 em Lá menor) e é a base da música flamenca e do metal neoclássico.'],
            steps: [
              'Toque Mi frígio dominante: observe a 3ª maior (Sol♯)',
              'Compare com a menor harmônica de Lá: mesmas notas',
              'Faça frases lentas sobre um acorde E7',
              'Use na cadência andaluza: Am – G – F – E (toque a escala no E)',
            ],
            board: { root: 4, scaleId: 'phrygian-dominant', pos: 0, label: 'degree', fretMax: 17 },
            jam: 'andalusian',
          },
          {
            id: 'simetricas',
            title: 'Escalas simétricas: diminuta e tons inteiros',
            desc: 'Escalas que se repetem em padrões iguais.',
            bpm: 70,
            theory: [
              'A escala de tons inteiros divide a oitava em 6 passos iguais de 1 tom: apenas 2 escalas diferentes existem. A diminuta (tom–semitom) tem 8 notas e só 3 versões diferentes.',
              'Por serem simétricas, qualquer forma se repete a cada 2 casas (tons inteiros) ou 3 casas (diminuta) pelo braço.',
            ],
            steps: [
              'Toque tons inteiros em uma posição e deslize a forma 2 casas',
              'Toque a diminuta e deslize a forma 3 casas',
              'Use a diminuta sobre um acorde dim7 e tons inteiros sobre um 7(♯5)',
              'Compare o som com a escala maior: o que há de "instável"?',
            ],
            board: { root: 0, scaleId: 'diminished', pos: 0, label: 'degree', fretMax: 15 },
          },
        ],
      },
      {
        id: 'c9',
        title: 'Capítulo 9 · Improvisação e harmonia',
        desc: 'Seguindo as mudanças de acorde.',
        lessons: [
          {
            id: 'ii-v-i',
            title: 'ii – V – I',
            desc: 'A cadência mais importante do jazz.',
            bpm: 90,
            theory: ['Em Dó maior: Dm7 (ii) – G7 (V) – Cmaj7 (I). Sobre Dm7 use Ré dórico; sobre G7, Sol mixolídio; sobre Cmaj7, Dó maior (jônio). Como todas usam as notas de Dó maior, o desenho é o mesmo: o que muda é para onde você aponta a frase.'],
            steps: [
              'Toque a posição 1 de Dó maior sobre o ii–V–I, só enfatizando as terças de cada acorde',
              'Ligue as terças: Fá (Dm7) → Fá (G7: 7ª) → Mi (Cmaj7)',
              'Faça frases de 2 compassos terminando na terça do próximo acorde',
              'Use a Jam track "ii – V – I" em Dó a 90 BPM',
            ],
            board: { root: 0, scaleId: 'major', pos: 0, label: 'degree', chordTones: true, fretMax: 15 },
            jam: 'ii-v-i',
            chord: { root: 2, type: 'm7' },
          },
          {
            id: 'notas-alvo',
            title: 'Notas-alvo (guide tones)',
            desc: 'Conectar acordes pelas terças e sétimas.',
            bpm: 80,
            theory: ['As notas que mais definem um acorde são a 3ª e a 7ª. Se você escolher uma delas como alvo de cada compasso, sua frase "diz" qual é o acorde. Mudanças de acorde ficam audíveis mesmo sem tocar o acorde.'],
            steps: [
              'Marque apenas os graus 3 e 7 e toque-os em cada acorde da progressão',
              'Escreva as notas-alvo de Dm7 – G7 – Cmaj7 e toque a sequência',
              'Improvise frases que comecem em qualquer nota e terminem na nota-alvo',
              'Teste sobre "Folhas de Outono" na aba Backing',
            ],
            board: { root: 0, scaleId: 'major', pos: null, label: 'degree', degrees: ['3', '7'], ghost: 'scale', fretMax: 15 },
            jam: 'ii-v-i',
          },
          {
            id: 'alterada',
            title: 'Escala alterada sobre o V7',
            desc: 'Máxima tensão antes de resolver.',
            bpm: 80,
            theory: ['A escala alterada (7º modo da menor melódica) = 1 ♭2 ♭3 ♭4 ♭5 ♭6 ♭7. Ela contém todas as tensões do dominante (♭9, ♯9, ♯11, ♭13). Sobre G7 em direção a Cmaj7, use Láb melódica menor: a alterada de Sol.'],
            steps: [
              'Toque a escala alterada de Sol e identifique ♭9, ♯9, ♭5 e ♭13',
              'Toque a alterada sobre um acorde G7 estático e resolva em Cmaj7',
              'Compare com a mixolídia de Sol: que notas "pesam" mais?',
              'Aplique em um ii–V–i menor: Dm7♭5 – G7 – Cm',
            ],
            board: { root: 7, scaleId: 'altered', pos: 0, label: 'degree', fretMax: 17 },
            jam: 'ii-v-i-minor',
          },
        ],
      },
    ],
  },
];

export const ALL_LESSONS: { level: Level; chapter: Chapter; lesson: Lesson }[] = LEVELS.flatMap((level) => level.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => ({ level, chapter, lesson }))));

export const findLesson = (id: string, custom: Lesson[] = []) => {
  const hit = ALL_LESSONS.find((x) => x.lesson.id === id);
  if (hit) return hit;
  const c = custom.find((l) => l.id === id);
  return c ? { level: null, chapter: null, lesson: c } : undefined;
};
