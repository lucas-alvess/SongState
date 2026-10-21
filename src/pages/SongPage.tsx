import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BackingPlayer, type PlayerState } from '../components/BackingPlayer';
import { Icon } from '../components/Icon';
import { Metronome } from '../components/Metronome';
import { SourcePlayer } from '../components/Players';
import { DEFAULT_BOARD, ScaleBoard, type BoardState } from '../components/ScaleBoard';
import { SongForm } from '../components/SongForm';
import { Chips, Toggle } from '../components/ui';
import { chordHasMinorThird, parseChart } from '../lib/chords';
import { makeSlot, type StyleId } from '../lib/jam';
import { BUILTIN_SONGS } from '../lib/library';
import { mod12, pcLabel, scaleById } from '../lib/music';
import { suggestedScales, type Song } from '../lib/songs';
import { delFile, useSettings, useStoredList } from '../lib/storage';

export function SongPage() {
  const { id = '' } = useParams();
  const [songs] = useStoredList<Song>('ss.songs');
  const song = BUILTIN_SONGS.find((s) => s.id === id) ?? songs.find((s) => s.id === id);
  if (!song) {
    return (
      <p>
        Música não encontrada. <Link to="/backing">Voltar</Link>
      </p>
    );
  }
  return <SongView key={song.id} song={song} />;
}

function SongView({ song }: { song: Song }) {
  const nav = useNavigate();
  const { settings } = useSettings();
  const [, setSongs] = useStoredList<Song>('ss.songs');
  const [editing, setEditing] = useState(false);
  const [srcIdx, setSrcIdx] = useState(0);
  const [metro, setMetro] = useState(false);
  const [board, setBoardRaw] = useState<BoardState | null>(null);
  const [player, setPlayer] = useState<PlayerState>({ slot: null, shift: 0 });

  const chart = useMemo(() => parseChart(song.chart ?? '', settings.pref), [song.chart, settings.pref]);
  const slots = useMemo(() => chart.slots.map((s) => makeSlot(s.rootPc, s.bassPc, s.typeId, s.len, s.bar, s.label)), [chart]);

  const first = chart.slots[0];
  const keyPc = song.keyPc ?? first?.rootPc ?? 0;
  const minor = song.keyPc !== null ? song.minor : first ? chordHasMinorThird(first.typeId) : false;
  const suggestions = suggestedScales(minor);
  const boardRoot = mod12(keyPc + player.shift);
  const state: BoardState = { ...(board ?? { ...DEFAULT_BOARD, scaleId: suggestions[0], fretMax: 15 }), root: boardRoot };
  const src = song.sources[Math.min(srcIdx, song.sources.length - 1)];

  const remove = async () => {
    if (!confirm(`Excluir "${song.title}"?`)) return;
    await Promise.all(song.sources.filter((s) => s.kind === 'file').map((s) => delFile(s.fileId!).catch(() => {})));
    setSongs((l) => l.filter((s) => s.id !== song.id));
    nav('/backing');
  };

  return (
    <>
      <Link to="/backing" className="back">
        <Icon name="back" size={16} /> Backing tracks
      </Link>
      <header className="page-header">
        <div>
          <span className="eyebrow">{song.builtin ? 'Exemplo' : 'Minha música'}</span>
          <h1>{song.title}</h1>
          <p className="muted">{song.artist || 'Artista não informado'}</p>
          <div className="card-foot">
            <span className="tag key">
              Tom: {pcLabel(keyPc, settings.pref, settings.lang)}
              {minor ? 'm' : ''}
            </span>
            {song.bpm && <span className="tag">♩ {song.bpm} BPM</span>}
            {song.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="row gap">
          <button type="button" className="btn small" onClick={() => setEditing(true)}>
            <Icon name={song.builtin ? 'plus' : 'edit'} size={15} /> {song.builtin ? 'Copiar para editar' : 'Editar'}
          </button>
          {!song.builtin && (
            <button type="button" className="btn small danger" onClick={remove}>
              <Icon name="trash" size={15} /> Excluir
            </button>
          )}
        </div>
      </header>

      {slots.length > 0 ? (
        <BackingPlayer
          slots={slots}
          defaultBpm={song.bpm ?? 90}
          defaultStyle={(song.style as StyleId) ?? 'rock'}
          keyPc={keyPc}
          minor={minor}
          pref={chart.pref}
          resetKey={song.id}
          onState={setPlayer}
        />
      ) : (
        <div className="panel empty">
          <div className="empty-icon">
            <Icon name="music" size={34} />
          </div>
          <h3>Esta música ainda não tem cifra</h3>
          <p className="muted">Digite os acordes e o site toca uma base completa (bateria, baixo e harmonia) dentro da página, no tom e velocidade que você quiser.</p>
          <button type="button" className="btn primary" onClick={() => setEditing(true)}>
            Adicionar cifra
          </button>
        </div>
      )}

      {song.sources.length > 0 && src && (
        <section className="panel player-panel">
          <h3>Áudio</h3>
          {song.sources.length > 1 && <Chips small value={Math.min(srcIdx, song.sources.length - 1)} onChange={setSrcIdx} options={song.sources.map((s, i) => ({ value: i, label: s.label }))} />}
          <SourcePlayer key={src.id} src={src} />
        </section>
      )}

      <section>
        <h3 className="section-title">Escalas para esta música</h3>
        <Chips small value={state.scaleId} onChange={(scaleId) => setBoardRaw({ ...state, scaleId, pos: null, degrees: [] })} options={suggestions.map((id) => ({ value: id, label: scaleById(id).name }))} />
        <ScaleBoard state={state} setState={(p) => setBoardRaw({ ...state, ...p })} chordPcs={player.slot?.pcs} advanced={false} />
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
            setSongs((l) => (song.builtin ? [...l, s] : l.map((x) => (x.id === s.id ? s : x))));
            setEditing(false);
            if (song.builtin) nav(`/backing/${s.id}`);
          }}
        />
      )}
    </>
  );
}
