import type { Chapter, Lesson, Level } from './curriculum';

/** Títulos dos capítulos já existentes, renumerados com os capítulos novos. */
export const CHAPTER_TITLES: Record<string, string> = {
  c1: 'Capítulo 2 · Conhecendo o braço',
  c2: 'Capítulo 3 · Primeiras escalas',
  c3: 'Capítulo 4 · Técnica e ritmo',
  c4: 'Capítulo 6 · Escala maior e menor completas',
  c5: 'Capítulo 7 · Blues e rock',
  c6: 'Capítulo 8 · Acordes e arpejos',
  c7: 'Capítulo 10 · Modos',
  c8: 'Capítulo 11 · Escalas além do básico',
  c9: 'Capítulo 12 · Improvisação e harmonia',
};

// ---------------------------------------------------------------------------------------------
// Capítulos novos
// ---------------------------------------------------------------------------------------------

const PRIMEIROS_PASSOS: Chapter = {
  id: 'c0',
  title: 'Capítulo 1 · Primeiros passos',
  desc: 'Tudo o que vem antes da primeira escala: o instrumento, a afinação, ler tablaturas, os primeiros acordes e cifras.',
  lessons: [
    {
      id: 'partes-postura',
      title: 'Partes da guitarra e postura',
      desc: 'Conheça o instrumento e aprenda a segurá-lo sem se machucar.',
      bpm: 60,
      theory: [
        'As partes principais: o corpo (captadores, ponte e controles de volume e tom), o braço (trastes, marcações e escala) e a cabeça (tarraxas, que esticam as cordas). A pestana é a peça entre o braço e a cabeça que define a "casa zero".',
        'Postura: sentado, apoie o corpo da guitarra na coxa da perna dominante; em pé, ajuste a correia para manter o instrumento sempre na mesma altura. Mão esquerda: polegar atrás do braço, dedos curvados e próximos ao traste (e não em cima dele). Mão direita: palheta firme entre o polegar e o indicador, pulso solto.',
        'Os dedos da mão esquerda são numerados: 1 = indicador, 2 = médio, 3 = anelar, 4 = mindinho. No começo, cada dedo cuida de uma casa: o 1 na casa 1, o 2 na casa 2, e assim por diante.',
      ],
      tip: 'Dor no pulso ou no ombro é sinal de tensão demais. Pare, relaxe e volte mais devagar: técnica boa é técnica relaxada.',
      steps: [
        'Ajuste a altura da guitarra (sentado ou em pé) até os ombros ficarem relaxados',
        'Toque cada corda solta, da 6ª para a 1ª, com palhetadas lentas para baixo',
        'Pressione a casa 1 da 1ª corda com o dedo 1 e confira se o som sai limpo, sem chiado',
        'Repita com os dedos 2, 3 e 4 nas casas 2, 3 e 4 (exercício 1-2-3-4, corda por corda)',
        'A cada 10 minutos, pare e relaxe ombros, pulso e polegar',
      ],
      board: { root: 0, scaleId: 'major', pos: null, label: 'note', ghost: 'all', fretMax: 5 },
    },
    {
      id: 'afinacao',
      title: 'Afinando a guitarra',
      desc: 'A afinação padrão, como afinar com um aplicativo e de ouvido.',
      bpm: 60,
      theory: [
        'Na afinação padrão, da 6ª corda (mais grossa) para a 1ª (mais fina): Mi, Lá, Ré, Sol, Si, Mi (E A D G B E). O jeito mais simples é usar um afinador digital ou um aplicativo: toque a corda e gire a tarraxa até o ponteiro ficar no centro.',
        'Regra de ouro: afine sempre subindo. Se a corda estiver acima da nota, desça um pouco abaixo e suba de novo até a nota certa. Isso tensiona a corda corretamente e faz a afinação durar mais.',
        'Afinação relativa (sem afinador): a nota da 5ª casa de uma corda é igual à da corda solta seguinte, exceto entre a 3ª e a 2ª corda, em que se usa a 4ª casa. Exemplo: a 5ª casa da 6ª corda (Lá) soa igual à 5ª corda solta.',
        'Atenção: o seletor de afinação do SongState (nos Ajustes) só muda o desenho do braço e dos exercícios. Ele não afina o seu instrumento.',
      ],
      tip: 'Cordas novas desafinam bastante nos primeiros dias, porque ainda estão esticando. Afine várias vezes na primeira semana.',
      steps: [
        'Instale um afinador (ou use o do celular) e afine as 6 cordas soltas',
        'Confira de ouvido: toque a 5ª casa da 6ª corda junto com a 5ª corda solta; devem soar iguais',
        'Repita nas demais cordas (lembrando: 4ª casa entre a 3ª e a 2ª corda)',
        'Afine antes de cada sessão de estudo: leva 1 minuto',
        'Se uma corda desafina sempre, ela pode estar velha ou mal esticada: troque o jogo de cordas',
      ],
      board: { root: 4, scaleId: 'major-pent', pos: null, label: 'note', ghost: 'all', fretMax: 5 },
    },
    {
      id: 'lendo-tabs',
      title: 'Lendo tablaturas e diagramas de acordes',
      desc: 'Os dois "mapas" mais usados para aprender músicas sem ler partitura.',
      bpm: 60,
      theory: [
        'Tablatura: são 6 linhas, uma para cada corda; a de cima é a corda mais fina (1ª). Os números indicam a casa (0 = corda solta). Lê-se da esquerda para a direita, como o tempo; números empilhados soam juntos.',
        'Símbolos comuns: h = ligado ascendente (hammer-on), p = ligado descendente (pull-off), b = bend (esticar a corda), / e \\ = slide, ~ = vibrato, x = corda abafada.',
        'Diagrama de acorde: as linhas verticais são as cordas (a mais grave à esquerda) e as horizontais são as casas. Pontos mostram onde apoiar os dedos, "x" = não tocar a corda e "o" = corda solta. Um número ao lado indica a casa inicial, quando o acorde não está no começo do braço.',
      ],
      example: [
        { title: 'Arpejo de Dó maior em tablatura', text: 'e|-----------0---|\nB|---------1-----|\nG|-------0-------|\nD|-----2---------|\nA|---3-----------|\nE|---------------|' },
        { title: 'Dó maior em texto (da 6ª para a 1ª corda; x = não tocar, 0 = solta)', text: 'corda:  6  5  4  3  2  1\ncasa:   x  3  2  0  1  0' },
      ],
      steps: [
        'Toque o arpejo de Dó maior da tablatura acima, nota por nota, devagar',
        'Monte o acorde de Dó pelo diagrama em texto e confira no Dicionário de acordes',
        'Escolha uma tablatura simples de uma música que você goste e toque o primeiro compasso',
        'Procure os símbolos h, p, b e / na tablatura e experimente cada técnica',
      ],
      board: { root: 0, scaleId: 'major', pos: 0, label: 'note', fretMax: 5 },
      links: [{ to: '/acordes', label: 'Dicionário de acordes: veja os diagramas' }],
      chord: { root: 0, type: 'maj' },
    },
    {
      id: 'acordes-abertos',
      title: 'Primeiros acordes abertos',
      desc: 'Em, Am, E, A, D, G e C: com sete acordes você toca centenas de músicas.',
      bpm: 60,
      theory: [
        'Acordes abertos misturam cordas soltas com poucos dedos. Comece pelos de dois ou três dedos: Em e Am; depois E, A e D; por fim G e C, que exigem mais abertura da mão.',
        'Cada acorde deve soar limpo: toque corda por corda (arpejando) e ouça se alguma está abafada ou chiando. Corrija afastando o dedo vizinho, arqueando os dedos e apertando perto do traste.',
        'Essas formas bastam para tocar o campo harmônico de Sol maior (G, Am, C, D e Em; só o Bm pede pestana): por isso servem para tantas músicas.',
      ],
      example: [
        {
          title: 'Formas (da 6ª para a 1ª corda; x = não tocar, 0 = solta)',
          text: 'Em   0 2 2 0 0 0   dedos 2 e 3 (casa 2 das cordas 5 e 4)\nAm   x 0 2 2 1 0   dedos 2, 3 e 1\nE    0 2 2 1 0 0   dedos 2, 3 e 1\nA    x 0 2 2 2 0   dedos 1, 2 e 3\nD    x x 0 2 3 2   dedos 1, 3 e 2\nG    3 2 0 0 0 3   dedos 2, 1 e 3 (ou 4)\nC    x 3 2 0 1 0   dedos 3, 2 e 1',
        },
      ],
      steps: [
        'Aprenda Em e Am; toque cada um arpejando as cordas e corrija as que chiam',
        'Aprenda E, A e D (um por dia)',
        'Aprenda G e C',
        'Toque cada acorde com 4 batidas para baixo a 60 BPM, sem pausa entre eles',
        'Confira no Dicionário de acordes as digitações alternativas de cada um',
      ],
      board: { root: 4, scaleId: 'minor-pent', pos: null, label: 'note', fretMax: 5 },
      chord: { root: 4, type: 'min' },
      field: { root: 7, fieldId: 'major', view: 'tabela' },
    },
    {
      id: 'troca-acordes',
      title: 'Trocando de acordes sem parar o ritmo',
      desc: 'A habilidade mais importante de quem toca em banda ou acompanha cantando.',
      bpm: 60,
      theory: [
        'Três dicas para trocar bem: (1) procure dedos em comum entre os acordes (Am e C dividem o dedo da casa 1 da 2ª corda); (2) leve os dedos juntos, como um único formato, em vez de um por vez; (3) olhe para o próximo acorde antes de trocar.',
        'Treine devagar com o metrônomo: uma batida por acorde a 50 BPM, depois 60, 70… Só aumente quando 10 trocas seguidas saírem limpas. A velocidade vem da precisão, não do esforço.',
      ],
      tip: 'Se a troca falha sempre no mesmo ponto, treine só esse movimento, isolado, por 1 minuto. Depois volte à progressão.',
      steps: [
        'Am ↔ Em: 1 minuto, uma batida por acorde a 50 BPM',
        'Am ↔ C, aproveitando o dedo em comum',
        'G – C – D (I – IV – V em Sol), 4 batidas em cada acorde',
        'Em – C – G – D, 2 batidas em cada um',
        'Aumente 5 BPM a cada 10 trocas limpas e use a Jam track "Folk" para tocar junto',
      ],
      board: { root: 7, scaleId: 'major-pent', pos: null, label: 'note', fretMax: 5 },
      jam: 'folk',
      field: { root: 7, fieldId: 'major', view: 'tabela' },
    },
    {
      id: 'cifras-basico',
      title: 'Lendo cifras',
      desc: 'Como interpretar o nome dos acordes e usar uma cifra para tocar uma música.',
      bpm: 70,
      theory: [
        'Cifra é a forma de escrever os acordes de uma música: o nome do acorde aparece acima da letra, no momento em que ele muda. As letras de A a G são: A = Lá, B = Si, C = Dó, D = Ré, E = Mi, F = Fá, G = Sol.',
        'Sufixos: nada = maior; m = menor; 7 = com sétima (dominante); maj7 = sétima maior; sus4 = quarta suspensa; dim = diminuto; barra (/) indica o baixo (D/F♯ = Ré com Fá♯ no baixo). # e b indicam sustenido e bemol.',
        'No SongState você escreve uma cifra com os compassos separados por | e ouve a base tocando em qualquer tom: veja Backing → Músicas → Adicionar música.',
      ],
      example: [{ title: 'Exemplo de cifra (um compasso entre cada |)', text: '| Am | F | C | G |\n| Am | F | G | G7 |' }],
      steps: [
        'Escolha uma música simples e escreva a cifra dela em um compasso por acorde',
        'Escreva a cifra no SongState (Backing → Adicionar música) e toque junto com a base',
        'Transponha a cifra 2 semitons acima e toque de novo',
        'Procure na cifra os acordes que você já conhece (Em, Am, C, G, D)',
      ],
      board: { root: 9, scaleId: 'natural-minor', pos: null, label: 'note', fretMax: 5 },
      links: [{ to: '/backing', label: 'Backing: escreva uma cifra e ouça a base' }],
    },
  ],
};

