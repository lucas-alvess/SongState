import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { uid } from './storage';
import type { Source } from './songs';

export interface Track {
  provider: 'youtube' | 'spotify';
  id: string; // id do vídeo ou do item do Spotify
  uri?: string; // spotify:track:...
  title: string;
  artist?: string;
  thumb?: string;
}

interface Ctx {
  track: Track | null;
  nonce: number;
  play: (t: Track) => void;
  close: () => void;
}

const PlayerContext = createContext<Ctx>({ track: null, nonce: 0, play: () => {}, close: () => {} });
export const usePlayer = () => useContext(PlayerContext);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [track, setTrack] = useState<Track | null>(null);
  const [nonce, setNonce] = useState(0);
  const play = useCallback((t: Track) => {
    setTrack(t);
    setNonce((n) => n + 1);
  }, []);
  const close = useCallback(() => setTrack(null), []);
  const value = useMemo(() => ({ track, nonce, play, close }), [track, nonce, play, close]);
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export const spotifyParts = (uri: string) => {
  const m = /^spotify:(\w+):(\w+)$/.exec(uri);
  return { type: m?.[1] ?? 'track', id: m?.[2] ?? '' };
};

/** Fonte salva na música → faixa para o reprodutor (null se não der para tocar no reprodutor próprio). */
export function trackFromSource(s: Source, fallbackTitle: string): Track | null {
  if (s.kind === 'youtube' && s.ytId) return { provider: 'youtube', id: s.ytId, title: s.title ?? fallbackTitle, thumb: `https://i.ytimg.com/vi/${s.ytId}/mqdefault.jpg` };
  if (s.kind === 'spotify' && s.uri) return { provider: 'spotify', id: spotifyParts(s.uri).id, uri: s.uri, title: s.title ?? fallbackTitle };
  return null;
}

export function sourceFromTrack(t: Track): Source {
  if (t.provider === 'youtube') {
    return {
      id: uid(),
      kind: 'youtube',
      ytId: t.id,
      title: t.title,
      label: `YouTube · ${t.title.slice(0, 38)}`,
      url: `https://www.youtube.com/watch?v=${t.id}`,
      embed: `https://www.youtube-nocookie.com/embed/${t.id}?enablejsapi=1&rel=0`,
    };
  }
  const { type, id } = spotifyParts(t.uri ?? '');
  return {
    id: uid(),
    kind: 'spotify',
    uri: t.uri,
    title: t.title,
    label: `Spotify · ${t.title.slice(0, 38)}`,
    url: `https://open.spotify.com/${type}/${id}`,
    embed: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`,
    tall: type !== 'track' && type !== 'episode',
  };
}
