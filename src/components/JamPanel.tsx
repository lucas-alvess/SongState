import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_BOARD, ScaleBoard, type BoardState } from './ScaleBoard';
import { Chips, Field, Toggle } from './ui';
import { CHORD_SUFFIX, Jam, PROGRESSIONS, STYLES, chordOf, progById, type JamTick, type StyleId } from '../lib/jam';
import { pcLabel } from '../lib/music';
import { useLocalStorage, useSettings } from '../lib/storage';

interface JamState {
  progId: string;
  keyPc: number;
  bpm: number;
  style: StyleId;
  vol: { drums: number; bass: number; chords: number };
  overlay: boolean;
}

const DEFAULT_JAM: JamState = { progId: 'blues-minor', keyPc: 9, bpm: 80, style: 'shuffle', vol: { drums: 0.8, bass: 0.8, chords: 0.7 }, overlay: true };

export function JamPanel() {
  const { settings } = useSettings();
  const [st, setSt] = useLocalStorage<JamState>('ss.jam', DEFAULT_JAM);
  const prog = progById(st.progId);
  const [tick, setTick] = useState<JamTick | null>(null);
  const [playing, setPlaying] = useState(false);
  const [board, setBoardRaw] = useState<BoardState>({ ...DEFAULT_BOARD, root: st.keyPc, scaleId: prog.scales[0], fretMax: 15, label: 'note' });
  const engine = useRef<Jam | null>(null);

  const cfg = useMemo(() => ({ prog, keyPc: st.keyPc, bpm: st.bpm, style: st.style, vol: st.vol }), [prog, st.keyPc, st.bpm, st.style, st.vol]);
  if (!engine.current) engine.current = new Jam(cfg, setTick);
  useEffect(() => {
    engine.current!.cfg = cfg;
    engine.current!.applyVolumes();
  }, [cfg]);
  useEffect(() => () => engine.current?.stop(), []);

  const toggle = () => {
    const e = engine.current!;
    if (e.playing) {
      e.stop();
      setPlaying(false);
      setTick(null);
    } else {
      e.start();
      setPlaying(true);
    }
  };

  const setBoard = useCallback(
    (p: Partial<BoardState>) => {
      if (p.root !== undefined) setSt((s) => ({ ...s, keyPc: p.root! }));
      setBoardRaw((b) => ({ ...b, ...p }));
    },
    [setSt],
  );

  const pickProg = (id: string) => {
    const p = progById(id);
    setSt((s) => ({ ...s, progId: id, bpm: p.bpm, style: p.style }));
    setBoardRaw((b) => ({ ...b, scaleId: p.scales[0], pos: null }));
  };

  const chords = prog.steps.map((s) => ({ ...s, chord: chordOf(st.keyPc, s) }));
  const cur = tick ? chords[tick.seg] : null;
  const nxt = tick ? chords[(tick.seg + 1) % chords.length] : null;
  const name = (c: (typeof chords)[number]) => pcLabel(c.chord.rootPc, settings.pref, settings.lang) + CHORD_SUFFIX[c.q];

  return (
    <div className="jam">
      <section className="panel jam-main">
        <div className="jam-now">
          <div className="now-chord">{cur ? name(cur) : '—'}</div>
          <div className="muted">{nxt ? `próximo: ${name(nxt)}` : 'Pressione play'}</div>
          {tick && <div className="bar"><i style={{ width: `${((tick.bar + 1) / tick.total) * 100}%` }} /></div>}
        </div>
        <button type="button" className={`btn big ${playing ? 'danger' : 'primary'}`} onClick={toggle}>
          {playing ? '■ Parar' : '▶ Tocar'}
        </button>
      </section>

      <section className="panel">
        <Field label="Progressão">
          <select value={st.progId} onChange={(e) => pickProg(e.target.value)}>
            {PROGRESSIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.desc}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Tom (${prog.minor ? 'menor' : 'maior'})`}>
          <Chips
            small
            value={st.keyPc}
            onChange={(keyPc) => {
              setSt((s) => ({ ...s, keyPc }));
              setBoardRaw((b) => ({ ...b, root: keyPc }));
            }}
            options={Array.from({ length: 12 }, (_, pc) => ({ value: pc, label: pcLabel(pc, settings.pref, settings.lang) }))}
          />
        </Field>
        <div className="chord-strip">
          {chords.map((c, i) => (
            <div key={i} className={`chord-cell${tick?.seg === i ? ' on' : ''}`} style={{ flex: c.bars }}>
              <b>{name(c)}</b>
              <small>{c.bars} comp.</small>
            </div>
          ))}
        </div>
        <div className="row gap wrap">
          <Field label={`Andamento: ${st.bpm} BPM`}>
            <input type="range" min={50} max={180} value={st.bpm} onChange={(e) => setSt((s) => ({ ...s, bpm: +e.target.value }))} />
          </Field>
          <Field label="Estilo">
            <select value={st.style} onChange={(e) => setSt((s) => ({ ...s, style: e.target.value as StyleId }))}>
              {STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <details>
          <summary>Mixer</summary>
          {(['drums', 'bass', 'chords'] as const).map((k) => (
            <Field key={k} label={{ drums: 'Bateria', bass: 'Baixo', chords: 'Acordes' }[k]}>
              <input type="range" min={0} max={1} step={0.05} value={st.vol[k]} onChange={(e) => setSt((s) => ({ ...s, vol: { ...s.vol, [k]: +e.target.value } }))} />
            </Field>
          ))}
        </details>
      </section>

      <section>
        <h3 className="section-title">Escalas para solar</h3>
        <Toggle label="Mostrar notas do acorde atual no braço (âmbar)" checked={st.overlay} onChange={(overlay) => setSt((s) => ({ ...s, overlay }))} />
        <ScaleBoard state={{ ...board, root: st.keyPc }} setState={setBoard} chordPcs={st.overlay && cur ? cur.chord.pcs : undefined} scaleIds={prog.scales} advanced={false} />
      </section>
    </div>
  );
}
