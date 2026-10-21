/** Captura do microfone para o afinador. */

export interface Mic {
  ctx: AudioContext;
  analyser: AnalyserNode;
  stream: MediaStream;
  sampleRate: number;
  deviceId: string;
  stop: () => void;
}

export const FFT_SIZE = 8192; // ~170 ms de áudio: janela longa o bastante para as cordas graves (E2 = 82 Hz)

/** O navegador permite pedir o microfone? (precisa de https ou localhost) */
export function micSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && (typeof window === 'undefined' || window.isSecureContext !== false);
}

/** Mensagem em português para cada tipo de falha ao abrir o microfone. */
export function explainMicError(e: unknown): string {
  const name = (e as { name?: string } | null)?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'O acesso ao microfone foi negado. Libere o microfone nas permissões do site (ícone de cadeado ao lado do endereço) e tente de novo.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Nenhum microfone foi encontrado neste aparelho.';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'Não foi possível usar o microfone: outro aplicativo pode estar usando.';
    case 'OverconstrainedError':
      return 'O microfone escolhido não está mais disponível. Escolha outro na lista.';
    default:
      return 'Não foi possível abrir o microfone.';
  }
}

/**
 * Abre o microfone com os filtros do navegador DESLIGADOS (cancelamento de eco, supressão de ruído e ganho
 * automático distorcem a altura das notas e atrapalham o afinador).
 */
export async function openMic(deviceId?: string): Promise<Mic> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
  });
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    if (ctx.state === 'suspended') await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser); // sem ligar na saída: nada do microfone sai pelas caixas (evita microfonia)
    const track = stream.getAudioTracks()[0];
    return {
      ctx,
      analyser,
      stream,
      sampleRate: ctx.sampleRate,
      deviceId: track?.getSettings().deviceId ?? deviceId ?? '',
      stop: () => {
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close().catch(() => {});
      },
    };
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop()); // não deixa o microfone aberto se algo falhou depois
    throw e;
  }
}
