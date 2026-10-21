/**
 * Looper (pedal de loop): grava a primeira camada, toca em repetição e deixa gravar novas camadas por cima,
 * todas alinhadas ao mesmo relógio do AudioContext (o mesmo do metrônomo e das bases).
 *
 * Como o alinhamento funciona:
 *  - cada camada tem exatamente N amostras e toca em loop; o "início do loop" (`loopStart`) é um instante
 *    do relógio, e qualquer camada nova entra na fase certa: (agora − loopStart) mod duração;
 *  - o que o microfone captura chega atrasado pela latência L (saída + entrada). Gravamos L amostras a mais
 *    e descartamos as primeiras L, então o som volta para a posição em que foi tocado.
 */
import { click, getCtx } from './audio';
import { MAX_LAYERS, MAX_LOOP_SECONDS } from './loops';
import { openRecorder, type Recorder } from './recorder';
import { peakOf } from './wav';

export type LooperState = 'idle' | 'countin' | 'recording' | 'playing' | 'waiting' | 'overdubbing' | 'stopped';

export interface LooperConfig {
  bpm: number;
  beats: number; // batidas por compasso
  bars: number;
  quantized: boolean; // false = livre: o tamanho é o que você gravar
  countIn: boolean;
  metronome: boolean;
  latency: number; // segundos
}

export interface LayerInfo {
  vol: number;
  mute: boolean;
  peak: number;
}

export interface LooperSnapshot {
  state: LooperState;
  layers: LayerInfo[];
  seconds: number; // duração do loop (0 se ainda não há)
  level: number; // volume do microfone (0–1)
  micReady: boolean;
  busy: boolean; // processando uma gravação que acabou de terminar
}

interface Layer {
  samples: Float32Array;
  buffer: AudioBuffer;
  vol: number;
  mute: boolean;
}

/** Quantas amostras tem um loop de `bars` compassos. */
export const loopFrames = (cfg: Pick<LooperConfig, 'bpm' | 'beats' | 'bars'>, sampleRate: number) => Math.round(((cfg.bars * cfg.beats * 60) / cfg.bpm) * sampleRate);

/** O tamanho do loop cabe no limite do app? */
export const loopFits = (cfg: Pick<LooperConfig, 'bpm' | 'beats' | 'bars'>) => (cfg.bars * cfg.beats * 60) / cfg.bpm <= MAX_LOOP_SECONDS;

/** Próximo início de loop a partir de `now` (com folga mínima para dar tempo de armar a gravação). */
export function nextBoundary(now: number, loopStart: number, length: number, margin = 0.05): number {
  const k = Math.ceil((now + margin - loopStart) / length);
  return loopStart + k * length;
}

/** Fase (segundos) dentro do loop no instante `t`. */
export const phaseAt = (t: number, loopStart: number, length: number) => (((t - loopStart) % length) + length) % length;

/** Recorta o áudio gravado: descarta as primeiras `latency` amostras e ajusta ao tamanho do loop (completa com silêncio). */
export function trimCapture(data: Float32Array, latency: number, length: number): Float32Array {
  const out = new Float32Array(length);
  out.set(data.subarray(Math.min(latency, data.length), Math.min(latency + length, data.length)));
  return out;
}

export class Looper {
  cfg: LooperConfig;
  private ctx: AudioContext | null = null;
  private recorder: Recorder | null = null;
  private stream: MediaStream | null = null;
  private closeMic: (() => void) | null = null;
  private master: GainNode | null = null;
  private layers: Layer[] = [];
  private sources: { src: AudioBufferSourceNode; gain: GainNode }[] = [];
  private frames = 0; // N: amostras de cada camada
  private state: LooperState = 'idle';
  private loopStart = 0;
  private level = 0;
  private busy = false;
  private timers: number[] = [];
  private grid: { anchor: number; beat: number; countBeats: number; next: number } | null = null;
  private metro = 0;
  private lastEmit = 0;
  private disposed = false;

  constructor(
    cfg: LooperConfig,
    private onChange: (s: LooperSnapshot) => void,
    private onError: (message: string) => void,
  ) {
    this.cfg = cfg;
  }

  // ---------- estado visível ----------

