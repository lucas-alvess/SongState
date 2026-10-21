import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Field, PageHeader, RootChips, ScaleSelect } from '../components/ui';
import { ALL_LESSONS, LEVELS, type Lesson } from '../lib/curriculum';
import { pcLabel, scaleById } from '../lib/music';
import { uid, useLocalStorage, useSettings, useStoredList } from '../lib/storage';

export function lessonProgress(lesson: Lesson): number {
  try {
    const raw = localStorage.getItem(`ss.study.${lesson.id}`);
    if (!raw) return 0;
    const done: boolean[] = JSON.parse(raw).done ?? [];
    return lesson.steps.filter((_, i) => done[i]).length / Math.max(1, lesson.steps.length);
  } catch {
    return 0;
  }
}

type Tab = 'iniciante' | 'intermediario' | 'avancado' | 'meus';

export function Studies() {
  const { settings } = useSettings();
  const [tab, setTab] = useLocalStorage<{ t: Tab }>('ss.studies.tab', { t: 'iniciante' });
  const [custom, setCustom] = useStoredList<Lesson>('ss.studies');
  const [adding, setAdding] = useState(false);

  const level = LEVELS.find((l) => l.id === tab.t);
  const counts = Object.fromEntries(
    LEVELS.map((l) => {
      const lessons = l.chapters.flatMap((c) => c.lessons);
      return [l.id, { done: lessons.filter((x) => lessonProgress(x) >= 1).length, total: lessons.length }];
    }),
  );
  const totalDone = ALL_LESSONS.filter((x) => lessonProgress(x.lesson) >= 1).length;

  return (
    <>
      <PageHeader eyebrow={`${totalDone}/${ALL_LESSONS.length} lições concluídas`} title="Estudos" sub="Um caminho em capítulos, do primeiro contato com o braço até improvisação sobre harmonias. Cada lição traz teoria, passos práticos, o braço já configurado e metrônomo.">
        <div className="row gap wrap">
          <Link to="/referencia" className="btn small">
            <Icon name="book" size={15} /> Referência e glossário
          </Link>
          <Link to="/campos" className="btn small">
            <Icon name="wheel" size={15} /> Campos harmônicos
          </Link>
        </div>
      </PageHeader>

      <div className="level-tabs">
        {LEVELS.map((l) => (
          <button key={l.id} type="button" className={`level-tab${tab.t === l.id ? ' active' : ''}`} onClick={() => setTab({ t: l.id })}>
            <b>{l.title}</b>
            <small>
              {counts[l.id].done}/{counts[l.id].total}
            </small>
          </button>
        ))}
        <button type="button" className={`level-tab${tab.t === 'meus' ? ' active' : ''}`} onClick={() => setTab({ t: 'meus' })}>
          <b>Meus estudos</b>
          <small>{custom.length}</small>
        </button>
      </div>

      {level && (
        <>
          <p className="muted level-desc">{level.desc}</p>
          {level.chapters.map((ch) => (
            <section key={ch.id} className="chapter">
              <div className="chapter-head">
                <h2>{ch.title}</h2>
                <p className="muted">{ch.desc}</p>
              </div>
              <div className="lesson-list">
                {ch.lessons.map((l, i) => {
                  const p = lessonProgress(l);
                  const sc = l.board.scaleId ? scaleById(l.board.scaleId) : null;
                  return (
                    <Link key={l.id} to={`/estudos/${l.id}`} className={`lesson${p >= 1 ? ' done' : ''}`}>
                      <span className="lesson-n">{p >= 1 ? <Icon name="check" size={16} /> : i + 1}</span>
                      <div className="lesson-body">
                        <h3>{l.title}</h3>
                        <p className="muted">{l.desc}</p>
                        <div className="card-foot">
                          {sc && l.board.root !== undefined && (
                            <span className="tag">
                              {pcLabel(l.board.root, settings.pref, settings.lang)} {sc.name}
                            </span>
                          )}
                          <span className="tag">♩ {l.bpm}</span>
                          <span className="tag">{l.steps.length} passos</span>
                          {l.chord && <span className="tag key">acordes</span>}
                        </div>
                        {p > 0 && p < 1 && (
                          <div className="bar">
                            <i style={{ width: `${p * 100}%` }} />
                          </div>
                        )}
                      </div>
                      <Icon name="arrow" size={18} />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}

      {tab.t === 'meus' && (
        <>
          <div className="row between" style={{ margin: '14px 0' }}>
            <p className="muted" style={{ margin: 0 }}>Crie rotinas próprias: escolha uma escala, escreva seus passos e acompanhe o progresso.</p>
            <button type="button" className="btn primary" onClick={() => setAdding(true)}>
              <Icon name="plus" size={18} /> Novo estudo
            </button>
          </div>
          {custom.length === 0 ? (
            <div className="panel empty">
              <div className="empty-icon">
                <Icon name="book" size={34} />
              </div>
              <h3>Nenhum estudo seu ainda</h3>
              <p className="muted">Crie uma rotina, por exemplo: “Solo da música X em Si menor”.</p>
            </div>
          ) : (
            <div className="lesson-list">
              {custom.map((l) => (
                <Link key={l.id} to={`/estudos/${l.id}`} className="lesson">
                  <span className="lesson-n">
                    <Icon name="star" size={15} />
                  </span>
                  <div className="lesson-body">
                    <h3>{l.title}</h3>
                    <p className="muted">{l.desc}</p>
                    <div className="card-foot">
                      <span className="tag">♩ {l.bpm}</span>
                      <span className="tag">{l.steps.length} passos</span>
                    </div>
                  </div>
                  <Icon name="arrow" size={18} />
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {adding && (
        <NewStudy
          onClose={() => setAdding(false)}
          onSave={(s) => {
            setCustom((l) => [...l, s]);
            setAdding(false);
            setTab({ t: 'meus' });
          }}
        />
      )}
    </>
  );
}

function NewStudy({ onClose, onSave }: { onClose: () => void; onSave: (s: Lesson) => void }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [root, setRoot] = useState(9);
  const [scaleId, setScaleId] = useState('minor-pent');
  const [bpm, setBpm] = useState(70);
  const [steps, setSteps] = useState('');

  const save = () => {
    if (!title.trim()) return;
    onSave({
      id: `custom-${uid()}`,
      title: title.trim(),
      desc: desc.trim(),
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
          <button type="button" className="btn icon" onClick={onClose} aria-label="Fechar">
            <Icon name="x" />
          </button>
        </div>
        <Field label="Título">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Solo da música X em Si menor" />
        </Field>
        <Field label="Descrição">
          <textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <Field label="Tônica">
          <RootChips value={root} onChange={setRoot} />
        </Field>
        <Field label="Escala">
          <ScaleSelect value={scaleId} onChange={setScaleId} />
        </Field>
        <Field label="BPM alvo">
          <input type="number" min={30} max={240} value={bpm} onChange={(e) => setBpm(+e.target.value)} />
        </Field>
        <Field label="Passos (um por linha)">
          <textarea rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={'Tocar a posição 1 a 60 BPM\nConectar com a posição 2'} />
        </Field>
        <button type="button" className="btn primary block" onClick={save}>
          Salvar estudo
        </button>
      </div>
    </div>
  );
}
