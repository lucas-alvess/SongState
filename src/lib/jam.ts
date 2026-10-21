import { click, getCtx, midiToFreq, noiseBuffer } from './audio';
import { mod12 } from './music';
import { chordPcs, chordHasMinorThird, chordSymbol, chordTypeById } from './chords';
import type { AccPref } from './music';

export type StyleId = 'rock' | 'shuffle' | 'ballad' | 'funk';

export interface ProgStep {
  off: number;
  q: string; // id do tipo de acorde (chords.ts)
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
  { id: 'blues-major', name: 'Blues 12 compassos (maior)', desc: 'I7 – IV7 – V7', minor: false, style: 'shuffle', bpm: 100, scales: ['blues-minor', 'minor-pent', 'mixolydian', 'major-pent'], steps: [{ off: 0, q: '7', bars: 4 }, { off: 5, q: '7', bars: 2 }, { off: 0, q: '7', bars: 2 }, { off: 7, q: '7', bars: 1 }, { off: 5, q: '7', bars: 1 }, { off: 0, q: '7', bars: 1 }, { off: 7, q: '7', bars: 1 }] },
  { id: 'blues-minor', name: 'Blues menor 12 compassos', desc: 'Im7 – IVm7 – V7', minor: true, style: 'shuffle', bpm: 80, scales: ['blues-minor', 'minor-pent', 'dorian', 'natural-minor'], steps: [{ off: 0, q: 'm7', bars: 4 }, { off: 5, q: 'm7', bars: 2 }, { off: 0, q: 'm7', bars: 2 }, { off: 7, q: '7', bars: 1 }, { off: 5, q: 'm7', bars: 1 }, { off: 0, q: 'm7', bars: 1 }, { off: 7, q: '7', bars: 1 }] },
  { id: 'rock-minor', name: 'Rock menor', desc: 'i – ♭VI – ♭VII', minor: true, style: 'rock', bpm: 110, scales: ['minor-pent', 'natural-minor', 'blues-minor'], steps: [{ off: 0, q: 'min', bars: 2 }, { off: 8, q: 'maj', bars: 1 }, { off: 10, q: 'maj', bars: 1 }] },
  { id: 'andalusian', name: 'Cadência andaluza', desc: 'i – ♭VII – ♭VI – V', minor: true, style: 'rock', bpm: 100, scales: ['minor-pent', 'natural-minor', 'harmonic-minor'], steps: [{ off: 0, q: 'min', bars: 1 }, { off: 10, q: 'maj', bars: 1 }, { off: 8, q: 'maj', bars: 1 }, { off: 7, q: 'maj', bars: 1 }] },
  { id: 'minor-emotional', name: 'Balada menor', desc: 'i – ♭VI – ♭III – ♭VII', minor: true, style: 'ballad', bpm: 72, scales: ['natural-minor', 'minor-pent', 'dorian'], steps: [{ off: 0, q: 'min', bars: 1 }, { off: 8, q: 'maj', bars: 1 }, { off: 3, q: 'maj', bars: 1 }, { off: 10, q: 'maj', bars: 1 }] },
  { id: 'pop', name: 'Pop clássico', desc: 'I – V – vi – IV', minor: false, style: 'rock', bpm: 100, scales: ['major-pent', 'major', 'lydian'], steps: [{ off: 0, q: 'maj', bars: 1 }, { off: 7, q: 'maj', bars: 1 }, { off: 9, q: 'min', bars: 1 }, { off: 5, q: 'maj', bars: 1 }] },
  { id: 'folk', name: 'Folk / Country', desc: 'I – IV – V – I', minor: false, style: 'rock', bpm: 110, scales: ['major-pent', 'major', 'mixolydian'], steps: [{ off: 0, q: 'maj', bars: 1 }, { off: 5, q: 'maj', bars: 1 }, { off: 7, q: 'maj', bars: 1 }, { off: 0, q: 'maj', bars: 1 }] },
  { id: 'rock-mixo', name: 'Rock mixolídio', desc: 'I – ♭VII – IV', minor: false, style: 'rock', bpm: 120, scales: ['mixolydian', 'major-pent', 'blues-minor'], steps: [{ off: 0, q: 'maj', bars: 2 }, { off: 10, q: 'maj', bars: 1 }, { off: 5, q: 'maj', bars: 1 }] },
  { id: 'dorian-vamp', name: 'Vamp dórico', desc: 'Im7 – IV7', minor: true, style: 'funk', bpm: 96, scales: ['dorian', 'minor-pent', 'blues-minor'], steps: [{ off: 0, q: 'm7', bars: 2 }, { off: 5, q: '7', bars: 2 }] },
  { id: 'ii-v-i', name: 'ii – V – I (jazz)', desc: 'IIm7 – V7 – Imaj7', minor: false, style: 'shuffle', bpm: 110, scales: ['major', 'major-pent', 'lydian'], steps: [{ off: 2, q: 'm7', bars: 1 }, { off: 7, q: '7', bars: 1 }, { off: 0, q: 'maj7', bars: 2 }] },
  { id: 'ii-v-i-minor', name: 'ii – V – i (menor)', desc: 'IIm7♭5 – V7 – Im7', minor: true, style: 'shuffle', bpm: 100, scales: ['harmonic-minor', 'natural-minor', 'minor-pent'], steps: [{ off: 2, q: 'm7b5', bars: 1 }, { off: 7, q: '7', bars: 1 }, { off: 0, q: 'm7', bars: 2 }] },
];

export const progById = (id: string) => PROGRESSIONS.find((p) => p.id === id) ?? PROGRESSIONS[0];

/** Um acorde na linha do tempo (len em semicolcheias; 16 = 1 compasso). */
export interface Slot {
  rootPc: number;
  bassPc: number;
  typeId: string;
  pcs: number[];
  minor: boolean;
  label: string;
  len: number;
  bar: number;
}

