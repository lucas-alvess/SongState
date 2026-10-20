import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DEFAULT_BOARD, ScaleBoard, type BoardState } from '../components/ScaleBoard';
import { Metronome } from '../components/Metronome';
import { STUDIES, studyById, type Study } from '../lib/studies';
import { useLocalStorage, useStoredList } from '../lib/storage';

interface Progress {
  done: boolean[];
  sessions: { at: number; bpm: number }[];
}

export function StudyDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [custom, setCustom] = useStoredList<Study>('ss.studies');
  const study = studyById(id, custom);
  if (!study) return <p>Estudo não encontrado. <Link to="/exercicios">Voltar</Link></p>;
  return <Detail key={study.id} study={study} onDelete={study.custom ? () => { setCustom((l) => l.filter((s) => s.id !== id)); nav('/exercicios'); } : undefined} />;
}

function Detail({ study, onDelete }: { study: Study; onDelete?: () => void }) {
  const [board, setBoardRaw] = useState<BoardState>({ ...DEFAULT_BOARD, ...study.board });
  const setBoard = useCallback((p: Partial<BoardState>) => setBoardRaw((b) => ({ ...b, ...p })), []);
  const [progress, setProgress] = useLocalStorage<Progress>(`ss.study.${study.id}`, { done: [], sessions: [] });
  const [bpm, setBpm] = useState(study.bpm);

  const toggle = (i: number) => {
    const done = [...progress.done];
    done[i] = !done[i];
    setProgress({ ...progress, done });
  };
  const doneCount = study.steps.filter((_, i) => progress.done[i]).length;
  const builtin = STUDIES.some((s) => s.id === study.id);

  return (
    <>
      <Link to="/exercicios" className="back">← Exercícios</Link>
      <header className="page-header">
        <div>
          <h1>{study.title}</h1>
          <p className="muted">{study.desc}</p>
        </div>
        <span className={`badge lvl-${study.level}`}>{study.level}</span>
      </header>

      <ScaleBoard state={board} setState={setBoard} advanced={false} />

      <div className="two-col">
        <section className="panel">
          <div className="row between">
            <h3>Passo a passo</h3>
            <span className="muted">{doneCount}/{study.steps.length}</span>
          </div>
          <div className="bar"><i style={{ width: `${(doneCount / Math.max(1, study.steps.length)) * 100}%` }} /></div>
          <ul className="checklist">
            {study.steps.map((s, i) => (
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
            <button type="button" className="btn" onClick={() => setProgress({ ...progress, done: [] })}>Limpar checklist</button>
          </div>
          {progress.sessions.length > 0 && (
            <div className="sessions">
              <h4>Histórico ({progress.sessions.length})</h4>
              <ul>
                {progress.sessions.slice(0, 5).map((s) => (
                  <li key={s.at}>{new Date(s.at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {s.bpm} BPM</li>
                ))}
              </ul>
            </div>
          )}
          {!builtin && onDelete && <button type="button" className="btn danger small" onClick={onDelete}>Excluir estudo</button>}
        </section>
        <Metronome initialBpm={study.bpm} />
      </div>
    </>
  );
}
