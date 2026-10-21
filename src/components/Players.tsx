import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { trackFromSource, usePlayer } from '../lib/player';
import { isMobileBrowser, useSpotifyConnected } from '../lib/spotify';
import { getFile } from '../lib/storage';
import type { Source } from '../lib/songs';

const SPEEDS = [0.5, 0.6, 0.75, 0.9, 1];

function YouTubePlayer({ src }: { src: Source }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [rate, setRate] = useState(1);
  const set = (r: number) => {
    setRate(r);
    ref.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'setPlaybackRate', args: [r] }), '*');
  };
  return (
    <>
      <div className="video-frame">
        <iframe ref={ref} src={src.embed} title={src.label} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      </div>
      <div className="row gap wrap speed-row">
        <span className="muted">Velocidade</span>
        {SPEEDS.map((r) => (
          <button key={r} type="button" className={`chip small${rate === r ? ' active' : ''}`} onClick={() => set(r)}>
            {r}×
          </button>
        ))}
      </div>
    </>
  );
}

function FilePlayer({ src }: { src: Source }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [rate, setRate] = useState(1);
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const [loop, setLoop] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    getFile(src.fileId!)
      .then((blob) => {
        if (!blob) return setMissing(true);
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setMissing(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src.fileId]);

  useEffect(() => {
    if (audio.current) {
      audio.current.playbackRate = rate;
      audio.current.preservesPitch = true;
    }
  }, [rate, url]);

  const onTime = () => {
    const el = audio.current;
    if (el && loop && a !== null && b !== null && b > a && el.currentTime >= b) el.currentTime = a;
  };
  const now = () => audio.current?.currentTime ?? 0;
  const fmt = (n: number | null) => (n === null ? '–' : `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`);

  if (missing) return <p className="muted">Arquivo não encontrado neste dispositivo (os áudios ficam salvos só no navegador onde foram adicionados).</p>;
  return (
    <div className="file-player">
      <audio ref={audio} src={url ?? undefined} controls onTimeUpdate={onTime} preload="metadata" />
      <div className="row gap wrap speed-row">
        <span className="muted">Velocidade</span>
        {[0.5, 0.6, 0.75, 0.9, 1, 1.1].map((r) => (
          <button key={r} type="button" className={`chip small${rate === r ? ' active' : ''}`} onClick={() => setRate(r)}>
            {r}×
          </button>
        ))}
      </div>
      <div className="row gap wrap speed-row">
        <span className="muted">Loop A–B</span>
        <button type="button" className="btn small" onClick={() => setA(now())}>A {fmt(a)}</button>
        <button type="button" className="btn small" onClick={() => setB(now())}>B {fmt(b)}</button>
        <button type="button" className={`btn small${loop ? ' primary' : ''}`} disabled={a === null || b === null} onClick={() => { setLoop(!loop); if (!loop && a !== null && audio.current) audio.current.currentTime = a; }}>
          {loop ? 'Loop ligado' : 'Ligar loop'}
        </button>
        <button type="button" className="btn small" onClick={() => { setA(null); setB(null); setLoop(false); }}>Limpar</button>
      </div>
    </div>
  );
}

function TrackRow({ src, title }: { src: Source; title: string }) {
  const { play, track } = usePlayer();
  const t = trackFromSource(src, title)!;
  const on = track?.provider === t.provider && track.id === t.id;
  return (
    <div className="track-row">
      {t.thumb ? <img src={t.thumb} alt="" /> : <div className="result-ph" />}
      <div className="result-body">
        <b>{src.label}</b>
        <span className="muted small-text">Toca no reprodutor fixo do site, sem sair desta página.</span>
      </div>
      <button type="button" className="btn primary" onClick={() => play(t)}>
        <Icon name="play" size={14} /> {on ? 'Tocando' : 'Ouvir'}
      </button>
    </div>
  );
}

export function SourcePlayer({ src, title = '' }: { src: Source; title?: string }) {
  const connected = useSpotifyConnected();
  const dockable = (src.kind === 'youtube' && !!src.ytId) || (src.kind === 'spotify' && !!src.uri && connected && !isMobileBrowser());
  if (dockable) return <TrackRow src={src} title={title} />;
  if (src.kind === 'spotify')
    return (
      <>
        <iframe className="spotify-frame" style={{ height: src.tall ? 352 : 152 }} src={src.embed} title={src.label} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
        <p className="muted small-text">Conecte o Spotify nos ajustes para tocar a faixa completa no reprodutor do site (navegador de computador). Sem isso, o player embutido toca a faixa completa só se você estiver logado no Spotify neste navegador.</p>
      </>
    );
  if (src.kind === 'youtube') return <YouTubePlayer src={src} />;
  if (src.kind === 'file') return <FilePlayer src={src} />;
  return (
    <a className="btn primary" href={src.url} target="_blank" rel="noreferrer">
      Abrir link ↗
    </a>
  );
}
