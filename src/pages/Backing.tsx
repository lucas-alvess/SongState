import { useMemo, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { JamPanel } from '../components/JamPanel';
import { SongForm } from '../components/SongForm';
import { Chips, PageHeader } from '../components/ui';
import { pcLabel } from '../lib/music';
import { useSettings, useStoredList } from '../lib/storage';
import type { Song } from '../lib/songs';

export const keyName = (s: Song, pref: 'sharp' | 'flat', lang: 'letters' | 'latin') => (s.keyPc === null ? null : pcLabel(s.keyPc, pref, lang) + (s.minor ? 'm' : ''));

export function Backing({ jam }: { jam?: boolean }) {
  return (
    <>
      <PageHeader title="Backing tracks" sub="Toque junto com suas músicas ou com bases geradas em qualquer tom." />
      <div className="subtabs">
        <NavLink to="/backing" end className={({ isActive }) => `subtab${isActive ? ' active' : ''}`}>🎵 Minhas músicas</NavLink>
        <NavLink to="/backing/jam" className={({ isActive }) => `subtab${isActive ? ' active' : ''}`}>🥁 Jam tracks</NavLink>
      </div>
      {jam ? <JamPanel /> : <Library />}
    </>
  );
}

function Library() {
  const { settings } = useSettings();
  const [songs, setSongs] = useStoredList<Song>('ss.songs');
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('todas');
  const importRef = useRef<HTMLInputElement>(null);

  const tags = useMemo(() => ['todas', ...new Set(songs.flatMap((s) => s.tags))], [songs]);
  const list = songs
    .filter((s) => (tag === 'todas' || s.tags.includes(tag)) && `${s.title} ${s.artist}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.createdAt - a.createdAt);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(songs.map((s) => ({ ...s, sources: s.sources.filter((x) => x.kind !== 'file') })), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'songstation-musicas.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Song[];
      if (!Array.isArray(data)) throw new Error();
      setSongs((cur) => [...cur, ...data.filter((d) => d.id && d.title && !cur.some((c) => c.id === d.id))]);
    } catch {
      alert('Arquivo inválido.');
    }
  };

  return (
    <>
      <div className="row gap wrap lib-toolbar">
        <input className="search" placeholder="Buscar música ou artista…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn primary" onClick={() => setAdding(true)}>+ Adicionar música</button>
      </div>
      {tags.length > 1 && <div style={{ margin: '10px 0' }}><Chips small value={tag} onChange={setTag} options={tags.map((t) => ({ value: t, label: t }))} /></div>}

      {songs.length === 0 ? (
        <div className="empty panel">
          <div className="empty-icon">🎧</div>
          <h3>Sua biblioteca está vazia</h3>
          <p className="muted">Adicione uma música com link do Spotify/YouTube (ou um arquivo de áudio seu), informe o tom e estude com o braço já ajustado. Para começar agora, use as <Link to="/backing/jam">Jam tracks</Link>.</p>
          <button type="button" className="btn primary" onClick={() => setAdding(true)}>+ Adicionar primeira música</button>
        </div>
      ) : (
        <div className="card-grid">
          {list.map((s) => (
            <Link key={s.id} to={`/backing/${s.id}`} className="card song-card">
              <div className="song-art">{(s.title[0] ?? '♪').toUpperCase()}</div>
              <div className="card-body">
                <h3>{s.title}</h3>
                <p className="muted">{s.artist || 'Artista não informado'}</p>
                <div className="card-foot">
                  {keyName(s, settings.pref, settings.lang) && <span className="tag key">{keyName(s, settings.pref, settings.lang)}</span>}
                  {s.bpm && <span className="tag">♩ {s.bpm}</span>}
                  {s.sources.map((x) => <span key={x.id} className="tag" title={x.label}>{x.kind === 'spotify' ? '🟢' : x.kind === 'youtube' ? '🔴' : x.kind === 'file' ? '🎵' : '🔗'}</span>)}
                  {s.tags.slice(0, 2).map((t) => <span key={t} className="tag">{t}</span>)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="row gap wrap backup-row">
        <button type="button" className="btn small" onClick={exportJson} disabled={!songs.length}>Exportar lista (.json)</button>
        <button type="button" className="btn small" onClick={() => importRef.current?.click()}>Importar lista</button>
        <input ref={importRef} type="file" accept="application/json" hidden onChange={(e) => importJson(e.target.files?.[0])} />
        <span className="muted small-text">Use para levar sua lista a outro dispositivo (arquivos de áudio não são exportados).</span>
      </div>

      {adding && <SongForm onClose={() => setAdding(false)} onSave={(s) => { setSongs((l) => [...l, s]); setAdding(false); }} />}
    </>
  );
}
