import { Link, useParams } from 'react-router-dom';
import { EXERCISES } from '../lib/studies';
import { FindAll, IntervalFind, IntervalId, NoteFind, NoteName, ScaleId, ScaleSpell, ShapeBuild } from './quizzes';

const RUNNERS: Record<string, () => React.JSX.Element> = {
  'note-name': NoteName,
  'note-find': NoteFind,
  'find-all': FindAll,
  'scale-spell': ScaleSpell,
  'interval-id': IntervalId,
  'interval-find': IntervalFind,
  'shape-build': ShapeBuild,
  'scale-id': ScaleId,
};

export function ExerciseRunner() {
  const { id = '' } = useParams();
  const meta = EXERCISES.find((e) => e.id === id);
  const Runner = RUNNERS[id];
  if (!meta || !Runner) return <p>Exercício não encontrado. <Link to="/exercicios">Voltar</Link></p>;
  return (
    <>
      <Link to="/exercicios" className="back">← Exercícios</Link>
      <header className="page-header">
        <div>
          <h1>{meta.icon} {meta.title}</h1>
          <p className="muted">{meta.desc}</p>
        </div>
      </header>
      <Runner />
    </>
  );
}