const TEORIA: Chapter = {
  id: 'c-teoria',
  title: 'Capítulo 5 · Teoria essencial',
  desc: 'Tom e semitom, intervalos e tonalidades: a base para entender escalas, acordes e campos harmônicos.',
  lessons: [
    {
      id: 'tons-semitons',
      title: 'Tons, semitons e como a escala maior é formada',
      desc: 'O padrão que permite construir a escala maior em qualquer tom.',
      bpm: 60,
      theory: [
        'Semitom é a menor distância na guitarra: uma casa. Tom é a distância de duas casas. A escala maior segue sempre o padrão tom – tom – semitom – tom – tom – tom – semitom (T T S T T T S).',
        'Entre as notas naturais, só há semitom entre Mi–Fá e Si–Dó. Por isso, para manter o padrão fora de Dó maior, é preciso usar sustenidos ou bemóis: em Sol maior, o Fá precisa virar Fá♯ para garantir o semitom final (Fá♯ → Sol).',
      ],
      example: [{ title: 'Escala de Dó maior, passo a passo', text: 'Dó -T→ Ré -T→ Mi -S→ Fá -T→ Sol -T→ Lá -T→ Si -S→ Dó' }],
      tip: 'Conferir os semitons é o jeito mais seguro de achar erros: se um semitom cair no lugar errado, falta um sustenido ou um bemol.',
      steps: [
        'Escreva a escala de Sol maior aplicando T T S T T T S e confira com o exercício "Soletre a escala"',
        'Faça o mesmo com Ré maior (dois sustenidos) e Fá maior (um bemol)',
        'Na 6ª corda, toque casa a casa e marque onde estão os semitons de Dó maior (Mi–Fá, Si–Dó)',
        'Toque a posição 1 de Sol maior e confirme: o Fá♯ vem 1 casa antes da tônica',
      ],
      board: { root: 7, scaleId: 'major', pos: 0, label: 'note', fretMax: 15 },
      exercises: ['scale-spell'],
    },
    {
      id: 'intervalos-teoria',
      title: 'Intervalos: nomes e distâncias',
      desc: 'A "régua" para medir qualquer par de notas, e a base dos acordes.',
      bpm: 60,
      theory: [
        'Intervalo é a distância entre duas notas. Ele é contado em graus (2ª, 3ª, 4ª…) e qualificado como justo, maior, menor, aumentado ou diminuto. Na guitarra, o jeito mais prático é contar semitons (casas).',
        'Tabela rápida em semitons: 2ª menor = 1, 2ª maior = 2, 3ª menor = 3, 3ª maior = 4, 4ª justa = 5, trítono = 6, 5ª justa = 7, 6ª menor = 8, 6ª maior = 9, 7ª menor = 10, 7ª maior = 11, oitava = 12.',
        'Por que importa: a 3ª (maior ou menor) define se um acorde é maior ou menor; a 5ª justa é o intervalo do power chord; o trítono (6 semitons) é o intervalo mais tenso e aparece no acorde dominante e no diminuto.',
      ],
      tip: 'Decore as formas no braço, e não só os números: a 5ª justa de uma nota na 6ª corda fica na 5ª corda, duas casas acima; a 3ª maior fica 4 casas acima na mesma corda.',
      steps: [
        'Escolha uma nota e toque, na mesma corda, a 3ª menor e a 3ª maior: ouça a diferença',
        'Encontre a 5ª justa de uma nota em outra corda (2 casas acima, 1 corda mais aguda, a partir da 6ª ou 5ª corda)',
        'Faça "Qual o intervalo?" e "Encontre o intervalo" até 85% de acerto',
        'Faça "Ouça o intervalo" no nível Básicos',
      ],
      board: { root: 0, scaleId: 'major', pos: null, label: 'degree', color: 'degree', fretMax: 12 },
      exercises: ['interval-id', 'interval-find', 'ear-interval'],
    },
    {
      id: 'armadura-tonalidades',
      title: 'Tonalidades e armadura de clave',
      desc: 'Quantos sustenidos ou bemóis tem cada tom, e um truque para descobrir sem decorar.',
      bpm: 60,
      theory: [
        'A armadura de clave é o conjunto de sustenidos ou bemóis de uma tonalidade. Sol maior tem 1 sustenido (Fá♯); Ré maior tem 2 (Fá♯, Dó♯); e assim por diante, sempre na ordem Fá – Dó – Sol – Ré – Lá – Mi – Si. Os bemóis seguem a ordem inversa: Si – Mi – Lá – Ré – Sol – Dó – Fá.',
        'Truques: nas tonalidades com sustenidos, a tônica é um semitom acima do último sustenido (dois sustenidos, Fá♯ e Dó♯ → Ré maior). Nas com bemóis, a tônica maior é o penúltimo bemol (Si♭, Mi♭, Lá♭ → Mi♭ maior). Fá maior (1 bemol) é a exceção a decorar.',
        'No círculo das quintas, ao subir uma quinta (sentido horário) acrescenta-se um sustenido; ao descer uma quinta (anti-horário), um bemol. A relativa menor tem a mesma armadura da maior (Lá menor = Dó maior).',
      ],
      steps: [
        'Escreva a armadura de Sol, Ré, Lá e Mi maiores (1, 2, 3 e 4 sustenidos)',
        'Escreva a de Fá, Si♭, Mi♭ e Lá♭ maiores (1, 2, 3 e 4 bemóis)',
        'Diga qual é a relativa menor de cada uma (3 semitons abaixo)',
        'Abra o círculo das quintas e confira a armadura de cada tom',
      ],
      board: { root: 7, scaleId: 'major', pos: 0, label: 'note', fretMax: 15 },
      field: { root: 0, fieldId: 'major', view: 'circulo' },
    },
  ],
};

