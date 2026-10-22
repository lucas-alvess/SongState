/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { spotifyParts, usePlayer, type Track } from '../lib/player';
import { getSpotifyPlayer, isMobileBrowser, startSpotifyPlayback, useSpotifyConnected, type SpotifyHandle } from '../lib/spotify';
import { loadYouTubeApi } from '../lib/youtube';
import { useLocalStorage } from '../lib/storage';
import { EMPTY_LOOP, clearLoop, engage, loopValid, pauseLoop, setPoint, tick, toggleExit, type LoopState } from '../lib/looprange';

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

interface ShellProps {
  track: Track;
  title: string;
  artist?: string;
  playing: boolean;
  pos: number;
  dur: number;
  error: string | null;
  min: boolean;
  onMin: () => void;
  onClose: () => void;
  onToggle: () => void;
  onSeek: (sec: number) => void;
  onVolume: (v: number) => void;
  rate?: number;
  onRate?: (r: number) => void;
  video?: ReactNode;
  note?: string;
}

function Shell(p: ShellProps) {
  const [loop, setLoop] = useState<LoopState>(EMPTY_LOOP);
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const [vol, setVol] = useState(0.8);
  const valid = loopValid(loop);

  const apply = (next: LoopState) => {
    loopRef.current = next;
    setLoop(next);
  };

  // a cada atualização da posição: volta ao A ao passar do B (ou segue adiante, se foi pedido)
  useEffect(() => {
    const r = tick(loopRef.current, p.pos);
    if (r.state !== loopRef.current) apply(r.state);
    if (r.seekTo !== null) p.onSeek(r.seekTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.pos]);
  useEffect(() => apply(EMPTY_LOOP), [p.track.id, p.track.uri]);

  const turnOn = (jump: boolean) => {
    const r = engage(loop, p.pos, jump);
    apply(r.state);
    if (r.seekTo !== null) p.onSeek(r.seekTo);
  };
  const restart = () => {
    const r = engage(loop, p.pos, true);
    apply(r.state);
    if (r.seekTo !== null) p.onSeek(r.seekTo);
    if (!p.playing) p.onToggle();
  };
  const status =
    loop.a !== null && loop.b !== null && !valid
      ? 'O ponto B precisa vir depois do A.'
      : loop.mode === 'on'
        ? loop.exitAtB
          ? `Vai seguir adiante ao chegar no B (${fmt(loop.b as number)}).`
          : `Repetindo de ${fmt(loop.a as number)} a ${fmt(loop.b as number)}.`
        : loop.mode === 'paused'
          ? `Loop pausado (${fmt(loop.a as number)}–${fmt(loop.b as number)}): a música segue normalmente.`
          : '';

  return (
    <div className="dock-body">
      <div className="dock-media">{p.video}</div>
      <div className="dock-info">
        <div className="dock-head">
          <div className="dock-title">
            <span className={`dock-prov ${p.track.provider}`}>{p.track.provider === 'youtube' ? 'YouTube' : 'Spotify'}</span>
            <b title={p.title}>{p.title}</b>
            {p.artist && <small>{p.artist}</small>}
          </div>
          <div className="dock-win">
            <button type="button" className="btn small icon" onClick={p.onMin} aria-label={p.min ? 'Expandir' : 'Minimizar'}>
              <Icon name={p.min ? 'arrow' : 'back'} size={14} />
            </button>
            <button type="button" className="btn small icon" onClick={p.onClose} aria-label="Fechar">
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>

        {p.error && <div className="dock-error">{p.error}</div>}

        <div className="dock-seek">
          <button type="button" className="btn primary icon" onClick={p.onToggle} aria-label={p.playing ? 'Pausar' : 'Tocar'}>
            <Icon name={p.playing ? 'stop' : 'play'} size={16} />
          </button>
          <span className="dock-time">{fmt(p.pos)}</span>
          <input type="range" min={0} max={Math.max(1, Math.floor(p.dur))} step={1} value={Math.min(Math.floor(p.pos), Math.floor(p.dur) || 0)} onChange={(e) => p.onSeek(+e.target.value)} aria-label="Posição" />
          <span className="dock-time">{fmt(p.dur)}</span>
        </div>

        <div className="dock-tools">
          <div className="dock-group">
            <span className="muted small-text">Loop</span>
            <button type="button" className="btn small" onClick={() => apply(setPoint(loop, 'a', p.pos))} aria-label={`A ${loop.a === null ? 'sem ponto' : fmt(loop.a)}: marcar o início do loop na posição atual`}>
              A {loop.a === null ? '–' : fmt(loop.a)}
            </button>
            <button type="button" className="btn small" onClick={() => apply(setPoint(loop, 'b', p.pos))} aria-label={`B ${loop.b === null ? 'sem ponto' : fmt(loop.b)}: marcar o fim do loop na posição atual`}>
              B {loop.b === null ? '–' : fmt(loop.b)}
            </button>
            {loop.mode === 'on' ? (
              <button type="button" className="btn small primary" onClick={() => apply(pauseLoop(loop))} title="Para de repetir; a música segue e os pontos A–B ficam guardados">
                Pausar loop
              </button>
            ) : (
              <button type="button" className="btn small primary" disabled={!valid} onClick={() => turnOn(loop.mode !== 'paused')} title={valid ? undefined : 'Marque A e B (com B depois de A)'}>
                {loop.mode === 'paused' ? 'Retomar loop' : 'Ligar loop'}
              </button>
            )}
            <button type="button" className="btn small" disabled={!valid} onClick={restart} title="Volta ao ponto A e toca de novo, repetindo">
              Reiniciar
            </button>
            {loop.mode === 'on' && (
              <button type="button" className={`btn small${loop.exitAtB ? ' active' : ''}`} aria-pressed={loop.exitAtB} onClick={() => apply(toggleExit(loop))} title="Termina este ciclo e deixa a música continuar depois do B">
                Seguir após o B
              </button>
            )}
            {(loop.a !== null || loop.b !== null) && (
              <button type="button" className="btn small" onClick={() => apply(clearLoop())} title="Apaga os pontos A e B">
                Limpar A–B
              </button>
            )}
          </div>
          {status && (
            <div className="muted small-text" role="status">
              {status}
            </div>
          )}
          {p.onRate && (
            <div className="dock-group">
              <span className="muted small-text">Velocidade</span>
              {[0.5, 0.75, 0.9, 1].map((r) => (
                <button key={r} type="button" className={`chip small${p.rate === r ? ' active' : ''}`} onClick={() => p.onRate!(r)}>
                  {r}×
                </button>
              ))}
            </div>
          )}
          <div className="dock-group dock-vol">
            <Icon name="volume" size={16} />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={vol}
              onChange={(e) => {
                setVol(+e.target.value);
                p.onVolume(+e.target.value);
              }}
              aria-label="Volume"
            />
          </div>
        </div>
        {p.note && <div className="muted small-text">{p.note}</div>}
      </div>
    </div>
  );
}

// ---------- YouTube ----------

const YT_ERRORS: Record<number, string> = {
  2: 'Link de vídeo inválido.',
  5: 'Erro no player do YouTube. Tente outro vídeo.',
  100: 'Vídeo não encontrado ou privado.',
  101: 'O dono deste vídeo não permite tocar fora do YouTube. Escolha outro resultado.',
  150: 'O dono deste vídeo não permite tocar fora do YouTube. Escolha outro resultado.',
};

function YouTubeDock({ track, nonce, min, onMin, onClose }: { track: Track; nonce: number; min: boolean; onMin: () => void; onClose: () => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const yt = useRef<any>(null);
  const [s, setS] = useState({ playing: false, pos: 0, dur: 0 });
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  const rateRef = useRef(1);

  useEffect(() => {
    let dead = false;
    loadYouTubeApi()
      .then(() => {
        if (dead || !holder.current) return;
        const el = document.createElement('div');
        holder.current.appendChild(el);
        yt.current = new window.YT.Player(el, {
          videoId: track.id,
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, playsinline: 1, modestbranding: 1, autoplay: 1, origin: window.location.origin },
          events: {
            onReady: (e: any) => e.target.playVideo(),
            onError: (e: any) => setError(YT_ERRORS[e.data] ?? 'Não foi possível tocar este vídeo.'),
            onStateChange: (e: any) => {
              if (e.data === 1 && rateRef.current !== 1) e.target.setPlaybackRate(rateRef.current);
            },
          },
        });
      })
      .catch((e) => setError(e.message));
    const iv = window.setInterval(() => {
      const p = yt.current;
      if (!p?.getPlayerState) return;
      setS({ playing: p.getPlayerState() === 1, pos: p.getCurrentTime?.() ?? 0, dur: p.getDuration?.() ?? 0 });
    }, 250);
    return () => {
      dead = true;
      clearInterval(iv);
      try {
        yt.current?.destroy();
      } catch {
        /* player já removido */
      }
      yt.current = null;
    };
  }, []);

  useEffect(() => {
    if (yt.current?.loadVideoById) {
      setError(null);
      yt.current.loadVideoById(track.id);
    }
  }, [track.id, nonce]);

  return (
    <Shell
      track={track}
      title={track.title}
      artist={track.artist}
      playing={s.playing}
      pos={s.pos}
      dur={s.dur}
      error={error}
      min={min}
      onMin={onMin}
      onClose={onClose}
      onToggle={() => (s.playing ? yt.current?.pauseVideo() : yt.current?.playVideo())}
      onSeek={(sec) => yt.current?.seekTo?.(sec, true)}
      onVolume={(v) => yt.current?.setVolume?.(Math.round(v * 100))}
      rate={rate}
      onRate={(r) => {
        rateRef.current = r;
        setRate(r);
        yt.current?.setPlaybackRate?.(r);
      }}
      video={<div className="dock-video" ref={holder} />}
    />
  );
}

// ---------- Spotify ----------

function SpotifySdkDock({ track, nonce, min, onMin, onClose }: { track: Track; nonce: number; min: boolean; onMin: () => void; onClose: () => void }) {
  const handle = useRef<SpotifyHandle | null>(null);
  const base = useRef({ pos: 0, at: 0, playing: false });
  const [info, setInfo] = useState<{ title: string; artist: string; thumb?: string; dur: number; playing: boolean }>({ title: track.title, artist: track.artist ?? '', thumb: track.thumb, dur: 0, playing: false });
  const [pos, setPos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const listener = useRef<((s: any) => void) | null>(null);

  useEffect(() => {
    let dead = false;
    getSpotifyPlayer((m) => !dead && setError(m))
      .then((h) => {
        if (dead) return;
        handle.current = h;
        listener.current = (s: any) => {
          if (!s) return;
          const t = s.track_window.current_track;
          base.current = { pos: s.position, at: performance.now(), playing: !s.paused };
          setInfo({ title: t.name, artist: t.artists.map((a: any) => a.name).join(', '), thumb: t.album.images?.[0]?.url, dur: s.duration, playing: !s.paused });
        };
        h.player.addListener('player_state_changed', listener.current);
      })
      .catch(() => {});
    const iv = window.setInterval(() => {
      const b = base.current;
      setPos((b.playing ? b.pos + (performance.now() - b.at) : b.pos) / 1000);
    }, 300);
    return () => {
      dead = true;
      clearInterval(iv);
      const h = handle.current;
      if (h) {
        if (listener.current) h.player.removeListener('player_state_changed', listener.current);
        h.player.pause?.().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        setError(null);
        const h = await getSpotifyPlayer((m) => !dead && setError(m));
        if (dead) return;
        handle.current = h;
        await h.player.activateElement?.();
        await startSpotifyPlayback(h.deviceId, track.uri!);
      } catch (e) {
        if (!dead) setError((e as Error).message);
      }
    })();
    return () => {
      dead = true;
    };
  }, [track.uri, nonce]);

  return (
    <Shell
      track={track}
      title={info.title}
      artist={info.artist}
      playing={info.playing}
      pos={pos}
      dur={info.dur / 1000}
      error={error}
      min={min}
      onMin={onMin}
      onClose={onClose}
      onToggle={() => handle.current?.player.togglePlay()}
      onSeek={(sec) => {
        handle.current?.player.seek(Math.round(sec * 1000));
        base.current = { ...base.current, pos: sec * 1000, at: performance.now() };
      }}
      onVolume={(v) => handle.current?.player.setVolume(v)}
      video={info.thumb ? <img className="dock-art" src={info.thumb} alt="" /> : <div className="dock-art ph" />}
      note="O Spotify não permite alterar a velocidade."
    />
  );
}

function SpotifyEmbedDock({ track, onClose }: { track: Track; onClose: () => void }) {
  const { type, id } = spotifyParts(track.uri ?? '');
  return (
    <div className="dock-body embed">
      <div className="dock-head">
        <div className="dock-title">
          <span className="dock-prov spotify">Spotify</span>
          <b>{track.title}</b>
        </div>
        <button type="button" className="btn small icon" onClick={onClose} aria-label="Fechar">
          <Icon name="x" size={14} />
        </button>
      </div>
      <iframe className="spotify-frame" style={{ height: type === 'track' ? 152 : 352 }} src={`https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`} title={track.title} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" />
      <div className="muted small-text">Neste dispositivo o Spotify só permite o player embutido (faixa completa se você estiver logado). O player completo funciona em navegadores de computador.</div>
    </div>
  );
}

export function Dock() {
  const { track, nonce, close } = usePlayer();
  const [pref, setPref] = useLocalStorage<{ min: boolean }>('ss.dock', { min: isMobileBrowser() });
  const connected = useSpotifyConnected();

  useEffect(() => {
    document.body.classList.toggle('has-dock', !!track);
    return () => document.body.classList.remove('has-dock');
  }, [track]);

  if (!track) return null;
  const common = { track, nonce, min: pref.min, onMin: () => setPref({ min: !pref.min }), onClose: close };
  return (
    <aside className={`dock${pref.min ? ' min' : ''}`} aria-label="Reprodutor">
      {track.provider === 'youtube' ? <YouTubeDock key="yt" {...common} /> : isMobileBrowser() || !connected ? <SpotifyEmbedDock key="spe" track={track} onClose={close} /> : <SpotifySdkDock key="sp" {...common} />}
    </aside>
  );
}