  snapshot(): LooperSnapshot {
    return {
      state: this.state,
      layers: this.layers.map((l) => ({ vol: l.vol, mute: l.mute, peak: peakOf(l.samples) })),
      seconds: this.ctx && this.frames ? this.frames / this.ctx.sampleRate : 0,
      level: this.level,
      micReady: !!this.recorder,
      busy: this.busy,
    };
  }

  private emit(force = true) {
    if (this.disposed) return;
    const now = performance.now();
    if (!force && now - this.lastEmit < 60) return;
    this.lastEmit = now;
    this.onChange(this.snapshot());
  }

  private set(state: LooperState) {
    this.state = state;
    this.emit();
  }

  /** Posição dentro do loop (0–1) para o desenho; null quando não há o que mostrar. */
  position(): number | null {
    const c = this.ctx;
    if (!c || !this.frames) return null;
    if (this.state === 'playing' || this.state === 'waiting' || this.state === 'overdubbing') return phaseAt(c.currentTime, this.loopStart, this.frames / c.sampleRate) / (this.frames / c.sampleRate);
    return null;
  }

  get sampleRate() {
    return (this.ctx ?? getCtx()).sampleRate;
  }

  /** Estimativa da latência de saída (o resto, da entrada, o usuário calibra). */
  static estimateLatency(): number {
    const c = getCtx();
    return (c.baseLatency || 0) + ((c as AudioContext & { outputLatency?: number }).outputLatency || 0);
  }

  // ---------- microfone ----------

  async enable(deviceId?: string): Promise<void> {
    this.releaseMic();
    const r = await openRecorder(deviceId);
    this.ctx = r.ctx;
    this.recorder = r.recorder;
    this.stream = r.stream;
    this.closeMic = r.close;
    r.recorder.onLevel = (v) => {
      this.level = v;
      this.emit(false);
    };
    this.emit();
  }

  get audioContext() {
    return this.ctx;
  }
  get recorderHandle() {
    return this.recorder;
  }
  get micStream() {
    return this.stream;
  }

  private releaseMic() {
    this.closeMic?.();
    this.closeMic = null;
    this.recorder = null;
    this.stream = null;
    this.level = 0;
  }

  // ---------- comandos do pedal ----------

  /** REC: grava a 1ª camada (idle) ou, no modo livre, encerra a gravação. */
  rec() {
    if (this.state === 'recording' && !this.cfg.quantized) {
      this.recorder?.stop();
      return;
    }
    if ((this.state === 'idle' || (this.state === 'stopped' && !this.layers.length)) && this.recorder) void this.startFirst();
  }

  /** OVERDUB: grava uma nova camada por cima, a partir do próximo início de loop. */
  overdub() {
    if (this.state === 'waiting') {
      this.undo(); // apertar de novo antes de começar cancela
      return;
    }
    if (this.state !== 'playing' || !this.recorder || this.busy) return;
    if (this.layers.length >= MAX_LAYERS) {
      this.onError(`O limite é de ${MAX_LAYERS} camadas.`);
      return;
    }
    void this.startOverdub();
  }

  play() {
    if (this.state !== 'stopped' || !this.layers.length) return;
    this.startPlayback(true);
    this.set('playing');
    this.startMetronome();
  }

  stop() {
    this.recorder?.cancel();
    this.clearTimers();
    this.stopSources();
    this.stopMetronome();
    this.set(this.layers.length ? 'stopped' : 'idle');
  }

  undo() {
    if (this.state === 'waiting' || this.state === 'overdubbing') {
      // desfazer durante uma gravação por cima = cancelar essa gravação (as camadas já salvas continuam)
      this.recorder?.cancel();
      this.clearTimers();
      this.state = 'playing';
      this.emit();
      return;
    }
    if (this.state === 'recording' || this.state === 'countin') {
      this.stop();
      return;
    }
    if (!this.layers.length) return;
    this.layers.pop();
    const s = this.sources.pop();
    if (s) this.killSource(s);
    if (!this.layers.length) {
      this.stop();
      this.frames = 0;
      this.set('idle');
    } else this.emit();
  }

