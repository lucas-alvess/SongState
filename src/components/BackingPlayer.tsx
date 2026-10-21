import { useEffect, useMemo, useRef, useState } from 'react';
import { Field, Toggle } from './ui';
import { Icon } from './Icon';
import { getCtx } from '../lib/audio';
import { Jam, STYLES, transposeSlots, type JamTick, type Slot, type StyleId } from '../lib/jam';
import { pcLabel, type AccPref } from '../lib/music';
import { useLocalStorage, useSettings } from '../lib/storage';

interface Mix {
  drums: number;
  bass: number;
  chords: number;
  countIn: boolean;
}
const DEFAULT_MIX: Mix = { drums: 0.8, bass: 0.8, chords: 0.7, countIn: true };

export interface PlayerState {
  slot: Slot | null;
  shift: number;
}

/** Avisos de início e fim da base, para quem grava junto (a gravação precisa começar no mesmo instante). */
export type TransportEvent =
  | { type: 'start'; startTime: number; musicStart: number; countIn: boolean; fromSlot: number; bpm: number; style: StyleId; vol: { drums: number; bass: number; chords: number }; slots: Slot[] }
  | { type: 'stop' };

interface Props {
  slots: Slot[];
  defaultBpm: number;
  defaultStyle: StyleId;
  keyPc?: number | null;
  minor?: boolean;
  pref: AccPref;
  onState?: (s: PlayerState) => void;
  onTransport?: (e: TransportEvent) => void;
  /** troca de música/progressão: reinicia andamento, estilo e transposição */
  resetKey?: string;
}

export function BackingPlayer({ slots, defaultBpm, defaultStyle, keyPc, minor, pref, onState, onTransport, resetKey }: Props) {
  const { settings } = useSettings();
  const [mix, setMix] = useLocalStorage<Mix>('ss.mix', DEFAULT_MIX);
  const [bpm, setBpm] = useState(defaultBpm);
  const [style, setStyle] = useState<StyleId>(defaultStyle);
  const [shift, setShift] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tick, setTick] = useState<JamTick | null>(null);
  const [startSlot, setStartSlot] = useState(0);
  const engine = useRef<Jam | null>(null);

  useEffect(() => {
    setBpm(defaultBpm);
    setStyle(defaultStyle);
    setShift(0);
    setStartSlot(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const timeline = useMemo(() => transposeSlots(slots, shift, pref), [slots, shift, pref]);
  const cfg = useMemo(() => ({ timeline, bpm, style, vol: { drums: mix.drums, bass: mix.bass, chords: mix.chords } }), [timeline, bpm, style, mix.drums, mix.bass, mix.chords]);

  if (!engine.current) engine.current = new Jam(cfg, setTick);
  useEffect(() => {
    engine.current!.cfg = cfg;
    engine.current!.applyVolumes();
  }, [cfg]);
  useEffect(() => () => engine.current?.stop(), []);

  const cur = tick && tick.slot >= 0 ? timeline[tick.slot] ?? null : null;
  useEffect(() => {
    onState?.({ slot: playing ? cur : null, shift });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, playing, shift]);

  const toggle = () => {
    const e = engine.current!;
    if (e.playing) {
      e.stop();
      setPlaying(false);
      setTick(null);
      onTransport?.({ type: 'stop' });
    } else {
      const startTime = getCtx().currentTime;
      e.start(mix.countIn, startSlot);
      setPlaying(true);
      onTransport?.({ type: 'start', startTime, musicStart: e.musicStartTime ?? startTime + 0.12, countIn: mix.countIn, fromSlot: startSlot, bpm, style, vol: { drums: mix.drums, bass: mix.bass, chords: mix.chords }, slots: timeline });
    }
  };

  const jump = (slot: number) => {
    setStartSlot(slot);
    if (engine.current?.playing) engine.current.seek(slot);
  };

  const bars = useMemo(() => {
    const out: { bar: number; items: { slot: Slot; index: number }[] }[] = [];
    timeline.forEach((slot, index) => {
      const last = out[out.length - 1];
      if (last && last.bar === slot.bar) last.items.push({ slot, index });
      else out.push({ bar: slot.bar, items: [{ slot, index }] });
    });
    return out;
  }, [timeline]);

  const next = cur && tick ? timeline[(tick.slot + 1) % timeline.length] : null;
  const counting = tick && tick.slot < 0 ? tick.count : null;
  const keyLabel = keyPc !== null && keyPc !== undefined ? pcLabel(keyPc + shift, pref, settings.lang) + (minor ? 'm' : '') : null;

  return (
    <div className="bp panel">
      <div className="bp-top">
        <div className="bp-now">
          <div className="bp-chord">{counting ? <span className="bp-count">{counting}</span> : cur ? cur.label : '—'}</div>
          <div className="muted">
            {counting ? 'Contagem…' : next ? `próximo: ${next.label}` : playing ? '' : timeline.length ? 'Pronto para tocar' : 'Sem acordes'}
          </div>
        </div>
        <button type="button" className={`btn big ${playing ? 'danger' : 'primary'}`} onClick={toggle} disabled={!timeline.length}>
          <Icon name={playing ? 'stop' : 'play'} size={20} /> {playing ? 'Parar' : 'Tocar'}
        </button>
      </div>

      <div className="bp-grid">
        {bars.map((b) => (
          <div key={b.bar} className={`bp-bar${startSlot !== 0 && b.items.some((i) => i.index === startSlot) && !playing ? ' start' : ''}`}>
            <span className="bp-barno">{b.bar + 1}</span>
            {b.items.map(({ slot, index }) => (
              <button key={index} type="button" className={`bp-chordcell${tick?.slot === index ? ' on' : ''}`} onClick={() => jump(index)} title="Começar daqui">
                {slot.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="bp-controls">
        <Field label={`Andamento · ${bpm} BPM`}>
          <input type="range" min={40} max={220} value={bpm} onChange={(e) => setBpm(+e.target.value)} />
        </Field>
        <Field label="Estilo">
          <select value={style} onChange={(e) => setStyle(e.target.value as StyleId)}>
            {STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={keyLabel ? `Tom · ${keyLabel}` : 'Transpor'}>
          <div className="stepper">
            <button type="button" className="btn small" onClick={() => setShift((s) => (s <= -11 ? 0 : s - 1))} aria-label="Descer um semitom">
              ♭
            </button>
            <span>{shift > 0 ? `+${shift}` : shift} st</span>
            <button type="button" className="btn small" onClick={() => setShift((s) => (s >= 11 ? 0 : s + 1))} aria-label="Subir um semitom">
              ♯
            </button>
          </div>
        </Field>
      </div>

      <div className="bp-foot">
        <Toggle label="Contagem de 1 compasso" checked={mix.countIn} onChange={(countIn) => setMix({ ...mix, countIn })} />
        <details className="bp-mixer">
          <summary>Mixer</summary>
          <div className="bp-mix-grid">
            {(['drums', 'bass', 'chords'] as const).map((k) => (
              <Field key={k} label={{ drums: 'Bateria', bass: 'Baixo', chords: 'Acordes' }[k]}>
                <input type="range" min={0} max={1} step={0.05} value={mix[k]} onChange={(e) => setMix({ ...mix, [k]: +e.target.value })} />
              </Field>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
