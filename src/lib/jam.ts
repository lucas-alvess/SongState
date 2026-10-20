import { getCtx, midiToFreq, noiseBuffer } from './audio';
import { mod12 } from './music';

export type Quality = 'maj' | 'min' | 'dom7' | 'min7' | 'maj7' | 'm7b5';
export type StyleId = 'rock' | 'shuffle' | 'ballad' | 'funk';

export const CHORD_INTERVALS: Record<Quality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dom7: [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  m7b5: [0, 3, 6, 10],
};
export const CHORD_SUFFIX: Record<Quality, string> = { maj: '', min: 'm', dom7: '7', min7: 'm7', maj7: 'maj7', m7b5: 'm7♭5' };

export interface ProgStep {
  off: number;
  q: Quality;
  bars: number;
}
export interface Progression {
  id: string;
  name: string;
  desc: string;
  minor: boolean;
  steps: ProgStep[];
  scales: string[];
  style: StyleId;
  bpm: number;
}

export const STYLES: { id: StyleId; name: string }[] = [
  { id: 'rock', name: 'Rock / Pop' },
  { id: 'shuffle', name: 'Shuffle / Swing' },
  { id: 'ballad', name: 'Balada' },
  { id: 'funk', name: 'Funk' },
];

export const PROGRESSIONS: Progression[] = [
  { id: 'blues-major', name: 'Blues 12 compassos (maior)', desc: 'I7 – IV7 – V7', minor: false, style: 'shuffle', bpm: 100, scales: ['blues-minor', 'minor-pent', 'mixolydian', 'major-pent'], steps: [{ off: 0, q: 'dom7', bars: 4 }, { off: 5, q: 'dom7', bars: 2 }, { off: 0, q: 'dom7', bars: 2 }, { off: 7, q: 'dom7', bars: 1 }, { off: 5, q: 'dom7', bars: 1 }, { off: 0, q: 'dom7', bars: 1 }, { off: 7, q: 'dom7', bars: 1 }] },
  { id: 'blues-minor', name: 'Blues menor 12 compassos', desc: 'Im7 – IVm7 – V7', minor: true, style: 'shuffle', bpm: 80, scales: ['blues-minor', 'minor-pent', 'dorian', 'natural-minor'], steps: [{ off: 0, q: 'min7', bars: 4 }, { off: 5, q: 'min7', bars: 2 }, { off: 0, q: 'min7', bars: 2 }, { off: 7, q: 'dom7', bars: 1 }, { off: 5, q: 'min7', bars: 1 }, { off: 0, q: 'min7', bars: 1 }, { off: 7, q: 'dom7', bars: 1 }] },
  { id: 'rock-minor', name: 'Rock menor', desc: 'i – ♭VI – ♭VII', minor: true, style: 'rock', bpm: 110, scales: ['minor-pent', 'natural-minor', 'blues-minor'], steps: [{ off: 0, q: 'min', bars: 2 }, { off: 8, q: 'maj', bars: 1 }, { off: 10, q: 'maj', bars: 1 }] },
  { id: 'andalusian', name: 'Cadência andaluza', desc: 'i – ♭VII – ♭VI – V', minor: true, style: 'rock', bpm: 100, scales: ['minor-pent', 'natural-minor', 'harmonic-minor'], steps: [{ off: 0, q: 'min', bars: 1 }, { off: 10, q: 'maj', bars: 1 }, { off: 8, q: 'maj', bars: 1 }, { off: 7, q: 'maj', bars: 1 }] },
  { id: 'minor-emotional', name: 'Balada menor', desc: 'i – ♭VI – ♭III – ♭VII', minor: true, style: 'ballad', bpm: 72, scales: ['natural-minor', 'minor-pent', 'dorian'], steps: [{ off: 0, q: 'min', bars: 1 }, { off: 8, q: 'maj', bars: 1 }, { off: 3, q: 'maj', bars: 1 }, { off: 10, q: 'maj', bars: 1 }] },
  { id: 'pop', name: 'Pop clássico', desc: 'I – V – vi – IV', minor: false, style: 'rock', bpm: 100, scales: ['major-pent', 'major', 'lydian'], steps: [{ off: 0, q: 'maj', bars: 1 }, { off: 7, q: 'maj', bars: 1 }, { off: 9, q: 'min', bars: 1 }, { off: 5, q: 'maj', bars: 1 }] },
  { id: 'folk', name: 'Folk / Country', desc: 'I – IV – V – I', minor: false, style: 'rock', bpm: 110, scales: ['major-pent', 'major', 'mixolydian'], steps: [{ off: 0, q: 'maj', bars: 1 }, { off: 5, q: 'maj', bars: 1 }, { off: 7, q: 'maj', bars: 1 }, { off: 0, q: 'maj', bars: 1 }] },
  { id: 'rock-mixo', name: 'Rock mixolídio', desc: 'I – ♭VII – IV', minor: false, style: 'rock', bpm: 120, scales: ['mixolydian', 'major-pent', 'blues-minor'], steps: [{ off: 0, q: 'maj', bars: 2 }, { off: 10, q: 'maj', bars: 1 }, { off: 5, q: 'maj', bars: 1 }] },
  { id: 'dorian-vamp', name: 'Vamp dórico', desc: 'Im7 – IV7', minor: true, style: 'funk', bpm: 96, scales: ['dorian', 'minor-pent', 'blues-minor'], steps: [{ off: 0, q: 'min7', bars: 2 }, { off: 5, q: 'dom7', bars: 2 }] },
  { id: 'ii-v-i', name: 'ii – V – I (jazz)', desc: 'IIm7 – V7 – Imaj7', minor: false, style: 'shuffle', bpm: 110, scales: ['major', 'major-pent', 'lydian'], steps: [{ off: 2, q: 'min7', bars: 1 }, { off: 7, q: 'dom7', bars: 1 }, { off: 0, q: 'maj7', bars: 2 }] },
  { id: 'ii-v-i-minor', name: 'ii – V – i (menor)', desc: 'IIm7♭5 – V7 – Im7', minor: true, style: 'shuffle', bpm: 100, scales: ['harmonic-minor', 'natural-minor', 'minor-pent'], steps: [{ off: 2, q: 'm7b5', bars: 1 }, { off: 7, q: 'dom7', bars: 1 }, { off: 0, q: 'min7', bars: 2 }] },
];

