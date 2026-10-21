import { useMemo, type ReactNode } from 'react';
import {
  CIRCLE_ORDER,
  FIELDS,
  FUNC_NAMES,
  buildField,
  circleIndex,
  fieldById,
  parentMajor,
  signatureOf,
  signatureText,
  type Field,
  type FieldChord,
  type FieldDef,
  type Func,
} from '../lib/harmony';
import { mod12, noteLabel, pcLabel, pcLabelBoth, type AccPref, type Lang } from '../lib/music';

/** Grafia correta: tonalidades com bemóis usam bemol; com sustenidos, sustenido; sem acidentes, a preferência do usuário. */
export function autoPref(def: FieldDef, root: number, fallback: AccPref): AccPref {
  const n = signatureOf(parentMajor(def, root)).count;
  return n < 0 ? 'flat' : n > 0 ? 'sharp' : fallback;
}

export interface Study {
  on: boolean;
  shown: Set<string>;
  reveal: (key: string) => void;
}

/** Nome curto, sem o que vem entre parênteses: "Menor harmônica", "Maior". */
export const shortName = (d: FieldDef) => d.name.split(' (')[0];

export const sym = (c: FieldChord, tetrad: boolean) => (tetrad ? c.symbolTetrad : c.symbol);
export const romanOf = (c: FieldChord, tetrad: boolean) => (tetrad ? c.romanTetrad : c.roman);
const notesOf = (c: FieldChord, tetrad: boolean, lang: Lang) => (tetrad ? c.tetradNotes : c.triadNotes).map((n) => noteLabel(n.spelled, lang)).join(' · ');
const funcClass = (f?: Func) => (f ? `func-${f}` : 'func-none');

/** Torna um grupo SVG um botão para teclado e leitores de tela. */
const asButton = (label: string, action: () => void) => ({
  role: 'button' as const,
  tabIndex: 0,
  'aria-label': label,
  onClick: action,
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  },
});
const chordLabel = (c: FieldChord, tetrad: boolean, hidden: boolean) =>
  hidden ? `? grau ${c.degree} oculto, ative para revelar` : `${romanOf(c, tetrad)} ${sym(c, tetrad)}${c.func ? `, ${FUNC_NAMES[c.func].name}` : ''}, ative para ouvir`;

/** Célula que pode ficar escondida no modo estudo. */
function Cell({ id, study, children, always }: { id: string; study: Study; children: ReactNode; always?: boolean }) {
  if (!study.on || always || study.shown.has(id)) return <>{children}</>;
  return (
    <button type="button" className="hidden-cell" onClick={() => study.reveal(id)} aria-label="Revelar">
      ?
    </button>
  );
}

export function FuncLegend({ def }: { def: FieldDef }) {
  if (!def.functions) return <p className="muted small-text">Campo modal: não segue as funções tonais clássicas (T, SD, D). A música costuma "morar" em um acorde, e o modo é definido pela nota característica.</p>;
  return (
    <div className="func-legend">
      {(Object.keys(FUNC_NAMES) as Func[]).map((f) => (
        <span key={f} className={`func-badge ${funcClass(f)}`} title={FUNC_NAMES[f].desc}>
          <b>{FUNC_NAMES[f].short}</b> {FUNC_NAMES[f].name}
        </span>
      ))}
    </div>
  );
}

// ============ Tabela do campo ============

