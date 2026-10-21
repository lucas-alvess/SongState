import { chordTypeById, type ChordType } from './chords';
import { buildScale, mod12, noteLabel, scaleById, type AccPref, type Lang, type Scale, type ScaleNote } from './music';

export type Func = 'T' | 'SD' | 'D';

export const FUNC_NAMES: Record<Func, { short: string; name: string; desc: string }> = {
  T: { short: 'T', name: 'Tônica', desc: 'Repouso, estabilidade: é onde a música "chega".' },
  SD: { short: 'SD', name: 'Subdominante', desc: 'Afastamento da tônica, preparação: cria movimento.' },
  D: { short: 'D', name: 'Dominante', desc: 'Tensão que pede resolução na tônica.' },
};

export interface HarmProgression {
  name: string;
  degrees: number[]; // 1 a 7
  note?: string;
}

export interface FieldDef {
  id: string;
  name: string;
  group: string;
  scaleId: string;
  desc: string;
  character: string;
  functions?: Func[]; // um por grau; ausente nos campos modais
  parentOffset: number; // semitons da tônica acima da maior "pai" (para a armadura de clave)
  altered?: string; // o que difere da armadura do campo pai
  progressions: HarmProgression[];
  tips: string[];
}

export const FIELD_GROUPS = ['Maior e menores', 'Modais'];