export const progById = (id: string) => PROGRESSIONS.find((p) => p.id === id) ?? PROGRESSIONS[0];

export interface JamConfig {
  prog: Progression;
  keyPc: number;
  bpm: number;
  style: StyleId;
  vol: { drums: number; bass: number; chords: number };
}

export interface ChordInstance {
  rootPc: number;
  q: Quality;
  pcs: number[];
}

export function chordOf(keyPc: number, s: ProgStep): ChordInstance {
  const rootPc = mod12(keyPc + s.off);
  return { rootPc, q: s.q, pcs: CHORD_INTERVALS[s.q].map((i) => mod12(rootPc + i)) };
}

export interface JamTick {
  seg: number;
  bar: number; // compasso dentro do ciclo
  total: number;
}

export class Jam {
  cfg: JamConfig;
  private c!: AudioContext;
  private buses!: { drums: GainNode; bass: GainNode; chords: GainNode };
  private timer: number | undefined;
  private timeouts: number[] = [];
  private step = 0;
  private next = 0;
  private master!: GainNode;

  constructor(cfg: JamConfig, private onTick: (t: JamTick) => void) {
    this.cfg = cfg;
  }

  get playing() {
    return this.timer !== undefined;
  }

  applyVolumes() {
    if (!this.buses) return;
    this.buses.drums.gain.value = this.cfg.vol.drums;
    this.buses.bass.gain.value = this.cfg.vol.bass;
    this.buses.chords.gain.value = this.cfg.vol.chords;
  }

  start() {
    if (this.playing) return;
    this.c = getCtx();
    const c = this.c;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp).connect(c.destination);
    this.buses = { drums: c.createGain(), bass: c.createGain(), chords: c.createGain() };
    Object.values(this.buses).forEach((b) => b.connect(this.master));
    this.applyVolumes();
    this.step = 0;
    this.next = c.currentTime + 0.12;
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  stop() {
    if (this.timer === undefined) return;
    clearInterval(this.timer);
    this.timer = undefined;
    this.timeouts.forEach(clearTimeout);
    this.timeouts = [];
    const m = this.master;
    m.gain.cancelScheduledValues(this.c.currentTime);
    m.gain.setTargetAtTime(0, this.c.currentTime, 0.05);
    window.setTimeout(() => m.disconnect(), 400);
  }

  private tick() {
    const stepDur = 60 / this.cfg.bpm / 4;
    while (this.next < this.c.currentTime + 0.12) {
      this.schedule(this.step, this.next, stepDur);
      this.next += stepDur;
      this.step++;
    }
  }

  private schedule(step: number, t: number, stepDur: number) {
    const { prog, keyPc, style } = this.cfg;
    const total = prog.steps.reduce((a, s) => a + s.bars, 0);
    const bar = Math.floor(step / 16) % total;
    const sib = step % 16;

    let acc = 0;
    let seg = 0;
    for (let i = 0; i < prog.steps.length; i++) {
      if (bar < acc + prog.steps[i].bars) {
        seg = i;
        break;
      }
      acc += prog.steps[i].bars;
    }
    const chord = chordOf(keyPc, prog.steps[seg]);

    if (sib === 0) {
      const delay = Math.max(0, (t - this.c.currentTime) * 1000);
      this.timeouts.push(window.setTimeout(() => this.onTick({ seg, bar, total }), delay));
      if (this.timeouts.length > 64) this.timeouts = this.timeouts.slice(-32);
    }

    const swing = style === 'shuffle' && sib % 4 === 2 ? stepDur * 0.667 : 0;
    const tt = t + swing;
    this.drums(style, sib, tt, stepDur);
    this.bass(style, sib, tt, stepDur, chord);
    this.comp(style, sib, tt, stepDur, chord);
  }

