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
