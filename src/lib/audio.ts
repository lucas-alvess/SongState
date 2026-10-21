let ctx: AudioContext | null = null;

export function getCtx(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

let noiseBuf: AudioBuffer | null = null;
export function noiseBuffer(c: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

export function click(c: AudioContext, dest: AudioNode, t: number, accent: boolean, vol = 0.6) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.value = accent ? 1600 : 1000;
  o.type = 'square';
  g.gain.setValueAtTime(vol * 0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.06);
}

/** Nota dedilhada de guitarra (síntese simples: dente de serra filtrado com decaimento). */
export function pluck(c: AudioContext, midi: number, t: number, vol = 0.35, dest: AudioNode = c.destination) {
  const f = midiToFreq(midi);
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(6000, f * 9), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.5), t + 0.9);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0005, t + 1.8);
  lp.connect(g).connect(dest);
  for (const [type, detune, level] of [['sawtooth', 0, 0.6], ['triangle', 4, 0.8]] as [OscillatorType, number, number][]) {
    const o = c.createOscillator();
    const og = c.createGain();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    og.gain.value = level;
    o.connect(og).connect(lp);
    o.start(t);
    o.stop(t + 1.9);
  }
}

/** Toca várias notas em sequência rápida (como um acorde dedilhado) ou todas juntas (gap = 0). */
export function strum(midis: number[], gap = 0.045, vol = 0.28) {
  const c = getCtx();
  const t = c.currentTime + 0.02;
  midis.forEach((m, i) => pluck(c, m, t + i * gap, vol));
}