  // ---- bateria ----

  private drums(style: StyleId, sib: number, t: number, sd: number) {
    const has = (a: number[]) => a.includes(sib);
    const kick = style === 'ballad' ? [0, 10] : style === 'funk' ? [0, 3, 10] : [0, 8];
    const snare = style === 'ballad' ? [8] : [4, 12];
    if (has(kick)) this.kick(t);
    if (has(snare)) this.snare(t, 0.8);
    if (style === 'funk' && has([7, 15])) this.snare(t, 0.25);
    if (style === 'funk') this.hat(t, sib % 4 === 0 ? 0.5 : 0.25, sib === 14);
    else if (style === 'ballad') {
      if (sib % 4 === 0) this.hat(t, 0.35, false);
    } else if (sib % 2 === 0) this.hat(t, sib % 4 === 0 ? 0.45 : 0.28, false);
    void sd;
  }

  private kick(t: number) {
    const c = this.c;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g).connect(this.buses.drums);
    o.start(t);
    o.stop(t + 0.3);
  }

  private snare(t: number, level: number) {
    const c = this.c;
    const n = c.createBufferSource();
    n.buffer = noiseBuffer(c);
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1200;
    const g = c.createGain();
    g.gain.setValueAtTime(0.7 * level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(f).connect(g).connect(this.buses.drums);
    n.start(t, Math.random() * 0.5, 0.2);
    const o = c.createOscillator();
    const og = c.createGain();
    o.type = 'triangle';
    o.frequency.value = 190;
    og.gain.setValueAtTime(0.4 * level, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(og).connect(this.buses.drums);
    o.start(t);
    o.stop(t + 0.1);
  }

  private hat(t: number, level: number, open: boolean) {
    const c = this.c;
    const n = c.createBufferSource();
    n.buffer = noiseBuffer(c);
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = c.createGain();
    const len = open ? 0.18 : 0.04;
    g.gain.setValueAtTime(level * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    n.connect(f).connect(g).connect(this.buses.drums);
    n.start(t, Math.random() * 0.5, len + 0.02);
  }

  // ---- baixo ----

  private bass(style: StyleId, sib: number, t: number, sd: number, ch: ChordInstance) {
    const third = ch.q === 'min' || ch.q === 'min7' || ch.q === 'm7b5' ? 3 : 4;
    let semis: number | null = null;
    let len = sd * 1.8;
    if (style === 'rock') {
      if (sib % 2 === 0) semis = sib === 6 || sib === 14 ? 7 : 0;
    } else if (style === 'shuffle') {
      if (sib % 4 === 0) {
        semis = [0, third, 7, 9][sib / 4];
        len = sd * 3.4;
      }
    } else if (style === 'ballad') {
      if (sib === 0) {
        semis = 0;
        len = sd * 7;
      } else if (sib === 8) {
        semis = 7;
        len = sd * 7;
      }
    } else {
      const idx = [0, 3, 6, 10, 14].indexOf(sib);
      if (idx >= 0) {
        semis = [0, 0, 12, 0, 7][idx];
        len = sd * 2;
      }
    }
    if (semis === null) return;
    const midi = 28 + mod12(ch.rootPc - 4) + semis;
    const c = this.c;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = midiToFreq(midi);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(260, t + len);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(f).connect(g).connect(this.buses.bass);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  // ---- acordes ----

  private comp(style: StyleId, sib: number, t: number, sd: number, ch: ChordInstance) {
    const patterns: Record<StyleId, { at: number[]; len: number; attack: number }> = {
      rock: { at: [0, 8], len: 7, attack: 0.01 },
      shuffle: { at: [0, 4, 8, 12], len: 3, attack: 0.01 },
      ballad: { at: [0], len: 15.5, attack: 0.12 },
      funk: { at: [3, 6, 10, 15], len: 1.5, attack: 0.005 },
    };
    const p = patterns[style];
    if (!p.at.includes(sib)) return;
    const len = sd * p.len;
    const c = this.c;
    for (const pc of ch.pcs) {
      const midi = 55 + mod12(pc - 55);
      for (const type of ['triangle', 'sawtooth'] as OscillatorType[]) {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.value = midiToFreq(midi);
        o.detune.value = type === 'sawtooth' ? 7 : 0;
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = type === 'sawtooth' ? 1200 : 2400;
        const g = c.createGain();
        const peak = type === 'sawtooth' ? 0.035 : 0.09;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + p.attack);
        g.gain.exponentialRampToValueAtTime(0.001, t + len);
        o.connect(f).connect(g).connect(this.buses.chords);
        o.start(t);
        o.stop(t + len + 0.05);
      }
    }
  }
}
