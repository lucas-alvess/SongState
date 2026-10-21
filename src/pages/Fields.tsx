import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AllKeysTable, CircleOfFifths, COMPARE_DEFAULT, COMPARE_OPTIONS, CompareTable, FieldTable, FieldWheel, FuncLegend, autoPref, romanOf, sym, type Study } from '../components/FieldViews';
import { Icon } from '../components/Icon';
import { Chips, Field, PageHeader, RootChips, Toggle } from '../components/ui';
import { strum } from '../lib/audio';
import { FIELDS, FIELD_GROUPS, buildField, chordMidis, fieldById, parentMajor, signatureText, type FieldChord } from '../lib/harmony';
import { noteLabel } from '../lib/music';
import { useLocalStorage, useSettings } from '../lib/storage';

type View = 'tabela' | 'circulo' | 'roda' | 'tons' | 'comparar';
interface Prefs {
  root: number;
  fieldId: string;
  view: View;
  tetrad: boolean;
  study: boolean;
  order: 'circle' | 'chromatic';
  compare: string[];
}
const DEFAULT: Prefs = { root: 0, fieldId: 'major', view: 'tabela', tetrad: false, study: false, order: 'circle', compare: COMPARE_DEFAULT };

export function Fields() {
  const { settings } = useSettings();
  const { lang, pref } = settings;
  const [p, setP] = useLocalStorage<Prefs>('ss.fields', DEFAULT);
  const patch = useCallback((x: Partial<Prefs>) => setP((s) => ({ ...s, ...x })), [setP]);
  const [params, setParams] = useSearchParams();
  const [shown, setShown] = useState<Set<string>>(new Set());
  const timers = useRef<number[]>([]);

  // links das lições: #/campos?root=0&field=major&view=circulo
  useEffect(() => {
    if (!params.has('field')) return;
    const view = params.get('view') as View | null;
    patch({ root: +(params.get('root') ?? 0), fieldId: params.get('field')!, ...(view ? { view } : {}) });
    setParams({}, { replace: true });
  }, [params, patch, setParams]);

  // ao mudar de campo, tom ou aba, as respostas voltam a ficar escondidas
  useEffect(() => setShown(new Set()), [p.root, p.fieldId, p.view, p.study]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const def = fieldById(p.fieldId);
  const field = useMemo(() => buildField(def, p.root, autoPref(def, p.root, pref)), [def, p.root, pref]);
  const parent = parentMajor(def, p.root);

  const study: Study = { on: p.study, shown, reveal: (k) => setShown((s) => new Set(s).add(k)) };
  const playChord = useCallback((c: FieldChord) => strum(chordMidis(c, p.tetrad), 0.035, 0.26), [p.tetrad]);
  const playSeq = (chords: FieldChord[]) => {
    timers.current.forEach(clearTimeout);
    timers.current = chords.map((c, i) => window.setTimeout(() => playChord(c), i * 850));
  };
  const hearField = () => playSeq([...field.chords, field.chords[0]]);

  const views: { value: View; label: string }[] = [
    { value: 'tabela', label: 'Tabela' },
    { value: 'circulo', label: 'Círculo das quintas' },
    { value: 'roda', label: 'Roda do campo' },
    { value: 'tons', label: 'Todos os tons' },
    { value: 'comparar', label: 'Comparar campos' },
  ];

  return (
    <>
      <PageHeader eyebrow="Teoria" title="Campos harmônicos" sub="Os acordes que nascem de cada escala, em tabela e em círculo. Ative o modo estudo para se testar: as respostas ficam escondidas e você toca para revelar." />

      <section className="panel">
        <Field label="Tônica">
          <RootChips value={p.root} onChange={(root) => patch({ root })} />
        </Field>
        <div className="row gap wrap field-row">
          <Field label="Campo harmônico">
            <select aria-label="Campo harmônico" value={p.fieldId} onChange={(e) => patch({ fieldId: e.target.value })}>
              {FIELD_GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {FIELDS.filter((f) => f.group === g).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Acordes">
            <Chips
              small
              value={p.tetrad ? 'tet' : 'tri'}
              onChange={(v) => patch({ tetrad: v === 'tet' })}
              options={[
                { value: 'tri', label: 'Tríades' },
                { value: 'tet', label: 'Tétrades (com 7ª)' },
              ]}
            />
          </Field>
        </div>
        <div className="scale-info">
          <b>
            {noteLabel(field.scale.root, lang)} {def.name}
          </b>
          <span className="muted">{field.scale.notes.map((n) => noteLabel(n.spelled, lang)).join(' · ')}</span>
          <span className="muted">Armadura: {signatureText(parent, lang)}</span>
        </div>
        <p className="field-desc">{def.desc}</p>
        <div className="row gap wrap">
          <button type="button" className="btn primary" onClick={hearField}>
            <Icon name="volume" size={16} /> Ouvir o campo
          </button>
          <Toggle label="Modo estudo (esconder as respostas)" checked={p.study} onChange={(study) => patch({ study })} />
        </div>
      </section>

      <div className="view-tabs">
        <Chips small value={p.view} onChange={(view) => patch({ view })} options={views} />
      </div>

      <section className="panel view-panel">
        {p.view === 'tabela' && (
          <>
            <FieldTable field={field} tetrad={p.tetrad} lang={lang} study={study} onPlay={playChord} />
            <div className="pattern">
              <span className="muted">Padrão das tríades</span>
              <b>{field.quality}</b>
              <span className="muted">Padrão das tétrades</span>
              <b>{field.qualityTetrad}</b>
            </div>
            <FuncLegend def={def} />
          </>
        )}
        {p.view === 'circulo' && <CircleOfFifths field={field} tetrad={p.tetrad} study={study} onPlay={playChord} lang={lang} pref={pref} />}
        {p.view === 'roda' && (
          <>
            <FieldWheel field={field} tetrad={p.tetrad} study={study} onPlay={playChord} lang={lang} />
            <FuncLegend def={def} />
          </>
        )}
        {p.view === 'tons' && (
          <>
            <div className="row gap wrap" style={{ marginBottom: 10 }}>
              <span className="muted small-text">Ordem dos tons</span>
              <Chips
                small
                value={p.order}
                onChange={(order) => patch({ order })}
                options={[
                  { value: 'circle', label: 'Círculo das quintas' },
                  { value: 'chromatic', label: 'Cromática' },
                ]}
              />
            </div>
            <AllKeysTable def={def} tetrad={p.tetrad} order={p.order} study={study} fallback={pref} lang={lang} onPlay={playChord} />
            <p className="muted small-text">
              A coluna "Tom" mostra a tônica e o número de acidentes da armadura. No modo estudo, só o I aparece: tente dizer o resto da linha antes de tocar nas células.
            </p>
          </>
        )}
        {p.view === 'comparar' && (
          <>
            <p className="muted small-text">Mesma tônica, campos diferentes. Células destacadas são as que mudam em relação ao primeiro campo da lista. É a melhor forma de enxergar o que cada alteração de escala faz com os acordes.</p>
            <div className="chips small" style={{ marginBottom: 12 }}>
              {COMPARE_OPTIONS.map((o) => (
                <button key={o.id} type="button" className={`chip${p.compare.includes(o.id) ? ' active' : ''}`} onClick={() => patch({ compare: p.compare.includes(o.id) ? p.compare.filter((x) => x !== o.id) : [...p.compare, o.id] })}>
                  {o.name.split(' (')[0]}
                </button>
              ))}
            </div>
            <CompareTable ids={p.compare} root={p.root} tetrad={p.tetrad} fallback={pref} lang={lang} onPlay={playChord} />
          </>
        )}
      </section>

      <h2 className="section-title">Progressões comuns neste campo</h2>
      <div className="prog-grid">
        {def.progressions.map((pr) => {
          const chords = pr.degrees.map((d) => field.chords[d - 1]);
          return (
            <div key={pr.name} className="prog-card">
              <div className="row between">
                <b>{pr.name}</b>
                <button type="button" className="btn small" onClick={() => playSeq(chords)}>
                  <Icon name="play" size={13} /> Ouvir
                </button>
              </div>
              <div className="prog-chords">
                {chords.map((c, i) => (
                  <span key={i} className={`prog-chord func-${c.func ?? 'none'}`}>
                    <b>{p.study ? '?' : sym(c, p.tetrad)}</b>
                    <small>{romanOf(c, p.tetrad)}</small>
                  </span>
                ))}
              </div>
              {pr.note && <p className="muted small-text">{pr.note}</p>}
            </div>
          );
        })}
      </div>

      <h2 className="section-title">Como memorizar</h2>
      <section className="panel">
        <ul className="tips">
          {def.tips.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <p className="muted small-text">Para fixar: treine nos exercícios "Campo harmônico" (grau → acorde e acorde → grau) e, na aba Estudos, siga o capítulo de Campos harmônicos.</p>
      </section>
    </>
  );
}
