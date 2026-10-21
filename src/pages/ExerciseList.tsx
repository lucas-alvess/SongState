import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Chips, PageHeader } from '../components/ui';
import { EXERCISES } from '../lib/exercises';
import { useStats } from '../lib/storage';

const CATEGORIES = ['Todos', ...new Set(EXERCISES.map((e) => e.category))];
const LEVELS = ['Todos', 'Iniciante', 'Intermediário', 'Avançado'];

export function ExerciseList() {
  const { stats } = useStats();
  const [cat, setCat] = useState('Todos');
  const [lvl, setLvl] = useState('Todos');

  const list = EXERCISES.filter((e) => (cat === 'Todos' || e.category === cat) && (lvl === 'Todos' || e.level === lvl));
  const practiced = EXERCISES.filter((e) => stats[e.id]?.attempts).length;

  return (
    <>
      <PageHeader eyebrow={`${practiced}/${EXERCISES.length} praticados`} title="Exercícios" sub="Treinos interativos de memorização com pontuação. Cada um registra sua taxa de acerto e melhor sequência." />
      <div className="filter-rows">
        <Chips small value={cat} onChange={setCat} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
        <Chips small value={lvl} onChange={setLvl} options={LEVELS.map((c) => ({ value: c, label: c }))} />
      </div>
      <div className="card-grid">
        {list.map((e) => {
          const st = stats[e.id];
          const pct = st && st.attempts ? Math.round((st.correct / st.attempts) * 100) : null;
          return (
            <Link key={e.id} to={`/exercicios/${e.id}`} className="card exercise-card">
              <div className="card-icon">
                <Icon name={e.icon} size={26} />
              </div>
              <div className="card-body">
                <div className="card-top">
                  <h3 aria-level={2}>{e.title}</h3>
                  <span className={`badge lvl-${e.level}`}>{e.level}</span>
                </div>
                <p className="muted">{e.desc}</p>
                <div className="card-foot">
                  <span className="tag">{e.category}</span>
                  <span className="muted small-text">{pct === null ? 'Ainda não praticado' : `${pct}% de acerto · melhor sequência ${st.best}`}</span>
                </div>
                {pct !== null && (
                  <div className="bar">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
