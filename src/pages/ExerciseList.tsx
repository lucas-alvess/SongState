import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Chips, Field, PageHeader, RootChips, ScaleSelect } from '../components/ui';
import { EXERCISES, STUDIES, type Study } from '../lib/studies';
import { pcLabel, scaleById } from '../lib/music';
import { uid, useSettings, useStats, useStoredList } from '../lib/storage';

type Tab = 'exercicios' | 'estudos';

export function ExerciseList() {
  const { stats } = useStats();
  const { settings } = useSettings();
  const [tab, setTab] = useState<Tab>('exercicios');
  const [tag, setTag] = useState('todos');
  const [custom, setCustom] = useStoredList<Study>('ss.studies');
  const [adding, setAdding] = useState(false);

  const tags = ['todos', ...new Set(EXERCISES.flatMap((e) => e.tags))];
  const list = EXERCISES.filter((e) => tag === 'todos' || e.tags.includes(tag));

  return (
    <>
      <PageHeader title="Exercícios e estudos" sub="Treinos interativos de memorização e rotinas guiadas para praticar com o metrônomo." />
      <Chips
        value={tab}
        onChange={setTab}
        options={[
          { value: 'exercicios', label: `🎯 Exercícios (${EXERCISES.length})` },
          { value: 'estudos', label: `📚 Estudos (${STUDIES.length + custom.length})` },
        ]}
      />

      {tab === 'exercicios' && (
        <>
          <div style={{ margin: '14px 0' }}>
            <Chips small value={tag} onChange={setTag} options={tags.map((t) => ({ value: t, label: t }))} />
          </div>
          <div className="card-grid">
            {list.map((e) => {
              const st = stats[e.id];
              const pct = st && st.attempts ? Math.round((st.correct / st.attempts) * 100) : null;
              return (
                <Link key={e.id} to={`/exercicios/${e.id}`} className="card exercise-card">
                  <div className="card-icon">{e.icon}</div>
                  <div className="card-body">
                    <div className="card-top">
                      <h3>{e.title}</h3>
                      <span className={`badge lvl-${e.level}`}>{e.level}</span>
                    </div>
                    <p className="muted">{e.desc}</p>
                    <div className="card-foot">
                      <span className="muted">{pct === null ? 'Ainda não praticado' : `${pct}% de acerto · melhor sequência ${st.best}`}</span>
                    </div>
                    {pct !== null && <div className="bar"><i style={{ width: `${pct}%` }} /></div>}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {tab === 'estudos' && (
        <>
          <div className="row between" style={{ margin: '14px 0' }}>
            <p className="muted" style={{ margin: 0 }}>Rotinas com passo a passo, braço pré-configurado e metrônomo.</p>
            <button type="button" className="btn primary" onClick={() => setAdding(true)}>+ Novo estudo</button>
          </div>
          <div className="card-grid">
            {[...STUDIES, ...custom].map((s) => {
              const sc = scaleById(s.board.scaleId ?? 'major');
              return (
                <Link key={s.id} to={`/estudos/${s.id}`} className="card study-card">
                  <div className="card-top">
                    <h3>{s.title}</h3>
                    <span className={`badge lvl-${s.level}`}>{s.level}</span>
                  </div>
                  <p className="muted">{s.desc}</p>
                  <div className="card-foot">
                    <span className="tag">{pcLabel(s.board.root ?? 0, settings.pref, settings.lang)} {sc.name}</span>
                    <span className="tag">♩ {s.bpm}</span>
                    <span className="tag">{s.steps.length} passos</span>
                    {s.custom && <span className="tag mine">meu</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {adding && <NewStudy onClose={() => setAdding(false)} onSave={(s) => { setCustom((l) => [...l, s]); setAdding(false); }} />}
    </>
  );
}

function NewStudy({ onClose, onSave }: { onClose: () => void; onSave: (s: Study) => void }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [root, setRoot] = useState(9);
  const [scaleId, setScaleId] = useState('minor-pent');
  const [bpm, setBpm] = useState(70);
  const [steps, setSteps] = useState('');
  const [level, setLevel] = useState<Study['level']>('Intermediário');

  const save = () => {
    if (!title.trim()) return;
    onSave({
      id: `custom-${uid()}`,
      title: title.trim(),
      desc: desc.trim(),
      level,
      bpm,
      custom: true,
      board: { root, scaleId, pos: 0, fretMax: 17, label: 'note' },
      steps: steps.split('\n').map((x) => x.trim()).filter(Boolean),
    });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Novo estudo</h2>
          <button type="button" className="btn icon" onClick={onClose}>✕</button>
        </div>
        <Field label="Título"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Solo da música X em Si menor" /></Field>
        <Field label="Descrição"><textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <Field label="Tônica"><RootChips value={root} onChange={setRoot} /></Field>
        <Field label="Escala"><ScaleSelect value={scaleId} onChange={setScaleId} /></Field>
        <div className="row gap">
          <Field label="BPM alvo"><input type="number" min={30} max={240} value={bpm} onChange={(e) => setBpm(+e.target.value)} /></Field>
          <Field label="Nível">
            <select value={level} onChange={(e) => setLevel(e.target.value as Study['level'])}>
              <option>Iniciante</option><option>Intermediário</option><option>Avançado</option>
            </select>
          </Field>
        </div>
        <Field label="Passos (um por linha)"><textarea rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={'Tocar a posição 1 a 60 BPM\nConectar com a posição 2'} /></Field>
        <button type="button" className="btn primary block" onClick={save}>Salvar estudo</button>
      </div>
    </div>
  );
}
