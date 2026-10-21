import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Fretboard, type Marker } from './Fretboard';
import { Icon } from './Icon';
import { useBoardEnv } from './quiz';
import { getCtx, pluck, strum } from '../lib/audio';
import { chordFullName, chordSymbol, detectChords } from '../lib/chords';
import { mod12, pcLabel } from '../lib/music';
import { STANDARD_MIDI, midiAt, playableOf, type Playable } from '../lib/tabs';

type Tab = Extract<Playable, { kind: 'tab' }>;
type ChordShape = Extract<Playable, { kind: 'chord' }>;

/** Bloco de exemplo de uma lição: o texto de sempre e, se for tablatura ou acorde, os botões para ouvir e ver no braço. */
export function LessonExample({ title, text, bpm }: { title?: string; text: string; bpm: number }) {
  const play = useMemo(() => playableOf(text), [text]);
  return (
    <section className="panel example">
      {title && (
        <h3 aria-level={2} className="example-title">
          {title}
        </h3>
      )}
      <pre tabIndex={0} role="region" aria-label={title ?? 'Exemplo'}>
        {text}
      </pre>
      {play?.kind === 'tab' && <TabPlayer tab={play} startBpm={bpm} />}
      {play?.kind === 'chord' && <ChordPlayer shape={play} />}
    </section>
  );
}

const clampBpm = (n: number) => Math.min(200, Math.max(30, Math.round(n) || 60));

function TabPlayer({ tab, startBpm }: { tab: Tab; startBpm: number }) {
  const env = useBoardEnv();
  const [bpm, setBpm] = useState(clampBpm(startBpm));
  const [loop, setLoop] = useState(false);
  const [idx, setIdx] = useState(-1); // passo em destaque (-1 = parado)
  const timer = useRef(0);
  const live = useRef({ bpm, loop });
  live.current = { bpm, loop };

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    setIdx(-1);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => stop, [tab, stop]); // trocou o exemplo: para

  const start = useCallback(() => {
    clearTimeout(timer.current);
    const c = getCtx();
    let i = 0;
    let target = performance.now();
    const tick = () => {
      const step = tab.steps[i];
      step.notes.forEach((n, k) => pluck(c, midiAt(n.string, n.fret), c.currentTime + 0.01 + k * 0.012, n.legato ? 0.22 : 0.34));
      setIdx(i);
      const dt = 30000 / live.current.bpm; // colcheias: 2 notas por tempo
      target += dt;
      i++;
      if (i >= tab.steps.length) {
        if (!live.current.loop) {
          timer.current = window.setTimeout(() => setIdx(-1), dt); // deixa o último destaque pela duração da nota
          return;
        }
        i = 0;
      }
      timer.current = window.setTimeout(tick, Math.max(0, target - performance.now()));
    };
    tick();
  }, [tab]);

  // todas as notas do exemplo aparecem com o número da casa; as do passo atual, em destaque
  const markers = useMemo<Marker[]>(() => {
    const byCell = new Map<string, Marker>();
    tab.steps.forEach((s) => s.notes.forEach((n) => byCell.set(`${n.string}:${n.fret}`, { string: n.string, fret: n.fret, kind: 'scale', label: String(n.fret) })));
    if (idx >= 0) tab.steps[idx]?.notes.forEach((n) => byCell.set(`${n.string}:${n.fret}`, { string: n.string, fret: n.fret, kind: 'chord', label: String(n.fret) }));
    return [...byCell.values()];
  }, [tab, idx]);

  const playing = idx >= 0;
  return (
    <div className="lesson-player">
      <div className="row gap wrap">
        <button type="button" className="btn primary small" onClick={playing ? stop : start}>
          <Icon name={playing ? 'stop' : 'play'} size={14} /> {playing ? 'Parar' : 'Tocar'}
        </button>
        <label className="inline">
          Andamento
          <input type="number" min={30} max={200} value={bpm} onChange={(e) => setBpm(clampBpm(+e.target.value))} aria-label="Andamento em BPM" style={{ width: 72 }} />
          BPM
        </label>
        <label className="inline">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Repetir
        </label>
        <span className="muted small-text" aria-live="off">
          {playing ? `nota ${idx + 1} de ${tab.steps.length}` : `${tab.steps.length} passos, colcheias`}
        </span>
      </div>
      <div className="board-wrap">
        <div className="board-scroll">
          <Fretboard tuning={STANDARD_MIDI} fretMax={Math.min(24, Math.max(5, tab.maxFret + 1))} vertical={env.vertical} leftHanded={env.leftHanded} markers={markers} />
        </div>
      </div>
    </div>
  );
}

function ChordPlayer({ shape }: { shape: ChordShape }) {
  const env = useBoardEnv();
  const midis = useMemo(() => shape.frets.flatMap((f, s) => (f >= 0 ? [midiAt(s, f)] : [])), [shape]);
  const pcs = useMemo(() => midis.map(mod12), [midis]);
  const best = useMemo(() => detectChords(pcs, mod12(midis[0]))[0], [pcs, midis]);
  const markers = useMemo<Marker[]>(
    () => shape.frets.flatMap((f, s) => (f >= 0 ? [{ string: s, fret: f, kind: best && mod12(midiAt(s, f)) === best.rootPc ? ('root' as const) : ('chord' as const), label: pcLabel(mod12(midiAt(s, f)), env.pref, env.lang) }] : [])),
    [shape, best, env.pref, env.lang],
  );
  const name = best ? `${chordSymbol(best.rootPc, best.type, best.bassPc, env.pref)} · ${chordFullName(best.rootPc, best.type, best.bassPc, env.pref)}` : null;
  const maxFret = Math.max(...shape.frets);
  return (
    <div className="lesson-player">
      <div className="row gap wrap">
        <button type="button" className="btn primary small" onClick={() => strum(midis, 0.045, 0.28)}>
          <Icon name="volume" size={14} /> Tocar acorde
        </button>
        <button type="button" className="btn small" onClick={() => strum(midis, 0.26, 0.3)}>
          <Icon name="play" size={14} /> Dedilhar nota a nota
        </button>
        {name && <b className="chord-name-inline">{name}</b>}
      </div>
      <div className="board-wrap">
        <div className="board-scroll">
          <Fretboard tuning={STANDARD_MIDI} fretMax={Math.min(24, Math.max(5, maxFret + 1))} vertical={env.vertical} leftHanded={env.leftHanded} markers={markers} stringsOff={shape.frets.flatMap((f, s) => (f < 0 ? [s] : []))} />
        </div>
      </div>
    </div>
  );
}