export const FIELDS: FieldDef[] = [
  {
    id: 'major',
    name: 'Maior (Jônio)',
    group: 'Maior e menores',
    scaleId: 'major',
    desc: 'Os 7 acordes que nascem ao empilhar terças sobre cada nota da escala maior. É a base da música tonal: pop, rock, MPB, sertanejo, clássica.',
    character: 'Estável e brilhante.',
    functions: ['T', 'SD', 'T', 'SD', 'D', 'T', 'D'],
    parentOffset: 0,
    progressions: [
      { name: 'Cadência básica', degrees: [1, 4, 5, 1], note: 'I – IV – V – I: o esqueleto de milhares de músicas.' },
      { name: 'Pop', degrees: [1, 5, 6, 4], note: 'I – V – vi – IV, a progressão mais usada do pop.' },
      { name: 'Anos 50', degrees: [1, 6, 4, 5], note: 'I – vi – IV – V.' },
      { name: 'ii – V – I', degrees: [2, 5, 1], note: 'A cadência mais importante do jazz.' },
      { name: 'Ciclo diatônico', degrees: [1, 4, 7, 3, 6, 2, 5, 1], note: 'Cada acorde está uma quarta acima do seguinte.' },
    ],
    tips: [
      'Padrão das tríades: Maior, menor, menor, Maior, Maior, menor, diminuto (M m m M M m °).',
      'Os maiores são I, IV e V; os menores, ii, iii e vi; o diminuto fica no 7º grau.',
      'I, IV e V formam o "tripé" da tonalidade: só com esses três já se harmoniza muita coisa.',
      'O vi é a relativa menor: usa as mesmas notas do I e funciona como uma "tônica alternativa".',
    ],
  },
  {
    id: 'natural-minor',
    name: 'Menor natural (Eólio)',
    group: 'Maior e menores',
    scaleId: 'natural-minor',
    desc: 'O campo da escala menor natural. Tem exatamente os mesmos acordes da sua relativa maior, mas começando no 6º grau (Lá menor = Dó maior).',
    character: 'Melancólico e sombrio.',
    functions: ['T', 'SD', 'T', 'SD', 'D', 'SD', 'D'],
    parentOffset: 9,
    progressions: [
      { name: 'Rock menor', degrees: [1, 7, 6, 7], note: 'i – ♭VII – ♭VI – ♭VII.' },
      { name: 'Menor básica', degrees: [1, 4, 5, 1], note: 'i – iv – v – i.' },
      { name: 'Balada menor', degrees: [1, 6, 3, 7], note: 'i – ♭VI – ♭III – ♭VII.' },
      { name: 'Menor com ii°', degrees: [1, 2, 5, 1], note: 'i – ii° – v – i.' },
    ],
    tips: [
      'Padrão das tríades: menor, diminuto, Maior, menor, menor, Maior, Maior (m ° M m m M M).',
      'Os maiores são ♭III, ♭VI e ♭VII; é o "tripé maior" da relativa.',
      'O v é menor e soa "fraco" como dominante. Por isso o menor costuma pegar o V maior emprestado da menor harmônica.',
      'Para achar o campo de uma tonalidade menor, encontre a relativa maior (3 casas acima) e use os mesmos acordes.',
    ],
  },
  {
    id: 'harmonic-minor',
    name: 'Menor harmônica',
    group: 'Maior e menores',
    scaleId: 'harmonic-minor',
    desc: 'O menor natural com a 7ª elevada. Ela cria o V maior (dominante de verdade) e o vii°, que resolvem forte no i. É o campo usado nas cadências do menor.',
    character: 'Dramático, clássico, "árabe".',
    functions: ['T', 'SD', 'T', 'SD', 'D', 'SD', 'D'],
    parentOffset: 9,
    altered: 'a 7ª sobe um semitom',
    progressions: [
      { name: 'Cadência menor', degrees: [1, 4, 5, 1], note: 'i – iv – V – i: o V maior resolve com força.' },
      { name: 'ii° – V – i', degrees: [2, 5, 1], note: 'O ii–V–i do modo menor.' },
      { name: 'Dramática', degrees: [1, 6, 5, 1], note: 'i – ♭VI – V – i.' },
    ],
    tips: [
      'Padrão das tríades: m, °, +, m, M, M, ° (a única com um acorde aumentado, o III+).',
      'Elevar a 7ª transforma o v menor em V maior e o ♭VII maior em vii°.',
      'Em tétrades, o V vira V7 (dominante) e o vii° vira dim7: ambos resolvem no i.',
    ],
  },
  {
    id: 'melodic-minor',
    name: 'Menor melódica (jazz)',
    group: 'Maior e menores',
    scaleId: 'melodic-minor',
    desc: 'Menor com a 6ª e a 7ª elevadas (a forma ascendente). No jazz é usada igual subindo e descendo; dela vêm a escala alterada e a lídio dominante.',
    character: 'Sofisticado, "jazzístico".',
    functions: ['T', 'SD', 'T', 'SD', 'D', 'SD', 'D'],
    parentOffset: 9,
    altered: 'a 6ª e a 7ª sobem um semitom',
    progressions: [
      { name: 'Menor com IV', degrees: [1, 4, 5, 1], note: 'i – IV – V – i: o IV maior dá cor "dórica".' },
      { name: 'i – ii – V', degrees: [1, 2, 5], note: 'ii menor e V maior diatônicos.' },
    ],
    tips: [
      'Padrão das tríades: m, m, +, M, M, °, °.',
      'Em tétrades: im(maj7), iim7, III+maj7, IV7, V7, vim7♭5, viim7♭5.',
      'O IV7 e o V7 são ambos dominantes: é o que dá o som característico.',
    ],
  },
  {
    id: 'harmonic-major',
    name: 'Maior harmônica',
    group: 'Maior e menores',
    scaleId: 'harmonic-major',
    desc: 'A escala maior com a 6ª rebaixada. Ela traz o iv menor "emprestado" do modo menor de forma diatônica.',
    character: 'Maior com um toque de tristeza.',
    functions: ['T', 'SD', 'T', 'SD', 'D', 'SD', 'D'],
    parentOffset: 0,
    altered: 'a 6ª desce um semitom',
    progressions: [
      { name: 'I – iv – V', degrees: [1, 4, 5, 1], note: 'O iv menor num contexto maior.' },
      { name: 'ii° – V – I', degrees: [2, 5, 1], note: 'ii-V-I com o ii° meio-diminuto.' },
    ],
    tips: ['Padrão das tríades: M, °, m, m, M, M, °.', 'O ii° e o iv menor são os acordes que a diferenciam do campo maior.'],
  },
  {
    id: 'dorian',
    name: 'Dórico',
    group: 'Modais',
    scaleId: 'dorian',
    desc: 'O 2º modo: menor com a 6ª maior. Não usa funções tonais clássicas: a música fica "parada" em um acorde de repouso (vamp).',
    character: 'Menor, mas luminoso e "groovado".',
    parentOffset: 2,
    progressions: [
      { name: 'Vamp dórico', degrees: [1, 4], note: 'im7 – IV7: o som clássico do dórico (funk, soul, jazz modal).' },
      { name: 'i – ♭III – IV', degrees: [1, 3, 4] },
    ],
    tips: ['Nota característica: a 6ª maior.', 'O acorde IV maior (IV7) contrasta com o i menor e "denuncia" o dórico.'],
  },
  {
    id: 'phrygian',
    name: 'Frígio',
    group: 'Modais',
    scaleId: 'phrygian',
    desc: 'O 3º modo: menor com a 2ª menor. O ♭II maior logo acima do i cria o som "espanhol" e "pesado" (flamenco, metal).',
    character: 'Escuro e tenso.',
    parentOffset: 4,
    progressions: [
      { name: 'i – ♭II', degrees: [1, 2], note: 'O movimento marca o modo.' },
      { name: 'i – ♭II – ♭III – ♭II', degrees: [1, 2, 3, 2] },
    ],
    tips: ['Nota característica: a ♭2.', 'O ♭II maior é o acorde que denuncia o frígio.'],
  },
  {
    id: 'lydian',
    name: 'Lídio',
    group: 'Modais',
    scaleId: 'lydian',
    desc: 'O 4º modo: maior com a 4ª aumentada. O II maior (II7) dá um som "flutuante", típico de trilhas de cinema.',
    character: 'Brilhante, sonhador.',
    parentOffset: 5,
    progressions: [
      { name: 'I – II', degrees: [1, 2], note: 'Maior e o II maior vizinho: assinatura do lídio.' },
      { name: 'I – II – vii', degrees: [1, 2, 7] },
    ],
    tips: ['Nota característica: a ♯4.', 'O acorde II maior (II7) é o que denuncia o lídio.'],
  },
  {
    id: 'mixolydian',
    name: 'Mixolídio',
    group: 'Modais',
    scaleId: 'mixolydian',
    desc: 'O 5º modo: maior com a 7ª menor. O ♭VII maior é o acorde típico do rock clássico.',
    character: 'Maior, mas "sujo" e relaxado.',
    parentOffset: 7,
    progressions: [
      { name: 'Rock mixolídio', degrees: [1, 7, 4, 1], note: 'I – ♭VII – IV – I.' },
      { name: 'I – ♭VII', degrees: [1, 7], note: 'O vamp mais curto do rock.' },
    ],
    tips: ['Nota característica: a ♭7.', 'O I tem 7ª menor (I7): é um dominante que não resolve — pode ficar parado.'],
  },
  {
    id: 'locrian',
    name: 'Lócrio',
    group: 'Modais',
    scaleId: 'locrian',
    desc: 'O 7º modo: o único com tríade diminuta na tônica, o que o torna instável. Raramente é base de uma música inteira.',
    character: 'Instável e dissonante.',
    parentOffset: 11,
    progressions: [{ name: 'i° – ♭II', degrees: [1, 2], note: 'Uso típico: breves passagens de tensão.' }],
    tips: ['Nota característica: a ♭5 (junto da ♭2).', 'O i° (m7♭5) não repousa: por isso o lócrio é pouco usado como "casa" da música.'],
  },
];

