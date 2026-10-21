import { useMemo, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { JamPanel } from '../components/JamPanel';
import { SongForm } from '../components/SongForm';
import { Chips, PageHeader } from '../components/ui';
import { BUILTIN_SONGS } from '../lib/library';
import { pcLabel } from '../lib/music';
import { useSettings, useStoredList } from '../lib/storage';
import type { Song } from '../lib/songs';

export function Backing({ jam }: { jam?: boolean }) {
  return (
    <>
      <PageHeader eyebrow="Toque junto" title="Backing tracks" sub="Bases geradas aqui mesmo, a partir da cifra: bateria, baixo e acordes no tom e andamento que você escolher.">
        <div className="subtabs">
          <NavLink to="/backing" end className={({ isActive }) => `subtab${isActive ? ' active' : ''}`}>
            <Icon name="music" size={16} /> Músicas
          </NavLink>
          <NavLink to="/backing/jam" className={({ isActive }) => `subtab${isActive ? ' active' : ''}`}>
            <Icon name="sliders" size={16} /> Jam tracks
          </NavLink>
        </div>
      </PageHeader>
      {jam ? <JamPanel /> : <Library />}
    </>
  );
}

function SongCard({ s, pref, lang }: { s: Song; pref: 'sharp' | 'flat'; lang: 'letters' | 'latin' }) {
  const key = s.keyPc === null ? null : pcLabel(s.keyPc, pref, lang) + (s.minor ? 'm' : '');
  return (
    <Link to={`/backing/${s.id}`} className="card song-card">
      <div className="song-art">{(s.title[0] ?? '♪').toUpperCase()}</div>
      <div className="card-body">
        <h3>{s.title}</h3>
        <p className="muted">{s.artist || 'Artista não informado'}</p>
        <div className="card-foot">
          {key && <span className="tag key">{key}</span>}
          {s.bpm && <span className="tag">♩ {s.bpm}</span>}
          {s.chart && <span className="tag live">cifra</span>}
          {s.sources.length > 0 && <span className="tag">áudio</span>}
          {s.tags.slice(0, 2).map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function Library() {
  const { settings } = useSettings();
  const [songs, setSongs] = useStoredList<Song>('ss.songs');
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('todas');
  const importRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => [...songs].sort((a, b) => b.createdAt - a.createdAt), [songs]);
  const tags = useMemo(() => ['todas', ...new Set([...songs, ...BUILTIN_SONGS].flatMap((s) => s.tags))], [songs]);
  const match = (s: Song) => (tag === 'todas' || s.tags.includes(tag)) && `${s.title} ${s.artist}`.toLowerCase().includes(q.toLowerCase());
  const mine = all.filter(match);
  const examples = BUILTIN_SONGS.filter(match);

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
        <button type="button" className="btn primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> Adicionar música
        </button>
      </div>
      {tags.length > 1 && (
        <div style={{ margin: '12px 0' }}>
          <Chips small value={tag} onChange={setTag} options={tags.map((t) => ({ value: t, label: t }))} />
        </div>
      )}

      <h3 className="section-title">Minha biblioteca</h3>
      {songs.length === 0 ? (
        <div className="empty panel">
          <div className="empty-icon">
            <Icon name="headphones" size={34} />
          </div>
          <h3>Nenhuma música sua ainda</h3>
          <p className="muted">
            Digite a cifra de uma música e o site toca a base completa. Para começar agora, abra um dos exemplos abaixo ou use as <Link to="/backing/jam">Jam tracks</Link>.
          </p>
          <button type="button" className="btn primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} /> Adicionar primeira música
          </button>
        </div>
      ) : (
        <div className="card-grid">
          {mine.map((s) => (
            <SongCard key={s.id} s={s} pref={settings.pref} lang={settings.lang} />
          ))}
        </div>
      )}

      {examples.length > 0 && (
        <>
          <h3 className="section-title">Exemplos prontos</h3>
          <div className="card-grid">
            {examples.map((s) => (
              <SongCard key={s.id} s={s} pref={settings.pref} lang={settings.lang} />
            ))}
          </div>
        </>
      )}

      <div className="row gap wrap backup-row">
        <button type="button" className="btn small" onClick={exportJson} disabled={!songs.length}>
          Exportar lista (.json)
        </button>
        <button type="button" className="btn small" onClick={() => importRef.current?.click()}>
          Importar lista
        </button>
        <input ref={importRef} type="file" accept="application/json" hidden onChange={(e) => importJson(e.target.files?.[0])} />
        <span className="muted small-text">Use para levar sua lista a outro dispositivo (arquivos de áudio não são exportados).</span>
      </div>

      {adding && (
        <SongForm
          onClose={() => setAdding(false)}
          onSave={(s) => {
            setSongs((l) => [...l, s]);
            setAdding(false);
          }}
        />
      )}
    </>
  );
}