const CAMPOS: Chapter = {
  id: 'c-campos',
  title: 'Capítulo 9 · Campos harmônicos',
  desc: 'Quais acordes "combinam" com cada tom: a base para harmonizar, acompanhar e improvisar. Use a página Campos para treinar cada lição.',
  lessons: [
    {
      id: 'campo-conceito',
      title: 'O que é um campo harmônico',
      desc: 'Como as escalas geram acordes, e por que isso organiza toda a harmonia.',
      bpm: 60,
      theory: [
        'Campo harmônico é o conjunto dos acordes formados com as notas de uma escala. Para cada nota (grau) da escala, empilha-se uma terça sobre a outra: tríade = 1ª + 3ª + 5ª; tétrade (acorde com sétima) = 1ª + 3ª + 5ª + 7ª, sempre usando só as notas da escala.',
        'Em Dó maior (Dó Ré Mi Fá Sol Lá Si): sobre o Dó, empilhando Dó–Mi–Sol, sai Dó maior; sobre o Ré, Ré–Fá–Lá, sai Ré menor; e assim até o Si. Como cada grau gera um acorde, todo campo tem 7 acordes, identificados por números romanos (I a VII).',
        'Para que serve: saber quais acordes combinam entre si em um tom, harmonizar melodias, entender cifras de músicas e escolher as notas certas para improvisar.',
      ],
      tip: 'Números romanos maiúsculos = acordes maiores (I, IV, V); minúsculos = menores (ii, iii, vi); o símbolo ° = diminuto. Assim, a leitura "I–vi–IV–V" funciona em qualquer tom.',
      steps: [
        'Escreva as sete tríades de Dó maior empilhando terças (Dó–Mi–Sol, Ré–Fá–Lá, …)',
        'Confira na página Campos (aba Tabela) se você acertou cada acorde',
        'Troque o botão para tétrades e veja como cada tríade ganha a sétima',
        'Escolha outro tom (por exemplo, Sol) e refaça o raciocínio: o padrão se mantém',
      ],
      board: { root: 0, scaleId: 'major', pos: 0, label: 'degree', chordTones: true, fretMax: 15 },
      field: { root: 0, fieldId: 'major', view: 'tabela' },
      exercises: ['chord-spell', 'field-chord'],
    },
    {
      id: 'campo-maior',
      title: 'O campo harmônico maior',
      desc: 'O padrão M m m M M m ° e como decorá-lo em qualquer tonalidade.',
      bpm: 60,
      theory: [
        'No campo maior, a qualidade dos acordes é sempre a mesma: I maior, ii menor, iii menor, IV maior, V maior, vi menor e vii° diminuto. Em Dó maior: C, Dm, Em, F, G, Am e Bdim. Em tétrades: Cmaj7, Dm7, Em7, Fmaj7, G7, Am7 e Bm7♭5.',
        'Para decorar, memorize o padrão (M m m M M m °) e a tônica; o resto é só subir pela escala. Os acordes maiores são I, IV e V; o V é o único com sétima dominante (G7); o vii° é meio-diminuto (m7♭5).',
        'Dica de transposição: se você sabe o campo de Dó, sabe os outros trocando os nomes das notas. Em Sol maior: G, Am, Bm, C, D, Em e F♯dim, que é o mesmo padrão começando em Sol.',
      ],
      tip: 'O tripé I – IV – V (em Dó: C, F e G) harmoniza uma enorme quantidade de músicas. Os menores (ii, iii e vi) funcionam como "cores" que podem substituir os maiores.',
      steps: [
        'Decore o padrão M m m M M m ° e escreva o campo de Dó, Sol e Ré maiores',
        'Na aba Todos os tons, ative o modo estudo e tente dizer cada linha antes de revelar',
        'Faça os exercícios "Acorde do grau" e "Que grau é este acorde?" até 85%',
        'Toque a progressão I – V – vi – IV em Sol (G – D – Em – C) com a Jam track "Pop clássico"',
      ],
      board: { root: 7, scaleId: 'major', pos: 0, label: 'degree', chordTones: true, fretMax: 15 },
      field: { root: 7, fieldId: 'major', view: 'tons' },
      exercises: ['field-chord', 'field-degree', 'field-build'],
      jam: 'pop',
    },
    {
      id: 'funcoes-harmonicas',
      title: 'Funções harmônicas: Tônica, Subdominante e Dominante',
      desc: 'Por que alguns acordes "descansam", outros "preparam" e outros "pedem resolução".',
      bpm: 70,
      theory: [
        'Cada acorde do campo cumpre uma função: Tônica (T) é o repouso (I, e também vi e iii, que têm notas em comum com o I); Subdominante (SD) é o afastamento, que prepara o movimento (IV e ii); Dominante (D) é a tensão que pede para voltar à tônica (V e vii°).',
        'O caminho mais natural da harmonia é T → SD → D → T. É o que acontece em I – IV – V – I e em I – ii – V – I. Acordes da mesma função podem ser trocados: vi no lugar de I, ii no lugar de IV, vii° no lugar de V.',
        'O dominante é o mais tenso porque, em tétrade, o G7 contém o trítono Si–Fá, que "pede" resolução: o Si sobe para o Dó e o Fá desce para o Mi (notas do acorde de Dó). Por isso terminar uma música no V soa "incompleto".',
      ],
      steps: [
        'Em Dó maior, classifique cada acorde: C, Dm, Em, F, G, Am e Bdim em T, SD ou D',
        'Toque a cadência C – F – G – C e sinta o caminho T → SD → D → T',
        'Troque o C inicial por Am (vi) e o F por Dm (ii): o efeito muda, mas a função se mantém',
        'Toque C – F – G e pare: sinta a tensão sem resolução; depois feche com o C',
      ],
      board: { root: 0, scaleId: 'major', pos: 0, label: 'degree', chordTones: true, fretMax: 15 },
      field: { root: 0, fieldId: 'major', view: 'roda' },
      exercises: ['field-chord'],
    },
    {
      id: 'campo-menor',
      title: 'O campo harmônico menor natural',
      desc: 'O campo da relativa menor: m ° M m m M M.',
      bpm: 70,
      theory: [
        'O campo menor natural tem os mesmos acordes do campo maior da sua relativa, mas começando no 6º grau. Em Lá menor: Am, Bdim, C, Dm, Em, F e G (os mesmos de Dó maior). O padrão das tríades é m ° M m m M M.',
        'Por isso os graus são escritos ♭III, ♭VI e ♭VII (os acordes maiores) em relação à escala maior do mesmo nome: i – ♭VII – ♭VI – ♭VII (Am – G – F – G) é uma das progressões mais usadas do rock.',
        'Diferente do maior, o v é menor (Em). Ele funciona como dominante "fraca": para resolver com força no i, o menor pega emprestado o V maior da escala menor harmônica (veja a próxima lição).',
      ],
      steps: [
        'Escreva o campo de Lá menor e compare com o de Dó maior',
        'Faça o mesmo em Mi menor e Ré menor, anotando a relativa maior de cada um',
        'Toque Am – F – C – G (i – ♭VI – ♭III – ♭VII) com a Jam track "Balada menor" em Lá',
        'Toque Am – G – F – G (i – ♭VII – ♭VI – ♭VII) e compare o clima com a progressão anterior',
      ],
      board: { root: 9, scaleId: 'natural-minor', pos: 0, label: 'degree', chordTones: true, fretMax: 15 },
      field: { root: 9, fieldId: 'natural-minor', view: 'tabela' },
      exercises: ['field-chord', 'field-degree'],
      jam: 'minor-emotional',
    },
    {
      id: 'campo-menor-harm-mel',
      title: 'Campo menor harmônico e melódico',
      desc: 'Por que o modo menor "pede emprestado" notas: o V maior e a sensível.',
      bpm: 70,
      theory: [
        'No menor natural, o v é menor e o ♭VII é maior: a resolução para o i soa suave, mas pouco conclusiva. Elevando a 7ª (escala menor harmônica), o V vira maior e o vii° diminuto, que resolvem no i com a força da "sensível". Em Lá menor harmônico: Am, Bdim, C+ (aumentado), Dm, E, F e G♯dim.',
        'Elevando também a 6ª (menor melódica), aparece o IV maior (D) em vez do iv menor: Am, Bm, C+, D, E, F♯dim e G♯dim. É a base do jazz, onde essa escala é tocada igual subindo e descendo.',
        'Na prática, os músicos misturam os três campos: usam acordes do natural (Am, Dm, F, G) e pegam o V (E ou E7) da harmônica quando querem uma resolução forte.',
      ],
      steps: [
        'Abra a aba Comparar campos em Lá e veja quais acordes mudam entre as três escalas menores',
        'Toque Am – Dm – E – Am (i – iv – V – i) e compare com Am – Dm – Em – Am',
        'Toque a Jam track "Cadência andaluza" (Am – G – F – E): ela mistura o natural e o V maior',
        'Toque ii° – V – i (Bdim – E – Am) e ouça a tensão resolvendo',
      ],
      board: { root: 9, scaleId: 'harmonic-minor', pos: 0, label: 'degree', fretMax: 17 },
      field: { root: 9, fieldId: 'harmonic-minor', view: 'comparar' },
      exercises: ['field-chord'],
      jam: 'andalusian',
    },
    {
      id: 'circulo-quintas',
      title: 'O círculo das quintas',
      desc: 'Um mapa de todas as tonalidades, e de quais acordes pertencem ao mesmo campo.',
      bpm: 60,
      theory: [
        'O círculo das quintas organiza as 12 tonalidades subindo de quinta em quinta no sentido horário: Dó, Sol, Ré, Lá, Mi, Si, Fá♯/Sol♭, Ré♭, Lá♭, Mi♭, Si♭, Fá. A cada passo horário entra mais um sustenido; no anti-horário, mais um bemol.',
        'O círculo tem anéis: o externo traz os acordes maiores; o do meio, os menores (cada um posicionado sob a sua relativa maior); o interno, os diminutos. O campo harmônico maior é um "recorte" fácil de ver: IV, I e V vizinhos no anel externo; ii, vi e iii logo abaixo, no anel do meio; e vii° no anel interno.',
        'Tonalidades vizinhas no círculo compartilham quase todas as notas (diferem por um sustenido ou bemol), por isso são as mais usadas em modulações. Lá menor, por exemplo, é vizinha de Mi menor e de Ré menor.',
      ],
      steps: [
        'Abra a aba Círculo das quintas em Dó maior e identifique IV, I e V no anel externo',
        'Mude a tônica para Sol: o recorte "gira" uma casa no sentido horário',
        'Selecione Lá menor natural e veja que o recorte é o mesmo de Dó maior, mas com o centro no Lá menor',
        'Ative o modo estudo e tente prever cada acorde antes de tocar nele',
      ],
      board: { root: 0, scaleId: 'major', pos: 0, label: 'degree', fretMax: 15 },
      field: { root: 0, fieldId: 'major', view: 'circulo' },
    },
    {
      id: 'progressoes-comuns',
      title: 'Progressões comuns e como criar as suas',
      desc: 'Usando números romanos, uma progressão serve para qualquer tom.',
      bpm: 80,
      theory: [
        'Escrever progressões em números romanos permite tocá-las em qualquer tom: I – V – vi – IV em Dó é C – G – Am – F; em Sol, G – D – Em – C. Assim você troca de tom para cantar mais confortável, sem reaprender nada.',
        'Progressões que valem decorar: I – IV – V (a base); I – V – vi – IV (pop); I – vi – IV – V (anos 50); ii – V – I (jazz); I – ♭VII – IV (rock); i – ♭VII – ♭VI – V (andaluza); e o blues de 12 compassos (I – IV – I – V – IV – I).',
        'Receita para criar a sua: comece no I, vá para um acorde de subdominante (IV ou ii), passe por um dominante (V) e volte ao I (T → SD → D → T). Depois troque acordes por outros da mesma função para variar.',
      ],
      tip: 'Ao escrever uma música, comece pelos acordes I, IV e V. Depois substitua um deles pelo seu "primo" menor (vi no lugar de I, ii no lugar de IV).',
      steps: [
        'Escreva as progressões I – V – vi – IV e I – vi – IV – V em Sol, Mi e Lá',
        'Toque cada uma com a Jam track correspondente (Pop clássico, Folk)',
        'Crie uma progressão sua de 4 compassos seguindo T → SD → D → T e toque',
        'Escreva-a como cifra no Backing e ouça a base tocando em outros tons',
      ],
      board: { root: 7, scaleId: 'major', pos: 0, label: 'degree', fretMax: 15 },
      field: { root: 7, fieldId: 'major', view: 'tabela' },
      jam: 'pop',
      links: [{ to: '/backing', label: 'Backing: escreva e ouça a sua progressão' }],
    },
    {
      id: 'cadencias',
      title: 'Cadências: como a música "pontua"',
      desc: 'Perfeita, plagal, meia cadência e deceptiva.',
      bpm: 70,
      theory: [
        'Cadência é uma sequência curta de acordes que encerra uma frase musical, como a pontuação de um texto. Cadência perfeita: V → I (ponto final, a mais conclusiva). Cadência plagal: IV → I (o "amém" dos hinos). Meia cadência: termina no V (vírgula, deixa suspenso). Cadência deceptiva: V → vi (surpresa, o ouvido espera o I).',
        'Cadência andaluza: i – ♭VII – ♭VI – V (Am – G – F – E), típica do flamenco e do rock. Ela desce por graus até o V maior, que "prende" a atenção.',
        'Ouvir e nomear cadências ajuda muito a tirar músicas de ouvido: ao reconhecer o fechamento (perfeita, plagal…), você já sabe os dois últimos acordes da frase.',
      ],
      steps: [
        'Em Dó maior, toque G – C (perfeita) e F – C (plagal) e compare o efeito',
        'Toque C – F – G e pare no G: sinta a meia cadência; depois conclua com C',
        'Toque G – Am (deceptiva) e depois G – C para ver a diferença',
        'Use a Jam track "Cadência andaluza" e tente reconhecer o V final',
      ],
      board: { root: 0, scaleId: 'major', pos: 0, label: 'degree', fretMax: 15 },
      field: { root: 0, fieldId: 'major', view: 'tabela' },
      jam: 'andalusian',
    },
  ],
};