export function makeSlot(rootPc: number, bassPc: number, typeId: string, len: number, bar: number, label: string): Slot {
  return { rootPc: mod12(rootPc), bassPc: mod12(bassPc), typeId, pcs: chordPcs(rootPc, typeId), minor: chordHasMinorThird(typeId), label, len, bar };
}

export function progressionTimeline(prog: Progression, keyPc: number, pref: AccPref): Slot[] {
  const out: Slot[] = [];
  let bar = 0;
  for (const st of prog.steps) {
    const root = mod12(keyPc + st.off);
    const label = chordSymbol(root, chordTypeById(st.q), root, pref);
    for (let b = 0; b < st.bars; b++) out.push(makeSlot(root, root, st.q, 16, bar++, label));
  }
  return out;
}

export function transposeSlots(slots: Slot[], semis: number, pref: AccPref): Slot[] {
  if (!semis) return slots;
  return slots.map((s) => {
    const root = mod12(s.rootPc + semis);
    const bass = mod12(s.bassPc + semis);
    return makeSlot(root, bass, s.typeId, s.len, s.bar, chordSymbol(root, chordTypeById(s.typeId), bass, pref));
  });
}

export interface JamConfig {
  timeline: Slot[];
  bpm: number;
  style: StyleId;
  vol: { drums: number; bass: number; chords: number };
}

export interface JamTick {
  slot: number; // -1 durante a contagem
  bar: number;
  count?: number; // batida da contagem (1-4)
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
  private resumeAt = 0; // passo em que a música começa após a contagem

  constructor(
    cfg: JamConfig,
    private onTick: (t: JamTick) => void,
  ) {
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

  start(countIn = false, fromSlot = 0) {
    if (this.playing || !this.cfg.timeline.length) return;
    this.c = getCtx();
    const c = this.c;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp).connect(c.destination);
    this.buses = { drums: c.createGain(), bass: c.createGain(), chords: c.createGain() };
    Object.values(this.buses).forEach((b) => b.connect(this.master));
    this.applyVolumes();
    const from = this.slotStart(fromSlot);
    this.step = countIn ? -16 : from;
    this.resumeAt = from;
    this.next = c.currentTime + 0.12;
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  /** Pula para um acorde enquanto toca. */
  seek(slot: number) {
    if (this.playing && this.step >= 0) this.step = this.slotStart(slot);
  }

  private slotStart(i: number) {
    let acc = 0;
    for (let k = 0; k < i && k < this.cfg.timeline.length; k++) acc += this.cfg.timeline[k].len;
    return acc;
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
      if (this.step === 0 && this.resumeAt) this.step = this.resumeAt;
    }
  }

  private later(t: number, fn: () => void) {
    this.timeouts.push(window.setTimeout(fn, Math.max(0, (t - this.c.currentTime) * 1000)));
    if (this.timeouts.length > 64) this.timeouts = this.timeouts.slice(-32);
  }

  private schedule(step: number, t: number, stepDur: number) {
    const { timeline, style } = this.cfg;
    if (step < 0) {
      if ((step + 16) % 4 === 0) {
        const beat = (step + 16) / 4;
        click(this.c, this.master, t, beat === 0, 0.8);
        this.later(t, () => this.onTick({ slot: -1, bar: 0, count: beat + 1 }));
      }
      return;
    }
    const total = timeline.reduce((a, s) => a + s.len, 0);
    if (!total) return;
    const pos = step % total;
    let acc = 0;
    let idx = 0;
    for (; idx < timeline.length - 1; idx++) {
      if (pos < acc + timeline[idx].len) break;
      acc += timeline[idx].len;
    }
    const slot = timeline[idx];
    const isStart = pos === acc;
    if (isStart) this.later(t, () => this.onTick({ slot: idx, bar: slot.bar }));

    const sib = pos % 16;
    const swing = style === 'shuffle' && sib % 4 === 2 ? stepDur * 0.667 : 0;
    const tt = t + swing;
    this.drums(style, sib, tt);
    this.bass(style, sib, tt, stepDur, slot, isStart && sib !== 0);
    this.comp(style, sib, tt, stepDur, slot, isStart && sib !== 0);
  }

  // ---- bateria ----

  private drums(style: StyleId, sib: number, t: number) {
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

  private bass(style: StyleId, sib: number, t: number, sd: number, ch: Slot, change: boolean) {
    const third = ch.minor ? 3 : 4;
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
    if (semis === null && change) semis = 0; // troca de acorde no meio do compasso
    if (semis === null) return;
    // a nota "tônica" do padrão usa o baixo do acorde (C/E toca E)
    const pc = semis === 0 || semis === 12 ? ch.bassPc : mod12(ch.rootPc + semis);
    const midi = 28 + mod12(pc - 4) + (semis === 12 ? 12 : 0);
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

  private comp(style: StyleId, sib: number, t: number, sd: number, ch: Slot, change: boolean) {
    const patterns: Record<StyleId, { at: number[]; len: number; attack: number }> = {
      rock: { at: [0, 8], len: 7, attack: 0.01 },
      shuffle: { at: [0, 4, 8, 12], len: 3, attack: 0.01 },
      ballad: { at: [0], len: 15.5, attack: 0.12 },
      funk: { at: [3, 6, 10, 15], len: 1.5, attack: 0.005 },
    };
    const p = patterns[style];
    if (!p.at.includes(sib) && !change) return;
    const len = sd * Math.min(p.len, Math.max(2, ch.len));
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
        const peak = (type === 'sawtooth' ? 0.035 : 0.09) * (ch.pcs.length > 4 ? 0.8 : 1);
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