  clear() {
    this.stop();
    this.layers = [];
    this.frames = 0;
    this.set('idle');
  }

  setVol(i: number, vol: number) {
    const l = this.layers[i];
    if (!l) return;
    l.vol = Math.max(0, Math.min(1, vol));
    this.applyGain(i);
    this.emit();
  }

  setMute(i: number, mute: boolean) {
    const l = this.layers[i];
    if (!l) return;
    l.mute = mute;
    this.applyGain(i);
    this.emit();
  }

  /** Carrega camadas salvas (da biblioteca) e deixa pronto para tocar. */
  load(samples: { samples: Float32Array; vol: number; mute: boolean }[], cfg: LooperConfig) {
    this.stop();
    const c = this.ctx ?? getCtx();
    this.ctx = c;
    this.cfg = { ...cfg };
    this.layers = samples.map((l) => this.makeLayer(l.samples, l.vol, l.mute));
    this.frames = samples[0]?.samples.length ?? 0;
    this.set(this.layers.length ? 'stopped' : 'idle');
  }

  /** Camadas atuais (para salvar). */
  exportLayers() {
    return this.layers.map((l) => ({ samples: l.samples, vol: l.vol, mute: l.mute }));
  }

  dispose() {
    this.disposed = true;
    this.recorder?.cancel();
    this.clearTimers();
    this.stopSources();
    this.stopMetronome();
    this.releaseMic();
    try {
      this.master?.disconnect();
    } catch {
      /* já desconectado */
    }
  }

  // ---------- gravação ----------

  private after(t: number, fn: () => void) {
    const ms = Math.max(0, (t - (this.ctx?.currentTime ?? 0)) * 1000);
    this.timers.push(window.setTimeout(fn, ms));
  }
  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  private async startFirst() {
    const c = this.ctx!;
    const cfg = { ...this.cfg };
    if (cfg.quantized && !loopFits(cfg)) {
      this.onError(`Com esse andamento, ${cfg.bars} compasso(s) passam de ${MAX_LOOP_SECONDS} segundos. Reduza os compassos ou aumente o BPM.`);
      return;
    }
    const sr = c.sampleRate;
    const L = Math.max(0, Math.round(cfg.latency * sr));
    const beat = 60 / cfg.bpm;
    const countBeats = cfg.countIn ? cfg.beats : 0;
    const t0 = c.currentTime + 0.2;
    const recStart = t0 + countBeats * beat;
    this.grid = { anchor: t0, beat, countBeats, next: 0 };
    this.loopStart = recStart;
    this.startMetronome();
    this.set(countBeats ? 'countin' : 'recording');
    if (countBeats) this.after(recStart, () => this.state === 'countin' && this.set('recording'));

    const N = cfg.quantized ? loopFrames(cfg, sr) : 0;
    this.busy = false;
    let data: Float32Array | null;
    try {
      data = await this.recorder!.capture(recStart, cfg.quantized ? N + L : undefined);
    } catch (e) {
      this.onError(e instanceof Error ? e.message : 'Falha na gravação.');
      this.stop();
      return;
    }
    if (!data || this.disposed || (this.state !== 'recording' && this.state !== 'countin')) {
      if (this.state === 'countin' || this.state === 'recording') this.stop();
      return; // cancelado
    }
    const length = cfg.quantized ? N : Math.max(0, data.length - L);
    if (length < sr * 0.2) {
      this.onError('A gravação ficou curta demais. Toque REC e grave por mais tempo.');
      this.stop();
      return;
    }
    if (length > sr * MAX_LOOP_SECONDS) {
      this.onError(`O loop passou de ${MAX_LOOP_SECONDS} segundos.`);
      this.stop();
      return;
    }
    this.frames = length;
    this.layers = [this.makeLayer(trimCapture(data, L, length), 1, false)];
    // a fase continua de onde o relógio estava: o loop "começou" em recStart
    this.startPlayback(false);
    this.set('playing');
  }

