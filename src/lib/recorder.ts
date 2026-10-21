/**
 * Gravação de áudio com precisão de amostra.
 *
 * Um AudioWorklet recebe "comece no quadro F" e guarda os quadros a partir dali, então a gravação começa
 * exatamente no instante pedido (alinhado ao relógio do AudioContext, o mesmo das bases e do metrônomo).
 * Não usa MediaRecorder: ele comprime, atrasa e não dá o início exato.
 */

import { getCtx } from './audio';
import { openMicStream } from './mic';
import { findOnset } from './wav';

const WORKLET_SOURCE = `
class RecProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = false; this.start = 0; this.want = 0; this.got = 0; this.chunks = []; this.blocks = 0; this.acc = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.cmd === 'start') { this.active = true; this.start = m.frame; this.want = m.frames || 0; this.got = 0; this.chunks = []; }
      else if (m.cmd === 'stop') this.finish(true);
      else if (m.cmd === 'cancel') { this.active = false; this.chunks = []; this.port.postMessage({ type: 'cancelled' }); }
    };
  }
  finish(fromStop) {
    if (!this.active) { if (fromStop) this.port.postMessage({ type: 'done', data: new Float32Array(0) }); return; }
    this.active = false;
    const out = new Float32Array(this.got);
    let at = 0;
    for (const c of this.chunks) { out.set(c, at); at += c.length; }
    this.chunks = [];
    this.port.postMessage({ type: 'done', data: out }, [out.buffer]);
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    const n = ch ? ch.length : 128;
    let sum = 0;
    if (ch) for (let i = 0; i < n; i++) sum += ch[i] * ch[i];
    this.acc += sum; this.blocks++;
    if (this.blocks >= 8) { this.port.postMessage({ type: 'level', v: Math.sqrt(this.acc / (this.blocks * n)) }); this.acc = 0; this.blocks = 0; }
    if (this.active) {
      const blockStart = currentFrame;
      if (blockStart + n > this.start) {
        const from = Math.max(0, this.start - blockStart);
        let take = n - from;
        if (this.want > 0) take = Math.min(take, this.want - this.got);
        const slice = new Float32Array(take);
        if (ch) slice.set(ch.subarray(from, from + take));
        this.chunks.push(slice);
        this.got += take;
        if (this.want > 0 && this.got >= this.want) this.finish(false);
      }
    }
    return true;
  }
}
registerProcessor('rec-processor', RecProcessor);
`;

const loaded = new WeakMap<BaseAudioContext, Promise<void>>();

function ensureWorklet(ctx: AudioContext): Promise<void> {
  if (!ctx.audioWorklet) return Promise.reject(new Error('Este navegador não suporta gravação de áudio de alta precisão (AudioWorklet).'));
  let p = loaded.get(ctx);
  if (!p) {
    const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'text/javascript' }));
    p = ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    loaded.set(ctx, p);
    p.catch(() => loaded.delete(ctx)); // permite tentar de novo
  }
  return p;
}

export class Recorder {
  onLevel?: (rms: number) => void;
  private node: AudioWorkletNode;
  private source: MediaStreamAudioSourceNode;
  private mute: GainNode;
  private pending: ((data: Float32Array | null) => void) | null = null;

  private constructor(
    private ctx: AudioContext,
    stream: MediaStream,
  ) {
    this.node = new AudioWorkletNode(ctx, 'rec-processor', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
    this.source = ctx.createMediaStreamSource(stream);
    this.mute = ctx.createGain();
    this.mute.gain.value = 0; // o worklet precisa estar ligado à saída para ser processado, mas nada do microfone toca nas caixas
    this.source.connect(this.node).connect(this.mute).connect(ctx.destination);
    this.node.port.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; data?: Float32Array; v?: number };
      if (m.type === 'level') this.onLevel?.(m.v ?? 0);
      else if (m.type === 'done' || m.type === 'cancelled') {
        const done = this.pending;
        this.pending = null;
        done?.(m.type === 'done' ? (m.data ?? new Float32Array(0)) : null);
      }
    };
  }

  static async create(ctx: AudioContext, stream: MediaStream): Promise<Recorder> {
    await ensureWorklet(ctx);
    return new Recorder(ctx, stream);
  }

  get busy() {
    return this.pending !== null;
  }

  /**
   * Captura a partir de `atTime` (relógio do AudioContext). Com `frames`, termina sozinho e entrega o áudio;
   * sem, grava até `stop()`. Devolve null se for cancelado.
   */
  capture(atTime: number, frames?: number): Promise<Float32Array | null> {
    if (this.pending) return Promise.reject(new Error('Já existe uma gravação em andamento.'));
    return new Promise((resolve) => {
      this.pending = resolve;
      this.node.port.postMessage({ cmd: 'start', frame: Math.round(atTime * this.ctx.sampleRate), frames: frames ?? 0 });
    });
  }

  /** Encerra uma captura sem tamanho fixo e entrega o que foi gravado. */
  stop() {
    if (this.pending) this.node.port.postMessage({ cmd: 'stop' });
  }

  /** Descarta a captura em andamento. */
  cancel() {
    if (this.pending) this.node.port.postMessage({ cmd: 'cancel' });
  }

  dispose() {
    const done = this.pending;
    this.pending = null;
    done?.(null);
    try {
      this.source.disconnect();
      this.node.disconnect();
      this.mute.disconnect();
    } catch {
      /* já desconectado */
    }
    this.node.port.onmessage = null;
  }
}

/** Microfone + gravador no relógio compartilhado do app. `close()` solta o microfone. */
export async function openRecorder(deviceId?: string): Promise<{ recorder: Recorder; stream: MediaStream; ctx: AudioContext; close: () => void }> {
  const stream = await openMicStream(deviceId);
  try {
    const ctx = getCtx();
    const recorder = await Recorder.create(ctx, stream);
    return {
      recorder,
      stream,
      ctx,
      close: () => {
        recorder.dispose();
        stream.getTracks().forEach((t) => t.stop());
      },
    };
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop()); // não deixa o microfone aberto se algo falhou depois
    throw e;
  }
}

/**
 * Mede a latência de ida e volta tocando um clique e gravando o que o microfone ouve (precisa de alto-falante,
 * não de fones, e de silêncio). Devolve a mediana de algumas medidas, em segundos, ou null se não ouviu o clique.
 */
export async function measureLatency(recorder: Recorder, ctx: AudioContext, rounds = 3): Promise<number | null> {
  const sr = ctx.sampleRate;
  const found: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const start = ctx.currentTime + 0.25;
    const clickAt = start + 0.3;
    const capture = recorder.capture(start, Math.round(sr * 0.9));
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 1500;
    g.gain.setValueAtTime(0.9, clickAt);
    g.gain.exponentialRampToValueAtTime(0.001, clickAt + 0.02);
    o.connect(g).connect(ctx.destination);
    o.start(clickAt);
    o.stop(clickAt + 0.03);
    const data = await capture;
    if (data) {
      const v = findOnset(data, sr, 0.3);
      if (v !== null) found.push(v);
    }
  }
  if (found.length < Math.ceil(rounds / 2)) return null;
  found.sort((a, b) => a - b);
  return found[found.length >> 1];
}
