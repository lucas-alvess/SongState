import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Chips, PageHeader } from '../components/ui';
import { EXERCISES } from '../lib/exercises';
import { dueIds, streak } from '../lib/srs';
import { useDays, useSrs, useStats } from '../lib/storage';

const CATEGORIES = ['Todos', ...new Set(EXERCISES.map((e) => e.category))];
const LEVELS = ['Todos', 'Iniciante', 'Intermediário', 'Avançado'];

export function ExerciseList() {
  const { stats } = useStats();
  const [srs] = useSrs();
  const [days] = useDays();
  const due = dueIds(srs, Date.now()).length;
  const run = streak(days, Date.now());
  const [cat, setCat] = useState('Todos');
  const [lvl, setLvl] = useState('Todos');

  const list = EXERCISES.filter((e) => (cat === 'Todos' || e.category === cat) && (lvl === 'Todos' || e.level === lvl));
  const practiced = EXERCISES.filter((e) => stats[e.id]?.attempts).length;

  return (
    <>
      <PageHeader eyebrow={`${practiced}/${EXERCISES.length} praticados`} title="Exercícios" sub="Treinos interativos de memorização com pontuação. Cada um registra sua taxa de acerto e melhor sequência." />
      <Link to="/treino" className="card train-hero">
        <div className="card-icon">
          <Icon name="target" size={28} />
        </div>
        <div className="card-body">
          <h3 aria-level={2}>Treino de hoje</h3>
          <p className="muted">Uma sessão curta que mistura notas, escalas, acordes e campos harmônicos e repete mais o que você erra.</p>
          <div className="card-foot">
            <span className="tag">{due > 0 ? `${due} para revisar` : 'Pronto para começar'}</span>
            {run > 0 && <span className="muted small-text">🔥 {run} {run === 1 ? 'dia seguido' : 'dias seguidos'}</span>}
          </div>
        </div>
        <Icon name="back" size={18} />
      </Link>
      <p className="muted small-text" style={{ margin: '0 0 12px' }}>
        <Link to="/afinador">Afinador pelo microfone →</Link> · <Link to="/progresso">Meu progresso →</Link>
      </p>
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
