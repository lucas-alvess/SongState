import { useCallback, useMemo, useState } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { DEFAULT_SETTINGS, SettingsContext, useLocalStorage, type Settings } from './lib/storage';
import { GlobalDefs, Icon, type IconName } from './components/Icon';
import { SettingsPanel } from './components/SettingsPanel';
import { Explorer } from './pages/Explorer';
import { Studies } from './pages/Studies';
import { StudyDetail } from './pages/StudyDetail';
import { ExerciseList } from './pages/ExerciseList';
import { ExerciseRunner } from './pages/ExerciseRunner';
import { Chords } from './pages/Chords';
import { Backing } from './pages/Backing';
import { SongPage } from './pages/SongPage';

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Braço', icon: 'fretboard', end: true },
  { to: '/estudos', label: 'Estudos', icon: 'book' },
  { to: '/exercicios', label: 'Exercícios', icon: 'target' },
  { to: '/acordes', label: 'Acordes', icon: 'chord' },
  { to: '/backing', label: 'Backing', icon: 'headphones' },
];

export default function App() {
  const [settings, setSettings] = useLocalStorage<Settings>('ss.settings', DEFAULT_SETTINGS);
  const [open, setOpen] = useState(false);
  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [setSettings]);
  const ctx = useMemo(() => ({ settings, update }), [settings, update]);

  return (
    <SettingsContext.Provider value={ctx}>
      <HashRouter>
        <GlobalDefs />
        <div className="app">
          <nav className="topbar">
            <NavLink to="/" className="brand">
              <span className="logo" />
              <span>
                Song<b>Station</b>
              </span>
            </NavLink>
            <div className="nav-links">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <Icon name={n.icon} size={18} />
                  {n.label}
                </NavLink>
              ))}
            </div>
            <button type="button" className="btn icon" onClick={() => setOpen(true)} aria-label="Configurações">
              <Icon name="sliders" size={18} />
            </button>
          </nav>
          <main className="content">
            <Routes>
              <Route path="/" element={<Explorer />} />
              <Route path="/estudos" element={<Studies />} />
              <Route path="/estudos/:id" element={<StudyDetail />} />
              <Route path="/exercicios" element={<ExerciseList />} />
              <Route path="/exercicios/:id" element={<ExerciseRunner />} />
              <Route path="/acordes" element={<Chords />} />
              <Route path="/backing" element={<Backing />} />
              <Route path="/backing/jam" element={<Backing jam />} />
              <Route path="/backing/:id" element={<SongPage />} />
            </Routes>
          </main>
          <nav className="tabbar">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
                <Icon name={n.icon} size={22} />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
          {open && <SettingsPanel onClose={() => setOpen(false)} />}
        </div>
      </HashRouter>
    </SettingsContext.Provider>
  );
}