export function FieldTable({ field, tetrad, lang, study, onPlay }: { field: Field; tetrad: boolean; lang: Lang; study: Study; onPlay: (c: FieldChord) => void }) {
  return (
    <div className="table-scroll">
      <table className="field-table">
        <thead>
          <tr>
            <th>Grau</th>
            <th>Tríade</th>
            <th>Tétrade</th>
            <th>Notas</th>
            <th>Função</th>
          </tr>
        </thead>
        <tbody>
          {field.chords.map((c) => {
            const k = (col: string) => `t-${c.degree}-${col}`;
            return (
              <tr key={c.degree} className={funcClass(c.func)}>
                <td className="deg">
                  <b>{c.roman}</b>
                  <small>{c.token}</small>
                </td>
                <td>
                  <Cell id={k('tri')} study={study}>
                    <button type="button" className="chord-btn" onClick={() => onPlay(c)} title={c.fullName}>
                      {c.symbol}
                    </button>
                  </Cell>
                </td>
                <td>
                  <Cell id={k('tet')} study={study}>
                    <button type="button" className="chord-btn" onClick={() => onPlay(c)} title={c.fullNameTetrad}>
                      {c.symbolTetrad}
                    </button>
                    <small className="muted"> {c.romanTetrad}</small>
                  </Cell>
                </td>
                <td className="notes-col">
                  <Cell id={k('notes')} study={study}>
                    {notesOf(c, tetrad, lang)}
                  </Cell>
                </td>
                <td>
                  <Cell id={k('fn')} study={study}>
                    {c.func ? <span className={`func-badge ${funcClass(c.func)}`}>{c.func}</span> : <span className="muted">—</span>}
                  </Cell>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============ Roda do campo (7 setores) ============

const polar = (r: number, deg: number): [number, number] => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];
function sector(r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = polar(r1, a0);
  const [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1);
  const [x3, y3] = polar(r0, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
}

const FUNC_FILL: Record<Func | 'none', string> = { T: 'var(--f-t)', SD: 'var(--f-sd)', D: 'var(--f-d)', none: 'var(--f-none)' };
const DEGREE_HUE = (i: number) => `hsl(${(i * 51 + 250) % 360} 70% 52%)`;

export function FieldWheel({ field, tetrad, study, onPlay, lang }: { field: Field; tetrad: boolean; study: Study; onPlay: (c: FieldChord) => void; lang: Lang }) {
  const n = field.chords.length;
  const step = 360 / n;
  return (
    <svg className="wheel" viewBox="-210 -210 420 420" role="group" aria-label={`Roda do campo harmônico de ${noteLabel(field.scale.root, lang)} ${shortName(field.def)}`}>
      {field.chords.map((c, i) => {
        const a0 = -90 + i * step + 1;
        const a1 = -90 + (i + 1) * step - 1;
        const mid = (a0 + a1) / 2;
        const fill = c.func ? FUNC_FILL[c.func] : DEGREE_HUE(i);
        const idChord = `w-${c.degree}-c`;
        const [tx, ty] = polar(150, mid);
        const [rx, ry] = polar(88, mid);
        const hidden = study.on && !study.shown.has(idChord);
        return (
          <g key={c.degree} className="wheel-seg" {...asButton(chordLabel(c, tetrad, hidden), () => (hidden ? study.reveal(idChord) : onPlay(c)))}>
            <path d={sector(120, 200, a0, a1)} fill={fill} opacity={hidden ? 0.45 : 0.95} />
            <path d={sector(60, 118, a0, a1)} fill={fill} opacity={0.3} />
            <text aria-hidden="true" x={tx} y={ty} className="wheel-chord" textAnchor="middle" dominantBaseline="central">
              {hidden ? '?' : sym(c, tetrad)}
            </text>
            <text aria-hidden="true" x={rx} y={ry} className="wheel-roman" textAnchor="middle" dominantBaseline="central">
              {romanOf(c, tetrad)}
            </text>
          </g>
        );
      })}
      <circle r="56" className="wheel-core" />
      <text y="-10" className="wheel-title" textAnchor="middle">
        {noteLabel(field.scale.root, lang)}
      </text>
      <text y="12" className="wheel-sub" textAnchor="middle">
        {shortName(field.def)}
      </text>
    </svg>
  );
}

// ============ Círculo das quintas ============

const R = { out: [150, 200], mid: [104, 148], inn: [66, 102] } as const;

export function CircleOfFifths({ field, tetrad, study, onPlay, lang, pref }: { field: Field; tetrad: boolean; study: Study; onPlay: (c: FieldChord) => void; lang: Lang; pref: AccPref }) {
  // onde cada acorde do campo cai no círculo: maior → anel externo; menor → anel do meio (na posição da relativa maior); diminuto → anel interno
  const placed = useMemo(() => {
    const map = new Map<string, FieldChord>();
    const outside: FieldChord[] = [];
    for (const c of field.chords) {
      if (c.triad.id === 'maj') map.set(`out-${circleIndex(c.rootPc)}`, c);
      else if (c.triad.id === 'min') map.set(`mid-${circleIndex(mod12(c.rootPc + 3))}`, c);
      else if (c.triad.id === 'dim') map.set(`inn-${circleIndex(mod12(c.rootPc + 1))}`, c);
      else outside.push(c);
    }
    return { map, outside };
  }, [field]);

  const labelMajor = (pc: number) => (pc === 6 ? pcLabelBoth(pc, lang) : pcLabel(pc, [1, 3, 8, 10].includes(pc) ? 'flat' : 'sharp', lang));
  const labelMinor = (pc: number, i: number) => (i === 6 ? pcLabelBoth(mod12(pc + 9), lang) + 'm' : pcLabel(mod12(pc + 9), i < 6 ? 'sharp' : 'flat', lang) + 'm');
  const labelDim = (pc: number, i: number) => (i === 6 ? pcLabelBoth(mod12(pc + 11), lang) + '°' : pcLabel(mod12(pc + 11), i < 6 ? 'sharp' : 'flat', lang) + '°');
  const parent = parentMajor(field.def, field.rootPc);
  const sig = signatureOf(parent);
  void pref;

  const ring = (key: 'out' | 'mid' | 'inn', label: (pc: number, i: number) => string) =>
    CIRCLE_ORDER.map((pc, i) => {
      const a0 = -90 + i * 30 - 15 + 0.6;
      const a1 = -90 + i * 30 + 15 - 0.6;
      const [r0, r1] = R[key];
      const c = placed.map.get(`${key}-${i}`);
      const id = `c-${key}-${i}`;
      const hidden = !!c && study.on && !study.shown.has(id) && c.degree !== 1;
      const fill = c ? (c.func ? FUNC_FILL[c.func] : DEGREE_HUE(c.degree - 1)) : undefined;
      const [tx, ty] = polar((r0 + r1) / 2, (a0 + a1) / 2);
      const small = key !== 'out' ? 'circle-small' : '';
      return (
        <g key={`${key}-${i}`} className={`slice${c ? ' active' : ''}`} {...(c ? asButton(chordLabel(c, tetrad, hidden), () => (hidden ? study.reveal(id) : onPlay(c))) : { 'aria-hidden': true as const })}>
          <path d={sector(r0, r1, a0, a1)} fill={fill} opacity={c ? (hidden ? 0.5 : 0.95) : undefined} className={c ? 'on' : 'off'} />
          {c ? (
            <>
              <text aria-hidden="true" x={tx} y={ty - 5} className={`circle-roman ${small}`} textAnchor="middle" dominantBaseline="central">
                {hidden ? '?' : romanOf(c, tetrad)}
              </text>
              {!hidden && (
                <text aria-hidden="true" x={tx} y={ty + 9} className="circle-note" textAnchor="middle" dominantBaseline="central">
                  {sym(c, tetrad)}
                </text>
              )}
            </>
          ) : (
            <text x={tx} y={ty} className={`circle-label ${small}`} textAnchor="middle" dominantBaseline="central">
              {label(pc, i)}
            </text>
          )}
        </g>
      );
    });

  return (
    <div className="circle-block">
      <svg className="circle5" viewBox="-210 -210 420 420" role="group" aria-label={`Círculo das quintas com o campo de ${noteLabel(field.scale.root, lang)} ${shortName(field.def)}`}>
        {ring('out', (pc) => labelMajor(pc))}
        {ring('mid', (pc, i) => labelMinor(pc, i))}
        {ring('inn', (pc, i) => labelDim(pc, i))}
        <circle r="62" className="wheel-core" />
        <text y="-22" className="wheel-sub" textAnchor="middle">
          Armadura
        </text>
        <text y="2" className="wheel-title" textAnchor="middle">
          {sig.count ? `${Math.abs(sig.count)}${sig.kind}` : '0'}
        </text>
        <text y="22" className="wheel-sub" textAnchor="middle">
          {noteLabel(field.scale.root, lang)} {shortName(field.def)}
        </text>
      </svg>
      <div className="circle-notes">
        <p className="muted small-text">
          <b>Anel externo:</b> acordes maiores (cada um é a quinta do vizinho à esquerda). <b>Anel do meio:</b> menores, na posição da sua relativa maior. <b>Anel interno:</b> diminutos, na posição da tonalidade de que são o 7º grau.
        </p>
        <p className="small-text">
          Armadura de clave do campo: <b>{signatureText(parent, lang)}</b>
          {field.def.altered && <span className="muted"> · {field.def.altered} em relação a ela</span>}.
        </p>
        {placed.outside.length > 0 && (
          <p className="small-text">
            <b>Fora do círculo:</b>{' '}
            {placed.outside.map((c) => (
              <button key={c.degree} type="button" className="chord-btn" onClick={() => onPlay(c)}>
                {romanOf(c, tetrad)} = {sym(c, tetrad)}
              </button>
            ))}{' '}
            <span className="muted">(acordes aumentados não pertencem aos anéis do círculo)</span>
          </p>
        )}
      </div>
    </div>
  );
}

// ============ Todos os tons ============

export function AllKeysTable({ def, tetrad, order, study, fallback, lang, onPlay }: { def: FieldDef; tetrad: boolean; order: 'circle' | 'chromatic'; study: Study; fallback: AccPref; lang: Lang; onPlay: (c: FieldChord) => void }) {
  const roots = order === 'circle' ? CIRCLE_ORDER : Array.from({ length: 12 }, (_, i) => i);
  // campos menores/modais: o círculo é indexado pela relativa maior; mostramos a tônica real do campo
  const rows = roots.map((pc) => {
    const root = mod12(pc + def.parentOffset);
    return buildField(def, root, autoPref(def, root, fallback));
  });
  return (
    <div className="table-scroll">
      <table className="field-table keys-table">
        <thead>
          <tr>
            <th>Tom</th>
            {rows[0].chords.map((c) => (
              <th key={c.degree}>{c.roman}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((f, ri) => (
            <tr key={f.rootPc}>
              <td className="deg">
                <b>{noteLabel(f.scale.root, lang)}</b>
                <small>{(() => { const s = signatureOf(parentMajor(def, f.rootPc)); return s.count ? `${Math.abs(s.count)}${s.kind}` : '0'; })()}</small>
              </td>
              {f.chords.map((c) => (
                <td key={c.degree} className={funcClass(c.func)}>
                  <Cell id={`k-${ri}-${c.degree}`} study={study} always={c.degree === 1}>
                    <button type="button" className="chord-btn" onClick={() => onPlay(c)}>
                      {sym(c, tetrad)}
                    </button>
                  </Cell>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ Comparar campos (mesma tônica) ============

export function CompareTable({ ids, root, tetrad, fallback, lang, onPlay }: { ids: string[]; root: number; tetrad: boolean; fallback: AccPref; lang: Lang; onPlay: (c: FieldChord) => void }) {
  const fields = ids.map((id) => {
    const def = fieldById(id);
    return buildField(def, root, autoPref(def, root, fallback));
  });
  if (!fields.length) return <p className="muted">Escolha pelo menos um campo.</p>;
  return (
    <div className="table-scroll">
      <table className="field-table compare">
        <thead>
          <tr>
            <th>Grau</th>
            {fields.map((f) => (
              <th key={f.def.id}>
                {noteLabel(f.scale.root, lang)} {shortName(f.def)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 7 }, (_, i) => (
            <tr key={i}>
              <td className="deg">
                <b>{['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][i]}</b>
              </td>
              {fields.map((f, fi) => {
                const c = f.chords[i];
                const differs = fi > 0 && sym(c, tetrad) !== sym(fields[0].chords[i], tetrad);
                return (
                  <td key={f.def.id} className={`${funcClass(c.func)}${differs ? ' differs' : ''}`}>
                    <button type="button" className="chord-btn" onClick={() => onPlay(c)}>
                      {sym(c, tetrad)}
                    </button>
                    <small className="muted"> {romanOf(c, tetrad)}</small>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const COMPARE_DEFAULT = ['major', 'natural-minor', 'harmonic-minor', 'melodic-minor'];
export const COMPARE_OPTIONS = FIELDS.map((f) => ({ id: f.id, name: f.name }));
