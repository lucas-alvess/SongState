import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Metronome } from '../components/Metronome';
import { DEFAULT_BOARD, ScaleBoard, type BoardState } from '../components/ScaleBoard';
import { ALL_LESSONS, findLesson, type Lesson } from '../lib/curriculum';
import { exerciseById } from '../lib/exercises';
import { useLocalStorage, useStoredList } from '../lib/storage';

interface Progress {
  done: boolean[];
  sessions: { at: number; bpm: number }[];
}

export function StudyDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [custom, setCustom] = useStoredList<Lesson>('ss.studies');
  const found = findLesson(id, custom);
  if (!found) {
    return (
      <p>
        Estudo não encontrado. <Link to="/estudos">Voltar</Link>
      </p>
    );
  }
  const { lesson, level, chapter } = found;
  const idx = ALL_LESSONS.findIndex((x) => x.lesson.id === id);
  const prev = idx > 0 ? ALL_LESSONS[idx - 1].lesson : null;
  const next = idx >= 0 && idx < ALL_LESSONS.length - 1 ? ALL_LESSONS[idx + 1].lesson : null;
  return (
    <Detail
      key={lesson.id}
      lesson={lesson}
      crumb={level && chapter ? `${level.title} · ${chapter.title}` : 'Meus estudos'}
      prev={prev}
      next={next}
      onDelete={
        lesson.custom
          ? () => {
              setCustom((l) => l.filter((s) => s.id !== id));
              nav('/estudos');
            }
          : undefined
      }
    />
  );
}

function Detail({ lesson, crumb, prev, next, onDelete }: { lesson: Lesson; crumb: string; prev: Lesson | null; next: Lesson | null; onDelete?: () => void }) {
  const [board, setBoardRaw] = useState<BoardState>({ ...DEFAULT_BOARD, ...lesson.board });
  const setBoard = useCallback((p: Partial<BoardState>) => setBoardRaw((b) => ({ ...b, ...p })), []);
  const [progress, setProgress] = useLocalStorage<Progress>(`ss.study.${lesson.id}`, { done: [], sessions: [] });
  const [bpm, setBpm] = useState(lesson.bpm);

  const toggle = (i: number) => {
    const done = [...progress.done];
    done[i] = !done[i];
    setProgress({ ...progress, done });
  };
  const doneCount = lesson.steps.filter((_, i) => progress.done[i]).length;

  return (
    <>
      <Link to="/estudos" className="back">
        <Icon name="back" size={16} /> Estudos
      </Link>
      <header className="page-header">
        <div>
          <span className="eyebrow">{crumb}</span>
          <h1>{lesson.title}</h1>
          <p className="muted">{lesson.desc}</p>
        </div>
      </header>

      {lesson.theory && lesson.theory.length > 0 && (
        <section className="panel theory">
          <h3>Conceito</h3>
          {lesson.theory.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </section>
      )}

      {lesson.example?.map((e, i) => (
        <section key={i} className="panel example">
          {e.title && <h4>{e.title}</h4>}
          <pre>{e.text}</pre>
        </section>
      ))}
      {lesson.tip && (
        <div className="tip-box">
          <b>Dica</b>
          <span>{lesson.tip}</span>
        </div>
      )}

      <ScaleBoard state={board} setState={setBoard} advanced={false} />

      <div className="two-col">
        <section className="panel">
          <div className="row between">
            <h3>Passo a passo</h3>
            <span className="muted">
              {doneCount}/{lesson.steps.length}
            </span>
          </div>
          <div className="bar">
            <i style={{ width: `${(doneCount / Math.max(1, lesson.steps.length)) * 100}%` }} />
          </div>
          <ul className="checklist">
            {lesson.steps.map((s, i) => (
              <li key={i}>
                <label>
                  <input type="checkbox" checked={!!progress.done[i]} onChange={() => toggle(i)} />
                  <span>{s}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="row gap wrap">
            <label className="inline">
              BPM praticado
              <input type="number" min={30} max={240} value={bpm} onChange={(e) => setBpm(+e.target.value)} style={{ width: 80 }} />
            </label>
            <button type="button" className="btn primary" onClick={() => setProgress({ ...progress, sessions: [{ at: Date.now(), bpm }, ...progress.sessions].slice(0, 30) })}>
              Registrar sessão
            </button>
            <button type="button" className="btn" onClick={() => setProgress({ ...progress, done: [] })}>
              Limpar checklist
            </button>
          </div>
          {progress.sessions.length > 0 && (
            <div className="sessions">
              <h4>Histórico ({progress.sessions.length})</h4>
              <ul>
                {progress.sessions.slice(0, 5).map((s) => (
                  <li key={s.at}>
                    {new Date(s.at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {s.bpm} BPM
                  </li>
                ))}
              </ul>
            </div>
          )}
          {onDelete && (
            <button type="button" className="btn danger small" onClick={onDelete}>
              <Icon name="trash" size={15} /> Excluir estudo
            </button>
          )}
        </section>
        <div>
          <Metronome initialBpm={lesson.bpm} />
          {(lesson.exercises?.length || lesson.chord || lesson.jam || lesson.field || lesson.links?.length) && (
            <section className="panel">
              <h3>Pratique isto</h3>
              <div className="link-list">
                {lesson.exercises?.map((id) => {
                  const ex = exerciseById(id);
                  return ex ? (
                    <Link key={id} to={`/exercicios/${id}`} className="link-row">
                      <Icon name={ex.icon} size={18} /> {ex.title}
                      <Icon name="arrow" size={16} />
                    </Link>
                  ) : null;
                })}
                {lesson.chord && (
                  <Link to={`/acordes?root=${lesson.chord.root}&type=${lesson.chord.type}`} className="link-row">
                    <Icon name="chord" size={18} /> Dicionário de acordes
                    <Icon name="arrow" size={16} />
                  </Link>
                )}
                {lesson.field && (
                  <Link to={`/campos?root=${lesson.field.root}&field=${lesson.field.fieldId}&view=${lesson.field.view ?? 'tabela'}`} className="link-row">
                    <Icon name="wheel" size={18} /> Campos harmônicos: ver no site
                    <Icon name="arrow" size={16} />
                  </Link>
                )}
                {lesson.links?.map((l) => (
                  <Link key={l.to + l.label} to={l.to} className="link-row">
                    <Icon name="arrow" size={18} /> {l.label}
                  </Link>
                ))}
                {lesson.jam && (
                  <Link to="/backing/jam" className="link-row">
                    <Icon name="headphones" size={18} /> Jam tracks: tocar junto
                    <Icon name="arrow" size={16} />
                  </Link>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {(prev || next) && (
        <div className="lesson-nav">
          {prev ? (
            <Link to={`/estudos/${prev.id}`} className="btn">
              <Icon name="back" size={16} /> {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={`/estudos/${next.id}`} className="btn primary">
              {next.title} <Icon name="arrow" size={16} />
            </Link>
          )}
        </div>
      )}
    </>
  );
}