const HARMONIA_AVANCADA: Chapter = {
  id: 'c-harm',
  title: 'Capítulo 13 · Harmonia avançada',
  desc: 'Acordes fora do campo, substituições e mudanças de tom: como os compositores "colorem" a harmonia.',
  lessons: [
    {
      id: 'emprestimo-modal',
      title: 'Empréstimo modal',
      desc: 'Pegando acordes do modo menor paralelo para colorir uma música em tom maior.',
      bpm: 80,
      theory: [
        'Empréstimo modal é usar um acorde do campo paralelo (mesma tônica) em outro modo. O mais comum: em um tom maior, pegar acordes do menor natural. Em Dó maior, os "emprestados" mais usados são iv (Fm), ♭VI (A♭), ♭VII (B♭) e ♭III (E♭), além do ii° (Ddim).',
        'Efeito: um toque de tristeza ou de dramatização num contexto alegre. Ex.: C – F – Fm – C (IV – iv – I): o Fm "puxa" para uma resolução mais emotiva. Ou I – ♭VII – IV (C – B♭ – F), típico do rock.',
        'Para enxergar o que é "de dentro" e o que é "de fora" do campo, use a aba Comparar campos: coloque Maior e Menor natural na mesma tônica e veja as diferenças.',
      ],
      steps: [
        'Compare Dó maior com Dó menor natural na aba Comparar campos',
        'Toque C – F – Fm – C e ouça o efeito do iv menor',
        'Toque C – B♭ – F – C (I – ♭VII – IV – I)',
        'Escolha uma música em tom maior que você conhece e identifique um acorde emprestado',
      ],
      board: { root: 0, scaleId: 'natural-minor', pos: 0, label: 'degree', fretMax: 15 },
      field: { root: 0, fieldId: 'major', view: 'comparar' },
    },
    {
      id: 'dominantes-secundarios',
      title: 'Dominantes secundários',
      desc: 'Transformando qualquer acorde do campo em um "destino" com seu próprio V7.',
      bpm: 80,
      theory: [
        'Dominante secundário é o acorde dominante (V7) de um acorde do campo que não seja o I. Ele tem a sétima dominante que "pede" resolução no acorde seguinte, criando uma tonalização passageira. Em Dó maior: A7 resolve em Dm (V7/ii), B7 em Em (V7/iii), C7 em F (V7/IV), D7 em G (V7/V) e E7 em Am (V7/vi).',
        'Todos eles trazem uma nota fora da escala (A7 tem Dó♯; B7 tem Ré♯; C7 tem Si♭; D7 tem Fá♯; E7 tem Sol♯), que cria cromatismo e dá a sensação de "puxar" para o acorde seguinte.',
        'Exemplo clássico: C – A7 – Dm – G7 – C (I – V7/ii – ii – V7 – I). É assim que um ii – V – I ganha mais movimento e colorido.',
      ],
      tip: 'Para achar o V7 de um acorde, suba uma quinta justa (7 semitons) acima dele e faça-o dominante. V7 de F: C7. V7 de G: D7.',
      steps: [
        'Escreva os cinco dominantes secundários de Dó maior (A7, B7, C7, D7 e E7)',
        'Toque C – A7 – Dm – G7 – C, ouvindo cada resolução',
        'Faça o mesmo em Sol maior (E7 → Am, F♯7 → Bm, G7 → C, A7 → D, B7 → Em)',
        'Insira um dominante secundário em uma progressão que você já conhece',
      ],
      board: { root: 0, scaleId: 'mixolydian', pos: 0, label: 'degree', chordTones: true, fretMax: 17 },
      chord: { root: 9, type: '7' },
      field: { root: 0, fieldId: 'major', view: 'tabela' },
    },
    {
      id: 'substituicao-tritono',
      title: 'Substituição de trítono',
      desc: 'Trocar o V7 pelo ♭II7: o truque do jazz com a linha de baixo cromática.',
      bpm: 90,
      theory: [
        'Dois acordes dominantes a um trítono de distância compartilham as notas que definem o acorde (a 3ª e a 7ª), só que trocadas de lugar. G7 tem Si e Fá; D♭7 tem Fá e Dó♭ (= Si). Por isso, o D♭7 pode substituir o G7.',
        'O ii – V – I (Dm7 – G7 – Cmaj7) vira Dm7 – D♭7 – Cmaj7: o baixo desce cromaticamente (Ré – Ré♭ – Dó), uma linha mais suave. O D♭7 é chamado de dominante substituto ou ♭II7.',
        'Sobre o ♭II7, a escala natural é a lídio dominante (mixolídio com ♯4). Ex.: D♭ lídio dominante sobre o D♭7.',
      ],
      steps: [
        'Toque Dm7 – G7 – Cmaj7 e depois Dm7 – D♭7 – Cmaj7; compare as duas versões',
        'Confira: G7 e D♭7 têm as mesmas notas em comum (Si/Dó♭ e Fá)',
        'Aplique em Sol maior: Am7 – D7 – Gmaj7 vira Am7 – A♭7 – Gmaj7 (o substituto fica a um trítono do V7)',
        'Improvise sobre o ♭II7 com a escala lídio dominante',
      ],
      board: { root: 1, scaleId: 'lydian-dominant', pos: 0, label: 'degree', fretMax: 17 },
      chord: { root: 1, type: '7' },
      jam: 'ii-v-i',
    },
    {
      id: 'modulacao',
      title: 'Modulação e acordes pivô',
      desc: 'Mudar de tom no meio da música sem soar abrupto.',
      bpm: 80,
      theory: [
        'Modulação é a mudança de tonalidade. A forma mais suave é por acorde pivô: um acorde que pertence aos dois campos. Am é o vi de Dó maior e o ii de Sol maior; ao tocar C – Am – D7 – G, você sai de Dó e chega em Sol sem salto.',
        'Tons vizinhos no círculo das quintas têm muitos acordes em comum, por isso são os destinos mais fáceis. Modulação direta (sem pivô) é usada para efeito: sobe um tom ou meio-tom no último refrão ("virada de tom").',
        'Para confirmar o novo tom, use a cadência dele: V7 → I (D7 → G). A "virada de tom" clássica sobe 1 semitom ou 1 tom inteiro, tocando o V7 do novo tom no fim.',
      ],
      steps: [
        'Em Dó maior, ache acordes que também existem em Sol maior (G, Am, C, Em)',
        'Toque C – F – C – Am – D7 – G (Dó → Sol, com o pivô Am)',
        'No círculo das quintas, ache os tons vizinhos de Dó (Sol e Fá) e de Lá menor',
        'Escreva uma progressão que passe de Lá menor para Dó maior',
      ],
      board: { root: 7, scaleId: 'major', pos: 0, label: 'degree', fretMax: 15 },
      field: { root: 0, fieldId: 'major', view: 'circulo' },
    },
  ],
};