  private async startOverdub() {
    const c = this.ctx!;
    const sr = c.sampleRate;
    const len = this.frames / sr;
    const L = Math.max(0, Math.round(this.cfg.latency * sr));
    const T = nextBoundary(c.currentTime, this.loopStart, len, 0.08); // folga para o pedido chegar ao worklet antes do início
    this.set('waiting');
    this.after(T, () => this.state === 'waiting' && this.set('overdubbing'));
    this.after(T + len, () => this.state === 'overdubbing' && this.set('playing'));
    this.busy = true;
    let data: Float32Array | null;
    try {
      data = await this.recorder!.capture(T, this.frames + L);
    } catch (e) {
      this.busy = false;
      this.onError(e instanceof Error ? e.message : 'Falha na gravação.');
      return;
    }
    this.busy = false;
    if (!data || this.disposed) {
      this.emit();
      return; // cancelado (STOP, desfazer ou fechar a página)
    }
    this.layers.push(this.makeLayer(trimCapture(data, L, this.frames), 1, false));
    if (this.state === 'playing' || this.state === 'overdubbing' || this.state === 'waiting') {
      this.startSource(this.layers.length - 1, this.ctx!.currentTime + 0.02);
      if (this.state !== 'playing') this.state = 'playing';
    }
    this.emit();
  }

  // ---------- reprodução ----------

  private makeLayer(samples: Float32Array, vol: number, mute: boolean): Layer {
    const c = this.ctx ?? getCtx();
    const buffer = c.createBuffer(1, samples.length, c.sampleRate);
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    return { samples, buffer, vol, mute };
  }

  private ensureMaster(): GainNode {
    if (!this.master) {
      const c = this.ctx!;
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      const comp = c.createDynamicsCompressor();
      this.master.connect(comp).connect(c.destination);
    }
    return this.master;
  }

  private startSource(i: number, when: number) {
    const c = this.ctx!;
    const l = this.layers[i];
    const src = c.createBufferSource();
    src.buffer = l.buffer;
    src.loop = true;
    const gain = c.createGain();
    gain.gain.value = l.mute ? 0 : l.vol;
    src.connect(gain).connect(this.ensureMaster());
    const len = l.buffer.duration;
    src.start(when, phaseAt(when, this.loopStart, len));
    this.sources[i] = { src, gain };
  }

  /** `fresh`: recomeça o loop do zero (PLAY depois de STOP); senão mantém a fase do relógio. */
  private startPlayback(fresh: boolean) {
    const c = this.ctx!;
    this.stopSources();
    const when = c.currentTime + 0.05;
    if (fresh) {
      this.loopStart = when;
      this.grid = this.grid ? { ...this.grid, anchor: when, countBeats: 0, next: 0 } : { anchor: when, beat: 60 / this.cfg.bpm, countBeats: 0, next: 0 };
    }
    this.layers.forEach((_, i) => this.startSource(i, when));
  }

  private applyGain(i: number) {
    const s = this.sources[i];
    const l = this.layers[i];
    if (s && l) s.gain.gain.setTargetAtTime(l.mute ? 0 : l.vol, this.ctx!.currentTime, 0.01);
  }

  private killSource(s: { src: AudioBufferSourceNode; gain: GainNode }) {
    try {
      s.src.stop();
    } catch {
      /* ainda não começou */
    }
    s.src.disconnect();
    s.gain.disconnect();
  }

  private stopSources() {
    this.sources.forEach((s) => s && this.killSource(s));
    this.sources = [];
  }

  // ---------- metrônomo ----------

  private startMetronome() {
    clearInterval(this.metro); // reinicia só o relógio; a grade de batidas (this.grid) é preservada
    const c = this.ctx!;
    const tick = () => {
      const g = this.grid;
      if (!g) return;
      const quantized = this.cfg.quantized;
      while (g.anchor + g.next * g.beat < c.currentTime + 0.15) {
        const t = g.anchor + g.next * g.beat;
        const idx = g.next;
        g.next++;
        if (t < c.currentTime - 0.02) continue;
        const counting = idx < g.countBeats;
        if (counting || (this.cfg.metronome && quantized)) click(c, this.ensureMaster(), t, idx % this.cfg.beats === 0, 0.7);
      }
    };
    tick();
    this.metro = window.setInterval(tick, 25);
  }

  private stopMetronome() {
    clearInterval(this.metro);
    this.metro = 0;
    this.grid = null;
  }
}
