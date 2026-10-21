/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

export function loadYouTubeApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => {
      apiPromise = null;
      reject(new Error('Não foi possível carregar o player do YouTube.'));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}

export const decodeHtml = (s: string) => {
  const t = document.createElement('textarea');
  t.innerHTML = s;
  return t.value;
};

export interface YouTubeResult {
  id: string;
  title: string;
  channel: string;
  thumb?: string;
}

/** Busca com a YouTube Data API v3 (exige chave gratuita do Google Cloud). Só vídeos que permitem incorporação. */
export async function youtubeSearch(q: string, key: string, max = 12): Promise<YouTubeResult[]> {
  const p = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', videoSyndicated: 'true', maxResults: String(max), q, key });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${p}`);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg: string = json?.error?.message ?? `YouTube respondeu ${res.status}`;
    throw new Error(/quota/i.test(msg) ? 'A cota diária gratuita da busca do YouTube acabou. Tente amanhã ou cole o link do vídeo.' : msg.replace(/<[^>]+>/g, ''));
  }
  return (json.items ?? []).map((i: any) => ({
    id: i.id.videoId,
    title: decodeHtml(i.snippet.title),
    channel: decodeHtml(i.snippet.channelTitle),
    thumb: i.snippet.thumbnails?.medium?.url ?? i.snippet.thumbnails?.default?.url,
  }));
}

export async function youtubeOembed(url: string): Promise<{ title: string; author: string } | null> {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    if (!r.ok) return null;
    const j = await r.json();
    return { title: j.title, author: j.author_name };
  } catch {
    return null;
  }
}

export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
