export type SourceKind = 'spotify' | 'youtube' | 'file' | 'link';

export interface Source {
  id: string;
  kind: SourceKind;
  label: string;
  url?: string; // link original
  embed?: string; // url do iframe
  tall?: boolean; // playlists/álbuns pedem iframe maior
  fileId?: string; // IndexedDB
  ytId?: string; // id do vídeo (reprodutor do site)
  uri?: string; // spotify:track:... (reprodutor do site)
  title?: string;
}

export interface Song {
  id: string;
  builtin?: boolean;
  chart?: string; // cifra em texto: | Am | C G | ...
  style?: 'rock' | 'shuffle' | 'ballad' | 'funk';
  title: string;
  artist: string;
  keyPc: number | null;
  minor: boolean;
  bpm: number | null;
  tags: string[];
  notes: string;
  sources: Source[];
  createdAt: number;
}

const SPOTIFY = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/;
const SPOTIFY_URI = /^spotify:(track|album|playlist|episode|show|artist):([A-Za-z0-9]+)/;

export function parseLink(raw: string, id: string): Source | null {
  const url = raw.trim();
  if (!url) return null;

  const sp = SPOTIFY.exec(url) ?? SPOTIFY_URI.exec(url);
  if (sp) {
    const [, type, sid] = sp;
    return {
      id,
      kind: 'spotify',
      label: `Spotify · ${type === 'track' ? 'faixa' : type === 'album' ? 'álbum' : type === 'playlist' ? 'playlist' : type}`,
      url: `https://open.spotify.com/${type}/${sid}`,
      uri: `spotify:${type}:${sid}`,
      embed: `https://open.spotify.com/embed/${type}/${sid}?utm_source=generator&theme=0`,
      tall: type !== 'track' && type !== 'episode',
    };
  }

  let yt: { v?: string; list?: string } | null = null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') yt = { v: u.pathname.slice(1), list: u.searchParams.get('list') ?? undefined };
    else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const m = /^\/(?:embed|shorts|live)\/([\w-]+)/.exec(u.pathname);
      yt = { v: u.searchParams.get('v') ?? m?.[1] ?? undefined, list: u.searchParams.get('list') ?? undefined };
    }
  } catch {
    return { id, kind: 'link', label: 'Link', url };
  }
  if (yt && (yt.v || yt.list)) {
    const base = 'https://www.youtube-nocookie.com/embed/';
    const embed = yt.v ? `${base}${yt.v}?enablejsapi=1&rel=0${yt.list ? `&list=${yt.list}` : ''}` : `${base}videoseries?list=${yt.list}&enablejsapi=1&rel=0`;
    return { id, kind: 'youtube', label: yt.v ? 'YouTube · vídeo' : 'YouTube · playlist', url, embed, ytId: yt.v };
  }
  return { id, kind: 'link', label: 'Link', url };
}

/** Escalas sugeridas pela tonalidade da música. */
export const suggestedScales = (minor: boolean) =>
  minor ? ['minor-pent', 'natural-minor', 'blues-minor', 'dorian', 'harmonic-minor'] : ['major-pent', 'major', 'mixolydian', 'lydian', 'blues-major'];
