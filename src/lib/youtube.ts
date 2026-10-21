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

/** Converte a mensagem de erro da API do Google em uma orientação em português. */
export function explainYoutubeError(message: string, origin: string): string {
  const m = message.toLowerCase();
  if (m.includes('referer') || m.includes('referrer'))
    return `A chave tem restrição de site e este endereço não está na lista. No Google Cloud, em "Restrições de aplicativo", adicione ${origin}/* (com a barra e o asterisco no final).`;
  if (m.includes('not valid') || m.includes('invalid'))
    return 'A chave foi recusada como inválida. Confira se ela foi copiada inteira, sem espaços, e se é uma "Chave de API" (começa com AIza).';
  if (m.includes('has not been used') || m.includes('disabled') || m.includes('accessnotconfigured'))
    return 'A YouTube Data API v3 não está ativada no projeto desta chave. Ative em "APIs e serviços → Biblioteca" e aguarde 1–2 minutos.';
  if (m.includes('blocked') || m.includes('not allowed') || m.includes('restricted'))
    return 'A chave está restrita e não permite a YouTube Data API v3. Em "Restrições de API", marque a YouTube Data API v3.';
  if (m.includes('quota')) return 'A cota diária gratuita desta chave acabou. Tente de novo amanhã ou cole o link do vídeo direto.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o Google. Verifique a internet ou se algum bloqueador de anúncios está impedindo a requisição.';
  return message;
}
