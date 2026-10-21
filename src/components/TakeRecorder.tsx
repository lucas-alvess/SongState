import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TransportEvent } from './BackingPlayer';
import { Icon } from './Icon';
import { LoopLibrary } from './LoopLibrary';
import { Looper } from '../lib/looper';
import { DEFAULT_LOOPER, normalizeLooper, type LooperPrefs } from '../lib/looper-prefs';
import { MAX_LOOPS, MAX_TAKE_SECONDS, fmtDuration, newLoopId, sanitizeLoops, writeLoop, type LoopMeta, type TakeInfo } from '../lib/loops';
import { explainMicError, micSupported } from '../lib/mic';
import { openRecorder, type Recorder } from '../lib/recorder';
import { useLocalStorage, useStoredList } from '../lib/storage';
import { playTake, slotsToTuples, type TakePlayback } from '../lib/take';

type Phase = 'off' | 'opening' | 'armed' | 'recording' | 'processing' | 'review';

interface Pending {
  samples: Float32Array;
  sampleRate: number;
  take: TakeInfo;
}

/** Grava o instrumento junto com a base da música e guarda a gravação para ouvir depois, junto com a base. */
export function TakeRecorder({ songId, title, event }: { songId: string; title: string; event: (TransportEvent & { n: number }) | null }) {
  const [rawPrefs] = useLocalStorage<LooperPrefs>('ss.looper', DEFAULT_LOOPER);
  const prefs = useMemo(() => normalizeLooper(rawPrefs), [rawPrefs]);
  const [rawLoops, setLoops] = useStoredList<LoopMeta>('ss.loops');
  const loops = useMemo(() => sanitizeLoops(rawLoops), [rawLoops]);

  const [phase, setPhase] = useState<Phase>('off');
  const [error, setError] = useState('');
  const [level, setLevel] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [name, setName] = useState('');
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState<'base' | 'solo' | null>(null);

  const handle = useRef<{ recorder: Recorder; ctx: AudioContext; close: () => void } | null>(null);
  const meta = useRef<{ offset: number; ev: Extract<TransportEvent, { type: 'start' }> } | null>(null);
  const phaseRef = useRef<Phase>('off');
  phaseRef.current = phase;
  const maxTimer = useRef(0);
  const preview = useRef<TakePlayback | null>(null);
  const lastEvent = useRef(0);

  const latency = (prefs.latencyMs ?? Math.round(Looper.estimateLatency() * 1000)) / 1000;
  const latencyRef = useRef(latency);
  latencyRef.current = latency;

  const release = useCallback(() => {
    clearTimeout(maxTimer.current);
    preview.current?.stop();
    handle.current?.close();
    handle.current = null;
  }, []);
  useEffect(() => release, [release]);

  const arm = async () => {
    setPhase('opening');
    setError('');
    setSaveMsg(null);
    try {
      const h = await openRecorder();
      h.recorder.onLevel = (v) => setLevel(v);
      handle.current = h;
      setPhase('armed');
    } catch (e) {
      setError(e instanceof Error && /AudioWorklet/.test(e.message) ? e.message : explainMicError(e));
      setPhase('off');
    }
  };

  const disarm = () => {
    handle.current?.recorder.cancel();
    release();
    setPhase('off');
    setLevel(0);
  };

  // a base começou: a gravação começa no mesmo instante (contagem incluída); a base parou: termina
  useEffect(() => {
    if (!event || event.n === lastEvent.current) return;
    lastEvent.current = event.n;
    const h = handle.current;
    if (!h) return;
    if (event.type === 'start' && phaseRef.current === 'armed') {
      const recStart = Math.max(event.startTime, h.ctx.currentTime + 0.02);
      meta.current = { offset: Math.max(0, event.musicStart - recStart), ev: event };
      setPhase('recording');
      setPending(null);
      maxTimer.current = window.setTimeout(() => {
        h.recorder.stop();
        setError(`A gravação foi encerrada ao chegar em ${fmtDuration(MAX_TAKE_SECONDS)}.`);
      }, MAX_TAKE_SECONDS * 1000);
      h.recorder
        .capture(recStart)
        .then((data) => {
          clearTimeout(maxTimer.current);
          if (!data) {
            if (phaseRef.current === 'recording') setPhase('armed');
            return;
          }
          setPhase('processing');
          const L = Math.round(latencyRef.current * h.ctx.sampleRate);
          const samples = data.subarray(Math.min(L, data.length));
          const m = meta.current!;
          if (samples.length < h.ctx.sampleRate * 1) {
            setError('A gravação ficou curta demais (menos de 1 segundo).');
            setPhase('armed');
            return;
          }
          setPending({
            samples,
            sampleRate: h.ctx.sampleRate,
            take: { offset: m.offset, countIn: m.ev.countIn, fromSlot: m.ev.fromSlot, style: m.ev.style, bpm: m.ev.bpm, vol: m.ev.vol, slots: slotsToTuples(m.ev.slots) },
          });
          setName(`${title} — gravação ${loops.filter((l) => l.songId === songId && l.kind === 'take').length + 1}`.slice(0, 80));
          setPhase('review');
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : 'Falha na gravação.');
          setPhase('armed');
        });
    } else if (event.type === 'stop' && phaseRef.current === 'recording') {
      h.recorder.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  const listen = (mode: 'base' | 'solo') => {
    if (!pending) return;
    if (previewing === mode) {
      preview.current?.stop();
      return;
    }
    preview.current?.stop();
    const pb = playTake(pending.samples, pending.sampleRate, pending.take, mode === 'base');
    preview.current = pb;
    setPreviewing(mode);
    void pb.ended.then(() => {
      if (preview.current === pb) {
        preview.current = null;
        setPreviewing(null);
      }
    });
  };

  const save = async () => {
    if (!pending) return;
    if (loops.length >= MAX_LOOPS) {
      setSaveMsg({ ok: false, text: `A biblioteca guarda até ${MAX_LOOPS} itens. Exclua algum antes.` });
      return;
    }
    setSaving(true);
    try {
      preview.current?.stop();
      const made = await writeLoop({ id: newLoopId(), name: name.trim().slice(0, 80) || 'Gravação', kind: 'take', bpm: pending.take.bpm, beats: 4, bars: 0, sampleRate: pending.sampleRate, songId, take: pending.take }, [{ samples: pending.samples, vol: 1, mute: false }]);
      setLoops((l) => [made, ...l]);
      setPending(null);
      setPhase('armed');
      setSaveMsg({ ok: true, text: `"${made.name}" salva (${fmtDuration(made.samples / made.sampleRate)}).` });
    } catch (e) {
      setSaveMsg({ ok: false, text: e instanceof Error ? e.message : 'Não foi possível salvar (armazenamento cheio?).' });
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    preview.current?.stop();
    setPending(null);
    setPhase('armed');
  };

  const supported = micSupported();
  return (
    <section className="panel take-rec">
      <div className="row between">
        <h3 aria-level={2}>Gravar minha execução</h3>
        {(phase === 'armed' || phase === 'recording') && (
          <button type="button" className="btn small" onClick={disarm} disabled={phase === 'recording'}>
            Desativar microfone
          </button>
        )}
      </div>

      {phase === 'off' || phase === 'opening' ? (
        <>
          <p className="muted small-text">
            Toque junto com a base e ouça depois a sua gravação ao lado dela. <b>Use fones de ouvido</b> para o microfone não gravar a base que sai das caixas.
          </p>
          {!supported && <p className="notice err">Este navegador ou endereço não permite usar o microfone (é preciso https ou localhost).</p>}
          <button type="button" className="btn primary" disabled={phase === 'opening' || !supported} onClick={arm}>
            <Icon name="record" size={16} /> {phase === 'opening' ? 'Abrindo o microfone…' : 'Preparar gravação'}
          </button>
        </>
      ) : null}

      {phase === 'armed' && (
        <p className="small-text" role="status">
          <b className="ok-text">Pronto.</b> Aperte <b>Tocar</b> na base acima: a gravação começa junto (com a contagem) e termina quando você apertar <b>Parar</b>.
        </p>
      )}
      {phase === 'recording' && (
        <p className="small-text" role="status">
          <b className="warn-text">● Gravando…</b> aperte <b>Parar</b> na base para terminar.
        </p>
      )}
      {phase === 'processing' && <p className="small-text">Processando…</p>}
      {(phase === 'armed' || phase === 'recording') && (
        <div className="level take-level" role="img" aria-label={`Nível do microfone: ${Math.min(100, Math.round(level * 400))}%`}>
          <span style={{ width: `${Math.min(100, Math.round(level * 400))}%` }} />
        </div>
      )}

      {phase === 'review' && pending && (
        <div className="take-review">
          <p style={{ margin: '0 0 8px' }}>
            <b>Gravação pronta</b> · {fmtDuration(pending.samples.length / pending.sampleRate)}
          </p>
          <div className="row gap wrap">
            <button type="button" className={`btn small ${previewing === 'base' ? 'danger' : 'primary'}`} onClick={() => listen('base')}>
              <Icon name={previewing === 'base' ? 'stop' : 'play'} size={13} /> {previewing === 'base' ? 'Parar' : 'Ouvir com a base'}
            </button>
            <button type="button" className={`btn small${previewing === 'solo' ? ' danger' : ''}`} onClick={() => listen('solo')}>
              <Icon name={previewing === 'solo' ? 'stop' : 'volume'} size={13} /> {previewing === 'solo' ? 'Parar' : 'Só a gravação'}
            </button>
          </div>
          <div className="row gap wrap save-row" style={{ marginTop: 10 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome da gravação" maxLength={80} />
            <button type="button" className="btn primary small" disabled={saving} onClick={save}>
              Salvar gravação
            </button>
            <button type="button" className="btn small" onClick={discard}>
              Descartar
            </button>
          </div>
          <p className="muted small-text">Se a gravação parecer adiantada ou atrasada em relação à base, ajuste a latência em Backing → Looper.</p>
        </div>
      )}

      {error && (
        <p className="notice err" role="alert">
          {error}
        </p>
      )}
      {saveMsg && (
        <p className={saveMsg.ok ? 'notice ok' : 'notice err'} role={saveMsg.ok ? 'status' : 'alert'}>
          {saveMsg.text}
        </p>
      )}

      <LoopLibrary loops={loops} setLoops={setLoops} songId={songId} show="takes" />
    </section>
  );
}
