/** Análise do tom de um arquivo de áudio guardado no navegador (decodifica e usa keyfind.ts). */
import { detectKeyFromAudio, type KeyResult } from './keyfind';

const cache = new Map<string, KeyResult | null>(); // por id do arquivo, só nesta sessão
export const MAX_ANALYZE_BYTES = 120 * 1024 * 1024;

export class AnalyzeError extends Error {}

/** Mistura os canais em mono. */
export function toMono(buf: AudioBuffer): Float32Array {
  const n = buf.length;
  const out = new Float32Array(n);
  const ch = buf.numberOfChannels;
  for (let c = 0; c < ch; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += d[i] / ch;
  }
  return out;
}

export async function analyzeKey(fileId: string, blob: Blob): Promise<KeyResult> {
  if (cache.has(fileId)) {
    const hit = cache.get(fileId);
    if (hit) return hit;
  }
  if (blob.size > MAX_ANALYZE_BYTES) throw new AnalyzeError('O arquivo é grande demais para analisar aqui (mais de 120 MB).');
  const Ctx = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Ctx) throw new AnalyzeError('Este navegador não consegue analisar áudio.');
  let buf: AudioBuffer;
  try {
    buf = await new Ctx(1, 1, 44100).decodeAudioData(await blob.arrayBuffer());
  } catch {
    throw new AnalyzeError('Não foi possível ler este arquivo de áudio (formato não suportado ou arquivo danificado).');
  }
  const result = detectKeyFromAudio(toMono(buf), buf.sampleRate);
  if (!result) throw new AnalyzeError('Não encontrei notas claras no áudio (silêncio ou só ruído).');
  cache.set(fileId, result);
  return result;
}