export const fieldById = (id: string) => FIELDS.find((f) => f.id === id) ?? FIELDS[0];

// ---------- armadura de clave ----------

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
const LATIN: Record<string, string> = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' };
/** Número de acidentes da tonalidade maior com essa tônica (positivo = sustenidos, negativo = bemóis). */
const KEYSIG: Record<number, number> = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };

export function signatureOf(parentMajorPc: number) {
  const n = KEYSIG[mod12(parentMajorPc)];
  return { count: n, kind: n > 0 ? '♯' : n < 0 ? '♭' : '', letters: n > 0 ? SHARP_ORDER.slice(0, n) : n < 0 ? FLAT_ORDER.slice(0, -n) : [] };
}

export function signatureText(parentMajorPc: number, lang: Lang) {
  const s = signatureOf(parentMajorPc);
  if (!s.count) return 'sem acidentes';
  const names = s.letters.map((l) => (lang === 'latin' ? LATIN[l] : l) + s.kind).join(', ');
  return `${Math.abs(s.count)}${s.kind} (${names})`;
}

/** Ordem das tonalidades no círculo das quintas (a partir do topo, sentido horário). */
export const CIRCLE_ORDER = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
export const circleIndex = (pc: number) => CIRCLE_ORDER.indexOf(mod12(pc));

// ---------- construção do campo ----------

export interface FieldChord {
  degree: number; // 1 a 7
  token: string; // grau na escala (1, b3, #4…)
  note: ScaleNote;
  rootPc: number;
  rootName: string; // nome da tônica do acorde, com a grafia correta da escala
  triad: ChordType;
  tetrad: ChordType;
  triadNotes: ScaleNote[];
  tetradNotes: ScaleNote[];
  roman: string;
  romanTetrad: string;
  symbol: string;
  symbolTetrad: string;
  fullName: string;
  fullNameTetrad: string;
  func?: Func;
}

