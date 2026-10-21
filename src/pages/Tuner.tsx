import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Chips, Field, PageHeader } from '../components/ui';
import { refTone } from '../lib/audio';
import { FFT_SIZE, explainMicError, micSupported, openMic, type Mic } from '../lib/mic';
import { TUNINGS, pcLabel, stringNumber, tuningById } from '../lib/music';
import { DEFAULT_TUNER, normalizeTuner, type TunerPrefs as Prefs } from '../lib/tuner';
import { A4_DEFAULT, A4_RANGE, IN_TUNE_CENTS, Stabilizer, centsFrom, detectPitch, inTune, midiToHz, nearestNote, nearestString, rms } from '../lib/pitch';
import { useLocalStorage, useSettings } from '../lib/storage';

const TICK_MS = 60;
const REF_SECONDS = 2;
const octave = (midi: number) => Math.floor(midi / 12) - 1;

type Status = 'idle' | 'starting' | 'on' | 'error';

/** Microfone + detecção. Para sozinho ao sair da página ou quando a aba fica oculta. */
function useMicPitch(ignoreUntil: React.MutableRefObject<number>) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [freq, setFreq] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const mic = useRef<Mic | null>(null);
  const token = useRef(0); // invalida aberturas que terminam depois de um "parar"
  const wanted = useRef(false); // o usuário quer o afinador ligado (para retomar ao voltar para a aba)
  const wake = useRef<{ release: () => Promise<void> } | null>(null);

  const releaseWake = useCallback(() => {
    void wake.current?.release().catch(() => {});
    wake.current = null;
  }, []);

  const closeMic = useCallback(() => {
    token.current++;
    mic.current?.stop();
    mic.current = null;
    releaseWake();
    setFreq(null);
    setLevel(0);
  }, [releaseWake]);

  const open = useCallback(
    async (id?: string) => {
      closeMic();
      const my = token.current;
      if (!micSupported()) {
        setStatus('error');
        setError('Este navegador ou endereço não permite usar o microfone (é preciso https ou localhost).');
        return;
      }
      setStatus('starting');
      setError('');
      try {
        const m = await openMic(id || undefined);
        if (my !== token.current) {
          m.stop(); // o usuário já desligou ou saiu da página
          return;
        }
        mic.current = m;
        setDeviceId(m.deviceId);
        setStatus('on');
        navigator.mediaDevices
          .enumerateDevices()
          .then((all) => my === token.current && setDevices(all.filter((d) => d.kind === 'audioinput')))
          .catch(() => {});
        try {
          const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
          wake.current = (await nav.wakeLock?.request('screen')) ?? null; // mantém a tela acesa enquanto afina
        } catch {
          /* sem Wake Lock: a tela pode apagar, o afinador continua */
        }
      } catch (e) {
        if (my !== token.current) return;
        setStatus('error');
        setError(explainMicError(e));
      }
    },
    [closeMic],
  );

  const start = useCallback(
    (id?: string) => {
      wanted.current = true;
      void open(id);
    },
    [open],
  );
  const stop = useCallback(() => {
    wanted.current = false;
    closeMic();
    setStatus('idle');
  }, [closeMic]);

  // laço de leitura
  useEffect(() => {
    if (status !== 'on') return;
    const stab = new Stabilizer(5, 6, 3);
    const buf = new Float32Array(FFT_SIZE);
    const id = window.setInterval(() => {
      const m = mic.current;
      if (!m) return;
      m.analyser.getFloatTimeDomainData(buf);
      setLevel(rms(buf));
      if (performance.now() < ignoreUntil.current) {
        stab.reset(); // tocando o tom de referência: não analisa o próprio alto-falante
        setFreq(null);
        return;
      }
      const p = detectPitch(buf, m.sampleRate);
      setFreq(stab.push(p && p.clarity >= 0.8 ? p.freq : null));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [status, ignoreUntil]);

  // aba oculta: solta o microfone (e volta quando a aba reaparecer)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        if (wanted.current && mic.current) closeMic();
      } else if (wanted.current && !mic.current) void open(deviceId || undefined);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [closeMic, open, deviceId]);

  useEffect(() => () => {
    wanted.current = false;
    closeMic();
  }, [closeMic]);

  return { status, error, freq, level, devices, deviceId, start, stop };
}

