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
import { Fields } from './pages/Fields';
import { Reference } from './pages/Reference';
import { Backing } from './pages/Backing';
import { SongPage } from './pages/SongPage';
import { Dock } from './components/Dock';
import { PlayerProvider } from './lib/player';
import { useInstall, useOnline } from './lib/pwa';

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Braço', icon: 'fretboard', end: true },
  { to: '/estudos', label: 'Estudos', icon: 'book' },
  { to: '/exercicios', label: 'Exercícios', icon: 'target' },
  { to: '/acordes', label: 'Acordes', icon: 'chord' },
  { to: '/campos', label: 'Campos', icon: 'wheel' },
  { to: '/backing', label: 'Backing', icon: 'headphones' },
];

export default function App() {
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
          <nav className="topbar">
            <NavLink to="/" className="brand">
              <img className="logo" src={`${import.meta.env.BASE_URL}icons/logo-96.png`} alt="" width={30} height={30} />
              <span>
                Song<b>State</b>
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
            {!online && <span className="tag offline">Offline</span>}
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
            <Routes>
              <Route path="/" element={<Explorer />} />
              <Route path="/estudos" element={<Studies />} />
              <Route path="/estudos/:id" element={<StudyDetail />} />
              <Route path="/exercicios" element={<ExerciseList />} />
              <Route path="/exercicios/:id" element={<ExerciseRunner />} />
              <Route path="/acordes" element={<Chords />} />
              <Route path="/campos" element={<Fields />} />
              <Route path="/referencia" element={<Reference />} />
              <Route path="/backing" element={<Backing />} />
              <Route path="/backing/jam" element={<Backing jam />} />
              <Route path="/backing/buscar" element={<Backing search />} />
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
          <Dock />
          {open && <SettingsPanel onClose={() => setOpen(false)} />}
        </div>
      </HashRouter>
      </PlayerProvider>
    </SettingsContext.Provider>
  );
}