export interface Field {
  def: FieldDef;
  rootPc: number;
  scale: Scale;
  chords: FieldChord[];
  quality: string; // "M m m M M m °"
  qualityTetrad: string;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const ACC: Record<string, string> = { b: '♭', '#': '♯' };

function triadId(third: number, fifth: number): string {
  if (third === 4 && fifth === 7) return 'maj';
  if (third === 3 && fifth === 7) return 'min';
  if (third === 3 && fifth === 6) return 'dim';
  if (third === 4 && fifth === 8) return 'aug';
  return 'maj';
}

function tetradId(triad: string, seventh: number): string {
  const map: Record<string, Record<number, string>> = {
    maj: { 11: 'maj7', 10: '7' },
    min: { 10: 'm7', 11: 'mMaj7' },
    dim: { 10: 'm7b5', 9: 'dim7' },
    aug: { 11: 'augmaj7', 10: '7#5' },
  };
  return map[triad]?.[seventh] ?? '7';
}

const TETRAD_ROMAN: Record<string, string> = { maj7: 'maj7', '7': '7', m7: '7', m7b5: 'ø7', dim7: '°7', mMaj7: '(maj7)', augmaj7: '+maj7', '7#5': '+7' };

export function buildField(def: FieldDef, rootPc: number, pref: AccPref): Field {
  const scale = buildScale(scaleById(def.scaleId), rootPc, pref);
  const n = scale.notes;
  const chords: FieldChord[] = n.map((note, i) => {
    const t = [n[i], n[(i + 2) % 7], n[(i + 4) % 7], n[(i + 6) % 7]];
    const third = mod12(t[1].pc - t[0].pc);
    const fifth = mod12(t[2].pc - t[0].pc);
    const seventh = mod12(t[3].pc - t[0].pc);
    const triadType = chordTypeById(triadId(third, fifth));
    const tetradType = chordTypeById(tetradId(triadType.id, seventh));
    const prefix = note.token.replace(/\d/g, '').split('').map((c) => ACC[c] ?? '').join('');
    const lower = triadType.id === 'min' || triadType.id === 'dim';
    const base = prefix + (lower ? ROMAN[i].toLowerCase() : ROMAN[i]);
    const roman = base + (triadType.id === 'dim' ? '°' : triadType.id === 'aug' ? '+' : '');
    const tetradTail = TETRAD_ROMAN[tetradType.id] ?? '7';
    const romanTetrad = tetradType.id === 'm7b5' || tetradType.id === 'dim7' ? base + tetradTail : tetradType.id === 'augmaj7' ? ROMAN[i] + tetradTail : base + tetradTail;
    const rootName = noteLabel(note.spelled, 'letters');
    const latin = noteLabel(note.spelled, 'latin');
    return {
      degree: i + 1,
      token: note.token,
      note,
      rootPc: note.pc,
      rootName,
      triad: triadType,
      tetrad: tetradType,
      triadNotes: t.slice(0, 3),
      tetradNotes: t,
      roman,
      romanTetrad,
      symbol: rootName + triadType.symbol,
      symbolTetrad: rootName + tetradType.symbol,
      fullName: `${latin} ${triadType.name}`,
      fullNameTetrad: `${latin} ${tetradType.name}`,
      func: def.functions?.[i],
    };
  });
  const q = (c: FieldChord) => ({ maj: 'M', min: 'm', dim: '°', aug: '+' })[c.triad.id] ?? '?';
  return { def, rootPc, scale, chords, quality: chords.map(q).join(' '), qualityTetrad: chords.map((c) => c.tetrad.symbol || 'M').join('  ') };
}

/** Tônica da maior "pai" do campo (para mostrar a armadura de clave). */
export const parentMajor = (def: FieldDef, rootPc: number) => mod12(rootPc - def.parentOffset);

/** Notas (pitch classes) do acorde, do grave para o agudo, prontas para tocar. */
export function chordMidis(c: FieldChord, tetrad: boolean) {
  const notes = tetrad ? c.tetradNotes : c.triadNotes;
  const bass = 40 + mod12(c.rootPc - 4);
  const upper = notes.map((x) => 55 + mod12(x.pc - 55));
  return [bass, ...upper];
}
