import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChartTable, ColumnChart, HBars, Heatmap, LineChart, type Col, type HeatCell, type HRow, type Pt } from '../components/charts';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/ui';
import { SECTION_LABEL } from '../lib/activity';
import { EXERCISES } from '../lib/exercises';
import { dayKey, streak, weakest } from '../lib/srs';
import { DEFAULT_GOAL, GOAL_LIMITS, bestStreak, calendar, fmtMinutes, goalProgress, kindBreakdown, level, normalizeGoal, studied, sumCells, timeBySection, weekCells, weeklyTrend, type Goal } from '../lib/stats';
import { useDays, useLocalStorage, useSettings, useSrs } from '../lib/storage';
import { KIND_TITLE, buildCard, type Ctx } from '../lib/training';

const WEEKDAY = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const dateLong = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
const dateShort = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const monthShort = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

const kindLabel = (k: string) => (k in KIND_TITLE ? KIND_TITLE[k as keyof typeof KIND_TITLE] : (EXERCISES.find((e) => e.id === k)?.title ?? k));
const dayTip = (ts: number, minutes: number, answers: number) => (minutes <= 0 && !answers ? `${dateLong(ts)}: sem estudo` : `${dateLong(ts)}: ${fmtMinutes(minutes)} · ${answers} ${answers === 1 ? 'resposta' : 'respostas'}`);

