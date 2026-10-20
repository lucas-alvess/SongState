import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Metronome } from '../components/Metronome';
import { SourcePlayer } from '../components/Players';
import { DEFAULT_BOARD, ScaleBoard, type BoardState } from '../components/ScaleBoard';
import { SongForm } from '../components/SongForm';
import { Chips, Toggle } from '../components/ui';
import { scaleById } from '../lib/music';
import { suggestedScales, spotifySearch, youtubeSearch, type Song } from '../lib/songs';
import { delFile, useSettings, useStoredList } from '../lib/storage';
import { keyName } from './Backing';

export function SongPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { settings } = useSettings();
  const [songs, setSongs] = useStoredList<Song>('ss.songs');
  const song = songs.find((s) => s.id === id);
  const [editing, setEditing] = useState(false);
  const [srcIdx, setSrcIdx] = useState(0);
  const [metro, setMetro] = useState(false);
  const [board, setBoardRaw] = useState<BoardState | null>(null);

  if (!song) return <p>Música não encontrada. <Link to="/backing">Voltar</Link></p>;

  const suggestions = suggestedScales(song.minor);
  const state: BoardState = board ?? { ...DEFAULT_BOARD, root: song.keyPc ?? 0, scaleId: suggestions[0], fretMax: 15 };
  const src = song.sources[Math.min(srcIdx, song.sources.length - 1)];
  const q = `${song.title} ${song.artist}`.trim();

  const remove = async () => {
    if (!confirm(`Excluir "${song.title}"?`)) return;
    await Promise.all(song.sources.filter((s) => s.kind === 'file').map((s) => delFile(s.fileId!).catch(() => {})));
    setSongs((l) => l.filter((s) => s.id !== song.id));
    nav('/backing');
  };

  return (
    <>
      <Link to="/backing" className="back">← Backing tracks</Link>
      <header className="page-header">
        <div>
          <h1>{song.title}</h1>
          <p className="muted">{song.artist || 'Artista não informado'}</p>
          <div className="card-foot">
            {keyName(song, settings.pref, settings.lang) && <span className="tag key">Tom: {keyName(song, settings.pref, settings.lang)}</span>}
            {song.bpm && <span className="tag">♩ {song.bpm} BPM</span>}
            {song.tags.map((t) => <span key={t} className="tag">{t}</span>)}
          </div>
        </div>
        <div className="row gap">
          <button type="button" className="btn small" onClick={() => setEditing(true)}>Editar</button>
          <button type="button" className="btn small danger" onClick={remove}>Excluir</button>
        </div>
      </header>

      <section className="panel player-panel">
        {song.sources.length > 1 && (
          <Chips small value={Math.min(srcIdx, song.sources.length - 1)} onChange={setSrcIdx} options={song.sources.map((s, i) => ({ value: i, label: s.label }))} />
        )}
        {src ? (
          <SourcePlayer key={src.id} src={src} />
        ) : (
          <div>
            <p className="muted">Nenhuma fonte de áudio ainda. Procure uma base e cole o link em “Editar”.</p>
            <div className="row gap wrap">
              <a className="btn" href={youtubeSearch(`${q} backing track`)} target="_blank" rel="noreferrer">YouTube · backing track ↗</a>
              <a className="btn" href={spotifySearch(q)} target="_blank" rel="noreferrer">Spotify ↗</a>
            </div>
          </div>
        )}
        {src && (
          <div className="row gap wrap search-links">
            <a className="btn small" href={youtubeSearch(`${q} backing track`)} target="_blank" rel="noreferrer">Achar backing track ↗</a>
            {src.url && <a className="btn small" href={src.url} target="_blank" rel="noreferrer">Abrir original ↗</a>}
          </div>
        )}
      </section>

      <section>
        <h3 className="section-title">Escalas para esta música</h3>
        <Chips
          small
          value={state.scaleId}
          onChange={(scaleId) => setBoardRaw({ ...state, scaleId, pos: null, degrees: [] })}
          options={suggestions.map((id) => ({ value: id, label: scaleById(id).name }))}
        />
        <ScaleBoard state={state} setState={(p) => setBoardRaw({ ...state, ...p })} advanced={false} />
      </section>

      {song.notes && (
        <section className="panel">
          <h3>Anotações</h3>
          <p className="notes">{song.notes}</p>
        </section>
      )}

      <Toggle label="Metrônomo" checked={metro} onChange={setMetro} />
      {metro && <Metronome initialBpm={song.bpm ?? 80} />}

      {editing && (
        <SongForm
          initial={song}
          onClose={() => setEditing(false)}
          onSave={(s) => {
            setSongs((l) => l.map((x) => (x.id === s.id ? s : x)));
            setEditing(false);
          }}
        />
      )}
    </>
  );
}