export const NEW_CHAPTERS: { level: Level['id']; before?: string; chapter: Chapter }[] = [
  { level: 'iniciante', before: 'c1', chapter: PRIMEIROS_PASSOS },
  { level: 'intermediario', before: 'c4', chapter: TEORIA },
  { level: 'intermediario', chapter: CAMPOS },
  { level: 'avancado', chapter: HARMONIA_AVANCADA },
];

// ---------------------------------------------------------------------------------------------
// Lições extras em capítulos existentes
// ---------------------------------------------------------------------------------------------

export const EXTRA_LESSONS: Record<string, Lesson[]> = {
  c3: [
    {
      id: 'levadas-basicas',
      title: 'Levadas básicas (batidas)',
      desc: 'A combinação de palhetadas para baixo e para cima que marca o ritmo.',
      bpm: 70,
      theory: [
        'A levada é a combinação de palhetadas para baixo (↓) e para cima (↑) que marca o ritmo. A mão mantém sempre o mesmo movimento, mesmo quando não toca as cordas: nas pausas, ela passa "no ar". Isso garante o tempo certo.',
        'A levada mais comum no pop e no folk usa 8 colcheias por compasso, contadas "1 e 2 e 3 e 4 e": ↓ pausa ↓ ↑ pausa ↑ ↓ ↑. Aprenda primeiro com as cordas abafadas (sem apertar nenhum acorde), depois com um acorde parado e só então com trocas.',
      ],
      example: [{ title: 'Levada pop (↓ = para baixo, ↑ = para cima, · = a mão passa sem tocar)', text: 'contagem:  1  e  2  e  3  e  4  e\npalheta:   ↓  ·  ↓  ↑  ·  ↑  ↓  ↑' }],
      steps: [
        'Marque só o tempo: 4 batidas ↓ por compasso a 70 BPM, com a mão esquerda abafando as cordas',
        'Passe para colcheias: ↓↑↓↑↓↑↓↑ sem parar',
        'Na sequência de colcheias, não toque o "e" do tempo 1 e o tempo 3, mas mantenha a mão em movimento: é a levada pop',
        'Toque a levada sobre Am – F – C – G, trocando de acordes a cada compasso',
        'Use a Jam track "Folk" ou "Pop clássico" para tocar junto',
      ],
      board: { root: 9, scaleId: 'minor-pent', pos: null, label: 'none', fretMax: 5 },
      jam: 'pop',
    },
    {
      id: 'palm-mute',
      title: 'Abafamento com a palma (palm mute)',
      desc: 'O som "seco" e percussivo do rock e do metal.',
      bpm: 80,
      theory: [
        'No palm mute, a lateral da mão direita (perto do pulso) toca levemente as cordas junto à ponte enquanto você palheta. O som fica curto, seco e percussivo. Quanto mais pressão, mais abafado; o ideal é achar um ponto onde a nota ainda soe afinada.',
        'É a base dos riffs de rock e metal, geralmente com power chords ou notas da 6ª e 5ª cordas (tônica e quinta). Uma boa prática é alternar cordas abafadas e abertas para criar dinâmica.',
      ],
      tip: 'Posição da mão: perto da ponte, e não sobre o braço. Se tocar muito perto das cordas do braço, o som fica sem altura definida.',
      steps: [
        'Apoie a lateral da mão direita na ponte e palhete a 6ª corda solta em colcheias',
        'Retire a mão aos poucos e ouça o som "abrir": procure o ponto de equilíbrio',
        'Monte um power chord (tônica e quinta) e toque com palm mute em colcheias',
        'Alterne 3 notas abafadas e 1 aberta (·· · O) para criar um riff',
      ],
      board: { root: 4, scaleId: 'major-pent', pos: null, degrees: ['1', '5'], label: 'degree', ghost: 'scale', stringsOff: [3, 4, 5], fretMax: 7 },
      chord: { root: 4, type: '5' },
    },
  ],
  c6: [
    {
      id: 'acordes-pestana',
      title: 'Acordes com pestana (barre chords)',
      desc: 'Formas móveis: um único desenho para tocar o acorde que você quiser.',
      bpm: 70,
      theory: [
        'A pestana é quando o dedo 1 pressiona várias cordas na mesma casa. Ela transforma um acorde aberto em um acorde móvel: sem cordas soltas, a forma pode ser deslocada para qualquer casa, e o nome do acorde muda conforme a raiz.',
        'Duas formas essenciais: a forma de Mi, com a raiz na 6ª corda, forma Fá maior na casa 1, Sol maior na casa 3, Lá maior na casa 5; e a forma de Lá, com a raiz na 5ª corda, forma Si♭ maior na casa 1. Trocando a 3ª maior por 3ª menor, obtêm-se os menores (Fm, B♭m).',
        'Dica técnica: o dedo 1 deve apoiar de lado, com a parte óssea (e não a polpa), perto do traste, e o cotovelo e o polegar ajudam a distribuir a pressão. Leva semanas para soar limpo: é normal.',
      ],
      example: [
        {
          title: 'Formas com pestana (da 6ª para a 1ª corda; os números são as casas)',
          text: 'F   (forma de E)   1 3 3 2 1 1\nFm  (forma de Em)  1 3 3 1 1 1\nB♭  (forma de A)   x 1 3 3 3 1\nB♭m (forma de Am)  x 1 3 3 2 1',
        },
      ],
      steps: [
        'Monte o F maior (1 3 3 2 1 1) e toque corda por corda para achar as que chiam',
        'Deslize a mesma forma para a casa 3 (G), casa 5 (A) e casa 8 (C)',
        'Monte Fm e compare o som com F: a diferença está só no dedo 2',
        'Toque a progressão F – B♭ – C – F usando só pestanas',
      ],
      board: { root: 5, scaleId: 'major', pos: null, degrees: ['1', '3', '5'], ghost: 'scale', label: 'note', fretMax: 8 },
      chord: { root: 5, type: 'maj' },
    },
    {
      id: 'caged',
      title: 'O sistema CAGED',
      desc: 'Cinco formas que cobrem o braço inteiro para qualquer acorde.',
      bpm: 70,
      theory: [
        'O CAGED parte de cinco formas de acordes abertos (C, A, G, E e D) e mostra que cada uma pode ser movida pelo braço com pestana. Para um mesmo acorde, as cinco formas se encaixam em sequência, cobrindo o braço inteiro, e se repetem a partir da casa 12.',
        'Para Dó maior, a ordem ao longo do braço é: forma de C (aberta), forma de A (casa 3), forma de G (casa 5), forma de E (casa 8) e forma de D (casa 10). Saber essas posições ajuda a achar acordes, arpejos e as notas do acorde para solar em qualquer região do braço.',
        'Cada forma de acorde é "vizinha" de uma posição de escala (as caixas da pentatônica e as posições da escala maior): o CAGED é o elo entre acordes e solos.',
      ],
      example: [
        {
          title: 'Dó maior nas cinco formas (da 6ª para a 1ª corda)',
          text: 'forma de C (aberta)   x 3 2 0 1 0\nforma de A (casa 3)   x 3 5 5 5 3\nforma de G (casa 5)   8 7 5 5 5 8\nforma de E (casa 8)   8 10 10 9 8 8\nforma de D (casa 10)  x x 10 12 13 12',
        },
      ],
      steps: [
        'Toque o C aberto e depois cada uma das outras quatro formas, sempre dizendo "Dó maior"',
        'Faça o mesmo em Sol maior: a ordem é a mesma, e muda só a posição (casa)',
        'Marque no braço (aba Braço) só as notas 1, 3 e 5 de Dó e veja que as formas passam por elas',
        'Escolha uma música e toque o mesmo acorde em duas formas diferentes',
      ],
      board: { root: 0, scaleId: 'major', pos: null, degrees: ['1', '3', '5'], ghost: 'scale', label: 'note', fretMax: 15 },
      chord: { root: 0, type: 'maj' },
    },
  ],
  c7: [
    {
      id: 'modos-campo',
      title: 'Modos e campos modais',
      desc: 'Como cada modo gera seus próprios acordes, e como ouvi-los.',
      bpm: 80,
      theory: [
        'Cada modo tem o seu campo harmônico, formado empilhando terças sobre a escala do modo. O Dórico em Ré, por exemplo, usa as notas de Dó maior mas começa no Ré: Dm, Em, F, G, Am, Bdim, C. O que o caracteriza é o acorde IV maior (G) com o i menor (Dm).',
        'Modos não seguem as funções tonais clássicas: a música "mora" em um acorde (um vamp, como Dm7 – G7) e o modo é definido pela nota característica (6ª maior no dórico, ♭2 no frígio, ♯4 no lídio, ♭7 no mixolídio).',
        'Para ouvir o modo, toque o acorde da tônica e depois o acorde característico: i – IV no dórico; i – ♭II no frígio; I – II no lídio; I – ♭VII no mixolídio.',
      ],
      steps: [
        'Abra a roda do campo em Ré dórico e identifique o acorde característico (IV)',
        'Toque Dm7 – G7 em loop e improvise com Ré dórico',
        'Compare os campos modais com a aba Comparar campos (mesma tônica)',
        'Escolha outro modo (por exemplo, mixolídio em Sol) e toque I – ♭VII – IV',
      ],
      board: { root: 2, scaleId: 'dorian', pos: 0, label: 'degree', chordTones: true, fretMax: 17 },
      field: { root: 2, fieldId: 'dorian', view: 'roda' },
      jam: 'dorian-vamp',
    },
  ],
  c9: [
    {
      id: 'tensoes',
      title: 'Extensões e tensões (9, 11 e 13)',
      desc: 'As notas além da sétima, e quais combinam com cada acorde.',
      bpm: 80,
      theory: [
        'Além da tétrade (1-3-5-7), os acordes podem ter extensões: 9ª (= 2ª uma oitava acima), 11ª (= 4ª) e 13ª (= 6ª). Elas deixam o som mais rico e também indicam quais notas da escala combinam sobre cada acorde.',
        'Guia rápido: sobre maj7, funcionam bem a 9 e a 13 (e a ♯11 no lídio); sobre m7, a 9 e a 11; sobre o dominante 7, a 9 e a 13; sobre m7♭5, a 11 (e a ♭13). Notas a evitar: a 4ª justa (11) sobre acordes maiores, porque ela "briga" com a 3ª maior (meio-tom acima).',
        'Em solos, usar uma extensão em um tempo forte dá um som mais "jazzy": por exemplo, tocar a 9ª sobre um Am7 (nota Si) ou a 13ª sobre um G7 (nota Mi).',
      ],
      steps: [
        'Abra o dicionário de acordes e compare Cmaj7, Cmaj9 e C6/9',
        'Toque a 9ª (Ré) sobre um acorde de Cmaj7 e ouça a cor',
        'Toque a 13ª (Mi) sobre G7 e resolva em C',
        'Em um Dm7, destaque a 11ª (Sol) e perceba que ela soa bem (acorde menor)',
      ],
      board: { root: 0, scaleId: 'major', pos: null, degrees: ['1', '3', '5', '7', '2', '6'], label: 'degree', fretMax: 15 },
      chord: { root: 0, type: 'maj9' },
    },
    {
      id: 'motivos-fraseado',
      title: 'Motivos, repetição e fraseado',
      desc: 'Transformar escalas em música: três notas bastam para criar um solo.',
      bpm: 80,
      theory: [
        'Um motivo é uma pequena ideia (de 2 a 5 notas) que se repete e se transforma ao longo do solo. Repetir com variações (mudar o ritmo, a altura ou o final) soa mais musical do que tocar muitas notas diferentes.',
        'Técnicas de fraseado: pergunta e resposta (uma frase "pergunta" e a seguinte "responde" mais abaixo), pausas (o silêncio também é frase), mudança de ritmo e começar/terminar em notas do acorde (tônica, 3ª e 5ª).',
        'Dica de estudo: limite-se a 3 notas e a 2 ritmos diferentes por 12 compassos. Aos poucos acrescente notas, mantendo a ideia do motivo.',
      ],
      tip: 'Cante a frase antes de tocá-la. Se você consegue cantar, ela é musical.',
      steps: [
        'Escolha 3 notas da pentatônica menor e improvise 8 compassos só com elas',
        'Crie um motivo de 4 notas e repita-o 3 vezes, mudando o final',
        'Faça pergunta e resposta: uma frase sobe, a seguinte desce',
        'Grave-se (celular) por 1 minuto e ouça: o que você repetiria?',
      ],
      board: { root: 9, scaleId: 'minor-pent', pos: 0, label: 'degree', fretMax: 9, focus: true },
      jam: 'blues-minor',
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// Atalhos e dicas adicionados a lições que já existiam
// ---------------------------------------------------------------------------------------------

export const LESSON_PATCHES: Record<string, Partial<Lesson>> = {
  triades: { field: { root: 0, fieldId: 'major', view: 'tabela' }, tip: 'Para tocar o acorde inteiro no braço, use os diagramas do Dicionário de acordes; para estudar as notas, destaque 1-3-5 no braço.' },
  setimas: { field: { root: 0, fieldId: 'major', view: 'tabela' } },
  relativas: { field: { root: 9, fieldId: 'natural-minor', view: 'circulo' } },
  'ii-v-i': { field: { root: 0, fieldId: 'major', view: 'tabela' } },
  dorico: { field: { root: 2, fieldId: 'dorian', view: 'roda' } },
  'mixolidio-sol': { field: { root: 7, fieldId: 'mixolydian', view: 'roda' } },
  'menor-harmonica': { field: { root: 9, fieldId: 'harmonic-minor', view: 'tabela' } },
  'menor-melodica': { field: { root: 9, fieldId: 'melodic-minor', view: 'tabela' } },
  'menor-natural': { field: { root: 9, fieldId: 'natural-minor', view: 'tabela' } },
  afinacao: { links: [{ to: '/afinador', label: 'Afinador: afine pelo microfone do aparelho' }] },
  'formulas-graus': { links: [{ to: '/referencia', label: 'Referência: fórmulas de todas as escalas' }] },
};