export function Progress() {
  const { settings } = useSettings();
  const ctx = useMemo<Ctx>(() => ({ tuningId: settings.tuningId, pref: settings.pref, lang: settings.lang }), [settings.tuningId, settings.pref, settings.lang]);
  const [days] = useDays();
  const [srs] = useSrs();
  const [goalRaw, setGoalRaw] = useLocalStorage<Goal>('ss.goal', DEFAULT_GOAL);
  const goal = useMemo(() => normalizeGoal(goalRaw), [goalRaw]);
  const [draft, setDraft] = useState<string | null>(null);

  const now = Date.now();
  const week = weekCells(days, now);
  const wt = sumCells(week);
  const gp = goalProgress(days, now, goal);
  const today = days[dayKey(now)];
  const run = streak(days, now);
  const best = bestStreak(days);
  const trend = weeklyTrend(days, now, 8);
  const cal = calendar(days, now, 12);
  const kinds = kindBreakdown(days, now, 30);
  const where = timeBySection(days, now, 30);
  const month = sumCells(cal.flat().filter((c) => !c.future).slice(-30));
  const accMonth = month.answers ? Math.round((month.correct / month.answers) * 100) : null;
  const weak = weakest(srs, 5)
    .map((w) => ({ w, card: buildCard(w.id, ctx) }))
    .filter((x) => !!x.card);
  const hasAny = Object.keys(days).length > 0;

  const cols: Col[] = week.map((c, i) => ({ label: WEEKDAY[i], value: c.minutes, tip: dayTip(c.ts, c.minutes, c.stat.n), accent: c.today, muted: c.future }));
  const points: Pt[] = trend.map((w) => ({ label: dateShort(w.start), value: w.pct, tip: w.pct === null ? `Semana de ${dateLong(w.start)}: sem respostas` : `Semana de ${dateLong(w.start)}: ${w.pct}% de acerto (${w.correct} de ${w.answers})` }));
  const heat: HeatCell[][] = cal.map((col) => col.map((c) => ({ level: level(c.stat), tip: dayTip(c.ts, c.minutes, c.stat.n), future: c.future, today: c.today })));
  const monthLabels = cal.map((col, w) => (w === 0 || new Date(col[0].ts).getMonth() !== new Date(cal[w - 1][0].ts).getMonth() ? monthShort(col[0].ts) : ''));

  const kindRows: HRow[] = kinds.map((k) => ({ label: kindLabel(k.kind), value: k.pct, text: `${k.pct}%`, sub: `${k.correct} certas em ${k.answers}` }));
  const maxWhere = Math.max(1, ...where.map((r) => r.minutes));
  const whereRows: HRow[] = where.map((r) => ({ label: SECTION_LABEL[r.section as keyof typeof SECTION_LABEL] ?? r.section, value: (r.minutes / maxWhere) * 100, text: fmtMinutes(r.minutes) }));

  const unitWord = goal.unit === 'min' ? 'min' : 'respostas';
  const commitDraft = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (draft.trim() !== '' && isFinite(n)) setGoalRaw(normalizeGoal({ unit: goal.unit, weekly: n }));
    setDraft(null);
  };

  return (
    <>
      <PageHeader eyebrow="Seu estudo" title="Progresso" sub="Tempo de estudo, dias seguidos e acertos. O tempo só conta enquanto você está usando o site (aba aberta e com interação)." />

      <section className="panel train-stats" aria-label="Resumo">
        <div>
          <b>{run}</b>
          <span>{run === 1 ? 'dia seguido' : 'dias seguidos'}</span>
        </div>
        <div>
          <b>{best}</b>
          <span>melhor sequência</span>
        </div>
        <div>
          <b>{fmtMinutes(wt.minutes)}</b>
          <span>nesta semana</span>
        </div>
        <div>
          <b>{accMonth === null ? '–' : `${accMonth}%`}</b>
          <span>acerto em 30 dias</span>
        </div>
      </section>

      {!hasAny && (
        <p className="notice">
          Ainda não há dados. Faça o <Link to="/treino">Treino de hoje</Link> ou um exercício e o seu progresso aparece aqui.
        </p>
      )}

      <section className="panel">
        <h3 aria-level={2} className="section-title">Meta da semana</h3>
        <p style={{ margin: '0 0 6px' }}>
          <b>
            {gp.value} de {gp.target} {unitWord}
          </b>{' '}
          <span className={gp.done ? 'ok-text' : 'muted'}>{gp.done ? '· meta batida!' : `· faltam ${gp.remaining} ${unitWord}`}</span>
        </p>
        <div className="meter" role="progressbar" aria-label="Meta semanal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={gp.pct}>
          <span style={{ width: `${gp.pct}%` }} />
        </div>
        <div className="goal-row">
          <div className="chips small" role="group" aria-label="Unidade da meta">
            {(['min', 'answers'] as const).map((u) => (
              <button key={u} type="button" className={`chip${goal.unit === u ? ' active' : ''}`} aria-pressed={goal.unit === u} onClick={() => setGoalRaw(normalizeGoal({ unit: u, weekly: u === 'min' ? DEFAULT_GOAL.weekly : 100 }))}>
                {u === 'min' ? 'Minutos' : 'Respostas'}
              </button>
            ))}
          </div>
          <label className="inline">
            Meta por semana
            <input
              type="number"
              inputMode="numeric"
              min={GOAL_LIMITS[goal.unit].min}
              max={GOAL_LIMITS[goal.unit].max}
              value={draft ?? goal.weekly}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => e.key === 'Enter' && commitDraft()}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <h3 aria-level={2} className="section-title">Esta semana</h3>
        <p className="muted small-text" style={{ marginTop: 0 }}>
          Minutos de estudo por dia (segunda a domingo). Hoje: {today ? `${fmtMinutes((today.ms ?? 0) / 60000)} · ${today.n} respostas` : 'ainda sem estudo'}.
        </p>
        <ColumnChart cols={cols} unit="min" label={`Minutos de estudo por dia nesta semana: ${week.map((c, i) => `${WEEKDAY[i]} ${Math.round(c.minutes)}`).join(', ')}`} />
        <ChartTable caption="Minutos de estudo por dia nesta semana" head={['Dia', 'Tempo', 'Respostas', 'Acertos']} rows={week.map((c) => [dateLong(c.ts), fmtMinutes(c.minutes), c.stat.n, c.stat.ok])} />
      </section>

      <section className="panel">
        <h3 aria-level={2} className="section-title">Últimas 12 semanas</h3>
        <p className="muted small-text" style={{ marginTop: 0 }}>
          Cada quadrado é um dia; quanto mais claro, mais você estudou. Dias com estudo: {sumCells(cal.flat().filter((c) => !c.future)).days}.
        </p>
        <Heatmap weeks={heat} monthLabels={monthLabels} label={`Calendário de atividade das últimas 12 semanas. ${cal.flat().filter((c) => studied(c.stat)).length} dias com estudo.`} />
        <ChartTable
          caption="Dias com estudo nas últimas 12 semanas"
          head={['Dia', 'Tempo', 'Respostas']}
          rows={cal
            .flat()
            .filter((c) => !c.future && studied(c.stat))
            .reverse()
            .map((c) => [dateLong(c.ts), fmtMinutes(c.minutes), c.stat.n])}
        />
      </section>

      <section className="panel">
        <h3 aria-level={2} className="section-title">Acerto semana a semana</h3>
        <p className="muted small-text" style={{ marginTop: 0 }}>
          Porcentagem de respostas certas nos exercícios e no Treino. Semanas sem respostas ficam em branco.
        </p>
        <LineChart points={points} label={`Taxa de acerto nas últimas 8 semanas: ${trend.map((w) => (w.pct === null ? 'sem dados' : `${w.pct}%`)).join(', ')}`} />
        <ChartTable caption="Taxa de acerto por semana" head={['Semana de', 'Respostas', 'Acertos', 'Acerto']} rows={trend.map((w) => [dateLong(w.start), w.answers, w.correct, w.pct === null ? '–' : `${w.pct}%`])} />
      </section>

      {kindRows.length > 0 && (
        <section className="panel">
          <h3 aria-level={2} className="section-title">Acerto por assunto (30 dias)</h3>
          <p className="muted small-text" style={{ marginTop: 0 }}>
            Do que mais precisa de treino para o que você já domina.
          </p>
          <HBars rows={kindRows} />
        </section>
      )}

      {whereRows.length > 0 && (
        <section className="panel">
          <h3 aria-level={2} className="section-title">Onde você estuda (30 dias)</h3>
          <HBars rows={whereRows} />
        </section>
      )}

      {weak.length > 0 && (
        <section className="panel">
          <h3 aria-level={2} className="section-title">Pontos fracos</h3>
          <ul className="weak-list">
            {weak.map(({ w, card }) => (
              <li key={w.id}>
                <span className="tag">{KIND_TITLE[card!.kind]}</span> {card!.prompt}
                {card!.sub ? ` — ${card!.sub}` : ''}
                <span className="muted small-text">
                  {' '}
                  · errou {w.lapses} de {w.seen}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/treino" className="btn primary small">
            <Icon name="target" size={15} /> Treinar agora
          </Link>
        </section>
      )}
    </>
  );
}
