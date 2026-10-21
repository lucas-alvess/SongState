import { useEffect, useRef, useState } from 'react';
import { click, getCtx } from '../lib/audio';

export function Metronome({ initialBpm = 80 }: { initialBpm?: number }) {
  const [bpm, setBpm] = useState(initialBpm);
  const [beats, setBeats] = useState(4);
  const [on, setOn] = useState(false);
  const [beat, setBeat] = useState(-1);
  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beats);
  const taps = useRef<number[]>([]);
  bpmRef.current = bpm;
  beatsRef.current = beats;

  useEffect(() => {
    if (!on) {
      setBeat(-1);
      return;
    }
    const c = getCtx();
    let next = c.currentTime + 0.08;
    let i = 0;
    const timeouts: number[] = [];
    const tick = () => {
      while (next < c.currentTime + 0.15) {
        const idx = i % beatsRef.current;
        click(c, c.destination, next, idx === 0);
        timeouts.push(window.setTimeout(() => setBeat(idx), Math.max(0, (next - c.currentTime) * 1000)));
        next += 60 / bpmRef.current;
        i++;
      }
    };
    tick();
    const id = window.setInterval(tick, 25);
    return () => {
      clearInterval(id);
      timeouts.forEach(clearTimeout);
    };
  }, [on]);

  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 2500), now];
    if (taps.current.length >= 2) {
      const d = (taps.current[taps.current.length - 1] - taps.current[0]) / (taps.current.length - 1);
      setBpm(Math.min(240, Math.max(30, Math.round(60000 / d))));
    }
  };

  return (
    <div className="panel metronome">
      <div className="metro-head">
        <h3>Metrônomo</h3>
        <div className="beat-dots">
          {Array.from({ length: beats }, (_, i) => (
            <span key={i} className={`beat-dot${beat === i ? ' on' : ''}${i === 0 ? ' first' : ''}`} />
          ))}
        </div>
      </div>
      <div className="metro-bpm">
        <button type="button" className="btn icon" onClick={() => setBpm((b) => Math.max(30, b - 1))}>
          −
        </button>
        <div className="bpm-num">
          {bpm}
          <small>BPM</small>
        </div>
        <button type="button" className="btn icon" onClick={() => setBpm((b) => Math.min(240, b + 1))}>
          +
        </button>
      </div>
      <input type="range" aria-label="Andamento em BPM" min={30} max={240} value={bpm} onChange={(e) => setBpm(+e.target.value)} />
      <div className="row gap">
        <button type="button" className={`btn ${on ? 'danger' : 'primary'}`} onClick={() => setOn(!on)}>
          {on ? 'Parar' : 'Iniciar'}
        </button>
        <button type="button" className="btn" onClick={tap}>
          Tap
        </button>
        <select value={beats} onChange={(e) => setBeats(+e.target.value)} aria-label="Compasso">
          {[2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              {n}/4
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
