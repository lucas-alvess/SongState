import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BackingPlayer, type PlayerState, type TransportEvent } from '../components/BackingPlayer';
import { TakeRecorder } from '../components/TakeRecorder';
import { Icon } from '../components/Icon';
import { Metronome } from '../components/Metronome';
import { SourcePlayer } from '../components/Players';
import { DEFAULT_BOARD, ScaleBoard, type BoardState } from '../components/ScaleBoard';
import { SongForm } from '../components/SongForm';
import { KeyPanel, type KeyCandidate } from '../components/KeyPanel';
import { Toggle } from '../components/ui';
import { chordHasMinorThird, parseChart } from '../lib/chords';
import { adviseKey, type ScaleAdvice } from '../lib/keyadvice';
import { analyzeKey } from '../lib/keyaudio';
import { detectKeyFromChart, type KeyResult } from '../lib/keyfind';
import { makeSlot, type StyleId } from '../lib/jam';
import { BUILTIN_SONGS } from '../lib/library';
import { mod12, pcLabel } from '../lib/music';
import type { Song } from '../lib/songs';
import { deleteLoopFiles, sanitizeLoops, type LoopMeta } from '../lib/loops';
import { delFile, getFile, useSettings, useStoredList } from '../lib/storage';
import { Chips } from '../components/ui';

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
  const [rawLoops, setLoops] = useStoredList<LoopMeta>('ss.loops');
  const [editing, setEditing] = useState(false);
  const [srcIdx, setSrcIdx] = useState(0);
  const [metro, setMetro] = useState(false);
  const [board, setBoardRaw] = useState<BoardState | null>(null);
  const [player, setPlayer] = useState<PlayerState>({ slot: null, shift: 0 });
  const [transport, setTransport] = useState<(TransportEvent & { n: number }) | null>(null);
  const transportN = useRef(0);
  const [audioKey, setAudioKey] = useState<KeyResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [audioMsg, setAudioMsg] = useState('');
  const [pick, setPick] = useState<{ keyPc: number; minor: boolean } | null>(null);
  const [focus, setFocus] = useState<{ rootPc: number; chordPcs?: number[]; id?: string } | null>(null);
  const boardRef = useRef<HTMLElement>(null);

  const chart = useMemo(() => parseChart(song.chart ?? '', settings.pref), [song.chart, settings.pref]);
  const slots = useMemo(() => chart.slots.map((s) => makeSlot(s.rootPc, s.bassPc, s.typeId, s.len, s.bar, s.label)), [chart]);

  const first = chart.slots[0];
  // tom: o que você salvou vale mais; senão o da análise do áudio, depois o da cifra, e por fim o primeiro acorde
  const detected = useMemo(() => detectKeyFromChart(chart.slots), [chart]);
  const fileSrc = song.sources.find((s) => s.kind === 'file' && s.fileId);
  const saved = song.keyPc !== null ? { keyPc: song.keyPc, minor: song.minor } : null;
  const auto = pick ?? saved ?? (audioKey ? audioKey.best : detected ? detected.best : first ? { keyPc: first.rootPc, minor: chordHasMinorThird(first.typeId) } : { keyPc: 0, minor: false });
  const source = pick ? 'escolhido' : saved ? 'salvo' : audioKey ? 'áudio' : detected ? 'cifra' : 'primeiro acorde';
  const keyPc = auto.keyPc;
  const minor = auto.minor;
  const result = source === 'áudio' ? audioKey : detected;
  const shiftedSlots = useMemo(() => chart.slots.map((s) => ({ ...s, rootPc: mod12(s.rootPc + player.shift), bassPc: mod12(s.bassPc + player.shift) })), [chart, player.shift]);
  const boardRoot = mod12(keyPc + player.shift);
  const advice = useMemo(() => adviseKey(boardRoot, minor, shiftedSlots), [boardRoot, minor, shiftedSlots]);
  const state: BoardState = { ...(board ?? { ...DEFAULT_BOARD, scaleId: advice.scales[0].scaleId, fretMax: 15 }), root: focus ? focus.rootPc : boardRoot };

  const candidates = useMemo(() => {
    const out: KeyCandidate[] = [];
    const add = (g: { keyPc: number; minor: boolean }, tag: string) => {
      if (!out.some((x) => x.keyPc === g.keyPc && x.minor === g.minor)) out.push({ keyPc: g.keyPc, minor: g.minor, tag });
    };
    if (saved) add(saved, 'salvo');
    if (audioKey) add(audioKey.best, 'áudio');
    if (detected) add(detected.best, 'cifra');
    for (const r of [audioKey, detected]) r?.alternatives.slice(0, 2).forEach((g) => add(g, 'possível'));
    add({ keyPc, minor }, 'atual');
    return out.slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.keyPc, song.minor, audioKey, detected, keyPc, minor]);

  const analyze = async () => {
    if (!fileSrc?.fileId) return;
    setAnalyzing(true);
    setAudioMsg('');
    try {
      const blob = await getFile(fileSrc.fileId);
      if (!blob) throw new Error('O arquivo de áudio não está neste aparelho.');
      const r = await analyzeKey(fileSrc.fileId, blob);
      setAudioKey(r);
      setPick(null);
      setAudioMsg('');
    } catch (e) {
      setAudioMsg(e instanceof Error ? e.message : 'Não foi possível analisar o áudio.');
    } finally {
      setAnalyzing(false);
    }
  };

  const onScale = (s: ScaleAdvice, chordPcs?: number[], id?: string) => {
    setBoardRaw({ ...state, scaleId: s.scaleId, pos: null, degrees: [] });
    setFocus(s.rootPc === boardRoot && !chordPcs ? null : { rootPc: s.rootPc, chordPcs, id });
    boardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };
  const src = song.sources[Math.min(srcIdx, song.sources.length - 1)];

  const remove = async () => {
    if (!confirm(`Excluir "${song.title}"?`)) return;
    await Promise.all(song.sources.filter((s) => s.kind === 'file').map((s) => delFile(s.fileId!).catch(() => {})));
    // as gravações feitas sobre esta música também saem (o áudio não pode ficar órfão ocupando espaço)
    const takes = sanitizeLoops(rawLoops).filter((l) => l.songId === song.id);
    await Promise.all(takes.map((t) => deleteLoopFiles(t)));
    if (takes.length) setLoops((l) => l.filter((x) => !takes.some((t) => t.id === x.id)));
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
            {source !== 'salvo' && source !== 'escolhido' && <span className="tag">detectado{source === 'áudio' ? ' pelo áudio' : source === 'cifra' ? ' pela cifra' : ''}</span>}
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
          onTransport={(e) => setTransport({ ...e, n: ++transportN.current })}
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

      {slots.length > 0 && <TakeRecorder songId={song.id} title={song.title} event={transport} />}

      <section className="panel player-panel">
        <div className="row between">
          <h3>Áudio</h3>
          <Link className="btn small" to={`/backing/buscar?q=${encodeURIComponent(`${song.title} ${song.artist}`.trim())}&song=${song.id}`}>
            <Icon name="plus" size={14} /> {src ? 'Buscar outro áudio' : 'Buscar áudio'}
          </Link>
        </div>
        {src ? (
          <>
            {song.sources.length > 1 && <Chips small value={Math.min(srcIdx, song.sources.length - 1)} onChange={setSrcIdx} options={song.sources.map((s, i) => ({ value: i, label: s.label }))} />}
            <SourcePlayer key={src.id} src={src} title={song.title} />
          </>
        ) : (
          <p className="muted">Procure a música no YouTube ou no Spotify e ouça aqui mesmo, com o braço e a cifra ao lado. Também dá para enviar um arquivo seu em “Editar”.</p>
        )}
      </section>

      <KeyPanel
        keyPc={keyPc}
        minor={minor}
        source={source}
        result={result}
        candidates={candidates}
        advice={advice}
        pref={chart.pref}
        lang={settings.lang}
        canSave={!song.builtin && (song.keyPc !== keyPc || song.minor !== minor)}
        onPick={(k, m) => {
          setPick({ keyPc: k, minor: m });
          setFocus(null);
        }}
        onSave={() => {
          setSongs((l) => l.map((x) => (x.id === song.id ? { ...x, keyPc, minor } : x)));
          setPick(null);
        }}
        audio={{ available: !!fileSrc, busy: analyzing, message: audioMsg, onAnalyze: analyze }}
        hasChart={slots.length > 0}
        hasStream={song.sources.some((s) => s.kind === 'youtube' || s.kind === 'spotify')}
        onScale={onScale}
        focusId={focus?.id ?? null}
      />

      <section ref={boardRef}>
        <h3 aria-level={2} className="section-title">Braço</h3>
        {focus && (
          <p className="small-text">
            Mostrando a escala escolhida{focus.chordPcs ? ' com o arpejo do acorde em destaque' : ''}.{' '}
            <button type="button" className="btn small" onClick={() => setFocus(null)}>
              Voltar à escala do tom
            </button>
          </p>
        )}
        <ScaleBoard state={state} setState={(p) => setBoardRaw({ ...state, ...p })} chordPcs={focus?.chordPcs ?? player.slot?.pcs} advanced={false} />
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
