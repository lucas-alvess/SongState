import { useCallback, useMemo, useState } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { DEFAULT_SETTINGS, SettingsContext, useLocalStorage, type Settings } from './lib/storage';
import { GlobalDefs, Icon, type IconName } from './components/Icon';
import { SettingsPanel } from './components/SettingsPanel';
import { Explorer } from './pages/Explorer';
import { Studies } from './pages/Studies';
import { StudyDetail } from './pages/StudyDetail';
import { ExerciseList } from './pages/ExerciseList';
import { ExerciseRunner } from './pages/ExerciseRunner';
import { Chords } from './pages/Chords';
import { Fields } from './pages/Fields';
import { Reference } from './pages/Reference';
import { Data } from './pages/Data';
import { Train } from './pages/Train';
import { Progress } from './pages/Progress';
import { SafeRoutes } from './components/ErrorBoundary';
import { Backing } from './pages/Backing';
import { SongPage } from './pages/SongPage';
import { Dock } from './components/Dock';
import { PlayerProvider } from './lib/player';
import { useInstall, useOnline } from './lib/pwa';
import { useActivityTracker } from './lib/activity';
import { dayKey, streak } from './lib/srs';
import { DEFAULT_GOAL, goalProgress, normalizeGoal, studied } from './lib/stats';
import { useDays } from './lib/storage';

const NAV: { to: string; label: string; icon: IconName; end?: boolean; also?: string[] }[] = [
  { to: '/', label: 'Braço', icon: 'fretboard', end: true },
  { to: '/estudos', label: 'Estudos', icon: 'book' },
  { to: '/exercicios', label: 'Exercícios', icon: 'target', also: ['/treino'] },
  { to: '/acordes', label: 'Acordes', icon: 'chord' },
  { to: '/campos', label: 'Campos', icon: 'wheel' },
  { to: '/backing', label: 'Backing', icon: 'headphones' },
];

/** Item do menu; `also` marca como ativo outras rotas da mesma seção (ex.: /treino dentro de Exercícios). */
function NavItem({ item, base }: { item: (typeof NAV)[number]; base: 'nav-link' | 'tab' }) {
  const { pathname } = useLocation();
  const extra = (item.also ?? []).some((p) => pathname === p || pathname.startsWith(p + '/'));
  return (
    <NavLink to={item.to} end={item.end} className={({ isActive }) => `${base}${isActive || extra ? ' active' : ''}`}>
      <Icon name={item.icon} size={base === 'tab' ? 22 : 18} />
      {base === 'tab' ? <span>{item.label}</span> : item.label}
    </NavLink>
  );
}

/** Atalho para o Progresso: mostra a sequência de dias; tracejado = hoje ainda sem estudo (lembrete). */
function StreakChip() {
  const [days] = useDays();
  const [goalRaw] = useLocalStorage('ss.goal', DEFAULT_GOAL);
  const now = Date.now();
  const run = streak(days, now);
  const doneToday = !!days[dayKey(now)] && studied(days[dayKey(now)]);
  const gp = goalProgress(days, now, normalizeGoal(goalRaw));
  const text = run > 0 ? `Sequência de ${run} ${run === 1 ? 'dia' : 'dias'}${doneToday ? '' : ', hoje ainda sem estudo'}. Meta da semana: ${gp.pct}%.` : `Progresso. Meta da semana: ${gp.pct}%.`;
  return (
    <NavLink to="/progresso" className={`streak-chip${run > 0 && !doneToday ? ' pending' : ''}`} aria-label={text} title={text}>
      {run > 0 ? <>🔥 {run}</> : <Icon name="chart" size={16} />}
    </NavLink>
  );
}

export default function App() {
  useActivityTracker();
  const [settings, setSettings] = useLocalStorage<Settings>('ss.settings', DEFAULT_SETTINGS);
  const [open, setOpen] = useState(false);
  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [setSettings]);
  const ctx = useMemo(() => ({ settings, update }), [settings, update]);
  const { canPrompt, install } = useInstall();
  const online = useOnline();

  return (
    <SettingsContext.Provider value={ctx}>
      <PlayerProvider>
      <HashRouter>
        <GlobalDefs />
        <div className="app">
          <nav className="topbar" aria-label="Principal">
            <NavLink to="/" className="brand">
              <img className="logo" src={`${import.meta.env.BASE_URL}icons/logo-96.png`} alt="" width={30} height={30} />
              <span>
                Song<b>State</b>
              </span>
            </NavLink>
            <div className="nav-links">
              {NAV.map((n) => (
                <NavItem key={n.to} item={n} base="nav-link" />
              ))}
            </div>
            {!online && <span className="tag offline">Offline</span>}
            <StreakChip />
            {canPrompt && (
              <button type="button" className="btn small primary install-btn" onClick={install}>
                <Icon name="upload" size={15} /> Instalar app
              </button>
            )}
            <button type="button" className="btn icon" onClick={() => setOpen(true)} aria-label="Configurações">
              <Icon name="sliders" size={18} />
            </button>
          </nav>
          <main className="content">
            <SafeRoutes>
            <Routes>
              <Route path="/" element={<Explorer />} />
              <Route path="/estudos" element={<Studies />} />
              <Route path="/estudos/:id" element={<StudyDetail />} />
              <Route path="/exercicios" element={<ExerciseList />} />
              <Route path="/exercicios/:id" element={<ExerciseRunner />} />
              <Route path="/treino" element={<Train />} />
              <Route path="/progresso" element={<Progress />} />
              <Route path="/acordes" element={<Chords />} />
              <Route path="/campos" element={<Fields />} />
              <Route path="/referencia" element={<Reference />} />
              <Route path="/dados" element={<Data />} />
              <Route path="/backing" element={<Backing />} />
              <Route path="/backing/jam" element={<Backing jam />} />
              <Route path="/backing/buscar" element={<Backing search />} />
              <Route path="/backing/:id" element={<SongPage />} />
            </Routes>
            </SafeRoutes>
          </main>
          <nav className="tabbar" aria-label="Navegação inferior">
            {NAV.map((n) => (
              <NavItem key={n.to} item={n} base="tab" />
            ))}
          </nav>
          <Dock />
          {open && <SettingsPanel onClose={() => setOpen(false)} />}
        </div>
      </HashRouter>
      </PlayerProvider>
    </SettingsContext.Provider>
  );
}
