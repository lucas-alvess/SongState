import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { exerciseById } from '../lib/exercises';
import { FindAll, IntervalFind, IntervalId, NoteFind, NoteName, ScaleId, ScaleSpell, ShapeBuild } from './quizzes';
import { ChordBuild, ChordSpell, EarChord, EarInterval } from './quizzes2';
import { FieldBuildQuiz, FieldChordQuiz, FieldDegreeQuiz } from './quizzes3';

const RUNNERS: Record<string, () => React.JSX.Element> = {
  'note-name': NoteName,
  'note-find': NoteFind,
  'find-all': FindAll,
  'scale-spell': ScaleSpell,
  'interval-id': IntervalId,
  'interval-find': IntervalFind,
  'shape-build': ShapeBuild,
  'scale-id': ScaleId,
  'chord-spell': ChordSpell,
  'chord-build': ChordBuild,
  'field-chord': FieldChordQuiz,
  'field-degree': FieldDegreeQuiz,
  'field-build': FieldBuildQuiz,
  'ear-interval': EarInterval,
  'ear-chord': EarChord,
};

export function ExerciseRunner() {
  const { id = '' } = useParams();
  const meta = exerciseById(id);
  const Runner = RUNNERS[id];
  if (!meta || !Runner) {
    return (
      <p>
        Exercício não encontrado. <Link to="/exercicios">Voltar</Link>
      </p>
    );
  }
  return (
    <>
      <Link to="/exercicios" className="back">
        <Icon name="back" size={16} /> Exercícios
      </Link>
      <header className="page-header">
        <div>
          <span className="eyebrow">{meta.category}</span>
          <h1>{meta.title}</h1>
          <p className="muted">{meta.desc}</p>
        </div>
        <span className={`badge lvl-${meta.level}`}>{meta.level}</span>
      </header>
      <Runner />
    </>
  );
}