export function Tuner() {
  const { settings } = useSettings();
  const [raw, setRaw] = useLocalStorage<Prefs>('ss.tuner', DEFAULT_TUNER);
  const prefs = useMemo(() => normalizeTuner(raw), [raw]);
  const patch = useCallback((x: Partial<Prefs>) => setRaw((r) => ({ ...normalizeTuner(r), ...x })), [setRaw]);
  const tuning = tuningById(prefs.tuningId).midi;
  const [locked, setLocked] = useState<number | null>(null);
  const ignoreUntil = useRef(0);
  const m = useMicPitch(ignoreUntil);

  // trocou de afinação: a trava de corda deixa de valer
  useEffect(() => setLocked(null), [prefs.tuningId]);

  const label = (midi: number) => pcLabel(((midi % 12) + 12) % 12, settings.pref, settings.lang);

  // leitura atual: nota, corda-alvo e desvio
  const reading = useMemo(() => {
    if (m.freq === null) return null;
    if (prefs.mode === 'chromatic' && locked === null) {
      const n = nearestNote(m.freq, prefs.a4);
      return { midi: n.midi, cents: n.cents, string: null as number | null };
    }
    const hit = locked !== null ? { index: locked, cents: centsFrom(m.freq, tuning[locked], prefs.a4) } : nearestString(m.freq, tuning, prefs.a4);
    return { midi: tuning[hit.index], cents: hit.cents, string: hit.index };
  }, [m.freq, prefs.mode, prefs.a4, tuning, locked]);

  const cents = reading ? Math.round(reading.cents) : null;
  const ok = reading ? inTune(reading.cents) : false;
  const verdict = !reading ? 'Toque uma corda' : ok ? 'Afinado' : reading.cents < 0 ? 'Baixo: aperte a corda' : 'Alto: afrouxe a corda';

  // anuncia "afinado" para leitores de tela só quando o estado muda
  const [said, setSaid] = useState('');
  const wasOk = useRef(false);
  useEffect(() => {
    if (ok && !wasOk.current) setSaid(`Afinado: ${label(reading!.midi)}`);
    if (!ok) setSaid('');
    wasOk.current = ok;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok]);

  const playRef = (idx: number) => {
    setLocked(idx);
    ignoreUntil.current = performance.now() + (REF_SECONDS + 0.3) * 1000;
    refTone(midiToHz(tuning[idx], prefs.a4), REF_SECONDS);
  };

  const supported = micSupported();
  const levelPct = Math.min(100, Math.round(m.level * 400));

  return (
    <>
      <Link to="/exercicios" className="back">
        <Icon name="back" size={16} /> Exercícios
      </Link>
      <PageHeader eyebrow="Ferramenta" title="Afinador" sub="Toque uma corda solta e veja se está baixa, alta ou afinada. O áudio é analisado no próprio aparelho: não é gravado nem enviado, e o afinador funciona sem internet." />

      <section className="panel tuner">
        {m.status !== 'on' ? (
          <div className="tuner-start">
            <button type="button" className="btn primary big" onClick={() => m.start()} disabled={m.status === 'starting' || !supported}>
              <Icon name="ear" size={20} /> {m.status === 'starting' ? 'Abrindo o microfone…' : 'Ativar microfone'}
            </button>
            {!supported && <p className="notice err">Este navegador ou endereço não permite usar o microfone (é preciso https ou localhost).</p>}
            {m.status === 'error' && (
              <p className="notice err" role="alert">
                {m.error}
              </p>
            )}
            <p className="muted small-text">O navegador vai pedir permissão. Para um resultado melhor, use um lugar silencioso e toque uma corda de cada vez.</p>
          </div>
        ) : (
          <>
            <div className="tuner-top">
              <button type="button" className="btn danger small" onClick={m.stop}>
                <Icon name="stop" size={14} /> Desligar
              </button>
              <div className="level" role="img" aria-label={`Nível do microfone: ${levelPct}%`}>
                <span style={{ width: `${levelPct}%` }} />
              </div>
              {m.devices.length > 1 && (
                <select aria-label="Entrada de áudio" value={m.deviceId} onChange={(e) => m.start(e.target.value)}>
                  {m.devices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Entrada ${i + 1}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className={`tuner-read${reading ? (ok ? ' ok' : ' off') : ''}`} role="meter" aria-label="Afinação" aria-valuemin={-50} aria-valuemax={50} aria-valuenow={cents === null ? 0 : Math.max(-50, Math.min(50, cents))} aria-valuetext={reading ? `${label(reading.midi)}, ${verdict}, ${cents} cents` : 'Sem som'}>
              <Gauge cents={reading ? reading.cents : null} ok={ok} />
              <div className="tuner-note" aria-hidden="true">
                {reading ? (
                  <>
                    <b>{label(reading.midi)}</b>
                    <sub>{octave(reading.midi)}</sub>
                  </>
                ) : (
                  <b className="muted">–</b>
                )}
              </div>
              <div className="tuner-info" aria-hidden="true">
                <span>{reading ? `${(cents as number) > 0 ? '+' : ''}${cents} cents` : ' '}</span>
                <span className="muted">{m.freq ? `${m.freq.toFixed(1)} Hz` : ' '}</span>
                {reading?.string != null && <span className="tag">Corda {stringNumber(reading.string, tuning.length)}</span>}
              </div>
              <p className={`tuner-verdict${ok ? ' ok-text' : ''}`} aria-hidden="true">
                {ok ? '✓ ' : ''}
                {verdict}
              </p>
            </div>
          </>
        )}
        <span className="sr-only" role="status" aria-live="polite">
          {said}
        </span>
      </section>

      <section className="panel">
        <div className="row gap wrap field-row">
          <Field label="Afinação">
            <select value={prefs.tuningId} onChange={(e) => patch({ tuningId: e.target.value })}>
              {TUNINGS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Modo">
            <Chips
              small
              value={prefs.mode}
              onChange={(mode) => patch({ mode })}
              options={[
                { value: 'strings', label: 'Por corda' },
                { value: 'chromatic', label: 'Cromático' },
              ]}
            />
          </Field>
          <Field label="Lá de referência (Hz)">
            <div className="row gap">
              <button type="button" className="btn small icon" aria-label="Diminuir 1 Hz" onClick={() => patch({ a4: Math.max(A4_RANGE.min, prefs.a4 - 1) })}>
                −
              </button>
              <b className="a4-value">{prefs.a4}</b>
              <button type="button" className="btn small icon" aria-label="Aumentar 1 Hz" onClick={() => patch({ a4: Math.min(A4_RANGE.max, prefs.a4 + 1) })}>
                +
              </button>
              {prefs.a4 !== A4_DEFAULT && (
                <button type="button" className="btn small" onClick={() => patch({ a4: A4_DEFAULT })}>
                  440
                </button>
              )}
            </div>
          </Field>
        </div>

        <h3 aria-level={2} className="section-title">
          Cordas (toque para ouvir a nota)
        </h3>
        <div className="string-row" role="group" aria-label="Cordas da afinação">
          <button type="button" className={`chip${locked === null ? ' active' : ''}`} aria-pressed={locked === null} onClick={() => setLocked(null)}>
            Auto
          </button>
          {[...tuning.keys()].reverse().map((i) => (
            <button key={i} type="button" className={`chip string-chip${locked === i ? ' active' : ''}${reading?.string === i && locked === null ? ' hit' : ''}`} aria-pressed={locked === i} aria-label={`Corda ${stringNumber(i, tuning.length)}, ${label(tuning[i])}${octave(tuning[i])}: ouvir`} onClick={() => playRef(i)}>
              <small>{stringNumber(i, tuning.length)}ª</small> {label(tuning[i])}
              <sub>{octave(tuning[i])}</sub>
            </button>
          ))}
        </div>
        <p className="muted small-text">
          "Auto" escolhe sozinho a corda mais próxima do que você toca. Ao tocar numa corda acima, o afinador fixa essa corda como alvo e toca a nota de referência por {REF_SECONDS} segundos (durante o tom ele não escuta, para não analisar o próprio alto-falante).
        </p>
      </section>

      <section className="panel">
        <h3 aria-level={2} className="section-title">
          Dicas
        </h3>
        <ul className="tips">
          <li>Afine sempre subindo: se a corda passou da nota, desça um pouco abaixo e suba de novo até o centro. A afinação dura mais.</li>
          <li>Verde significa a menos de {IN_TUNE_CENTS} cents da nota: é imperceptível ao ouvido.</li>
          <li>Com o instrumento ligado em uma interface de áudio, escolha a entrada dela na lista (aparece quando há mais de um microfone).</li>
          <li>Nas cordas graves, deixe a nota soar um pouco: leva uma fração de segundo para o afinador estabilizar.</li>
        </ul>
      </section>
    </>
  );
}

// ============ Mostrador ============

/** Arco de -50 a +50 cents; o ponteiro gira até ±60°. Sem som, o ponteiro descansa no centro, apagado. */
function Gauge({ cents, ok }: { cents: number | null; ok: boolean }) {
  const cx = 150;
  const cy = 150;
  const r = 120;
  const pt = (deg: number, radius: number) => [cx + radius * Math.sin((deg * Math.PI) / 180), cy - radius * Math.cos((deg * Math.PI) / 180)] as const;
  const angle = cents === null ? 0 : (Math.max(-50, Math.min(50, cents)) / 50) * 60;
  const ticks = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];
  const [ax, ay] = pt(-60, r);
  const [bx, by] = pt(60, r);
  const [gx, gy] = pt((-IN_TUNE_CENTS / 50) * 60, r);
  const [hx, hy] = pt((IN_TUNE_CENTS / 50) * 60, r);
  return (
    <svg viewBox="0 0 300 170" className="gauge" aria-hidden="true">
      <path d={`M${ax},${ay} A${r},${r} 0 0 1 ${bx},${by}`} className="gauge-arc" />
      <path d={`M${gx},${gy} A${r},${r} 0 0 1 ${hx},${hy}`} className="gauge-zone" />
      {ticks.map((t) => {
        const deg = (t / 50) * 60;
        const [x1, y1] = pt(deg, r - (t % 50 === 0 || t === 0 ? 16 : 9));
        const [x2, y2] = pt(deg, r + 2);
        return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} className={t === 0 ? 'gauge-tick zero' : 'gauge-tick'} />;
      })}
      <text x={pt(-60, r + 18)[0]} y={pt(-60, r + 18)[1]} className="gauge-sign" textAnchor="middle">
        ♭
      </text>
      <text x={pt(60, r + 18)[0]} y={pt(60, r + 18)[1]} className="gauge-sign" textAnchor="middle">
        ♯
      </text>
      <g className={`gauge-needle${cents === null ? ' idle' : ok ? ' ok' : ''}`} style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
        <line x1={cx} y1={cy} x2={cx} y2={cy - r + 10} />
        <circle cx={cx} cy={cy} r={7} />
      </g>
    </svg>
  );
}
