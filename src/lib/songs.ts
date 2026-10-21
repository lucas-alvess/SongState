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

// ---------- Segurança: dados importados nunca são confiáveis ----------

const EMBED_HOSTS = new Set(['open.spotify.com', 'www.youtube-nocookie.com', 'www.youtube.com']);

/** Só permite iframes https de Spotify/YouTube (bloqueia javascript:, data: e outros hosts). */
export function safeEmbedUrl(url?: string): string | undefined {
  try {
    const u = new URL(url ?? '');
    return u.protocol === 'https:' && EMBED_HOSTS.has(u.hostname) ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/** Só permite links http(s) em <a href>. */
export function safeHref(url?: string): string | undefined {
  try {
    const u = new URL(url ?? '');
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

const STYLES = ['rock', 'shuffle', 'ballad', 'funk'] as const;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Valida e reconstrói uma música vinda de um arquivo importado (descarta campos desconhecidos). */
export function sanitizeSong(d: unknown): Song | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const id = str(o.id, 40).replace(/[^\w-]/g, '');
  const title = str(o.title, 200).trim();
  if (!id || !title) return null;
  const sources: Source[] = [];
  if (Array.isArray(o.sources)) {
    for (const s of o.sources.slice(0, 20)) {
      const url = str((s as Record<string, unknown>)?.url, 500);
      const src = url ? parseLink(url, str((s as Record<string, unknown>).id, 40).replace(/[^\w-]/g, '') || id) : null;
      if (src && src.kind !== 'file' && (src.kind !== 'link' || safeHref(src.url))) sources.push(src); // embed/uri são recalculados a partir do link
    }
  }
  const bpm = typeof o.bpm === 'number' && isFinite(o.bpm) ? Math.min(300, Math.max(20, o.bpm)) : null;
  return {
    id,
    title,
    artist: str(o.artist, 200),
    keyPc: typeof o.keyPc === 'number' && o.keyPc >= 0 && o.keyPc < 12 ? Math.floor(o.keyPc) : null,
    minor: o.minor === true,
    bpm,
    style: (STYLES as readonly string[]).includes(o.style as string) ? (o.style as Song['style']) : 'rock',
    chart: str(o.chart, 20000),
    tags: Array.isArray(o.tags) ? o.tags.slice(0, 20).map((t) => str(t, 40)).filter(Boolean) : [],
    notes: str(o.notes, 5000),
    sources,
    createdAt: typeof o.createdAt === 'number' ? o.createdAt : Date.now(),
  };
}
