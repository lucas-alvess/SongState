import { useCallback, useMemo, useState } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { DEFAULT_SETTINGS, SettingsContext, useLocalStorage, type Settings } from './lib/storage';
import { SettingsPanel } from './components/SettingsPanel';
import { Explorer } from './pages/Explorer';
import { ExerciseList } from './pages/ExerciseList';
import { ExerciseRunner } from './pages/ExerciseRunner';
import { StudyDetail } from './pages/StudyDetail';
import { Backing } from './pages/Backing';
import { SongPage } from './pages/SongPage';

const NAV = [
  { to: '/', label: 'Braço', icon: '🎸', end: true },
  { to: '/exercicios', label: 'Exercícios', icon: '🎯', end: false },
  { to: '/backing', label: 'Backing', icon: '🎧', end: false },
];

export default function App() {
  const [settings, setSettings] = useLocalStorage<Settings>('ss.settings', DEFAULT_SETTINGS);
  const [open, setOpen] = useState(false);
  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [setSettings]);
  const ctx = useMemo(() => ({ settings, update }), [settings, update]);

  return (
    <SettingsContext.Provider value={ctx}>
      <HashRouter>
        <div className="app">
          <nav className="topbar">
            <NavLink to="/" className="brand">
              <span className="logo" />
              <span>Song<b>Station</b></span>
            </NavLink>
            <div className="nav-links">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <span className="nav-icon">{n.icon}</span>
                  {n.label}
                </NavLink>
              ))}
            </div>
            <button type="button" className="btn icon" onClick={() => setOpen(true)} aria-label="Configurações">
              ⚙
            </button>
          </nav>
          <main className="content">
            <Routes>
              <Route path="/" element={<Explorer />} />
              <Route path="/exercicios" element={<ExerciseList />} />
              <Route path="/exercicios/:id" element={<ExerciseRunner />} />
              <Route path="/estudos/:id" element={<StudyDetail />} />
              <Route path="/backing" element={<Backing />} />
              <Route path="/backing/jam" element={<Backing jam />} />
              <Route path="/backing/:id" element={<SongPage />} />
            </Routes>
          </main>
          <nav className="tabbar">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
                <span className="nav-icon">{n.icon}</span>
                <span>{n.label}</span>
              </NavLink>
            ))}
            <button type="button" className="tab" onClick={() => setOpen(true)}>
              <span className="nav-icon">⚙</span>
              <span>Ajustes</span>
            </button>
          </nav>
          {open && <SettingsPanel onClose={() => setOpen(false)} />}
        </div>
      </HashRouter>
    </SettingsContext.Provider>
  );
}
