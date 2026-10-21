import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { LoopLibrary } from './LoopLibrary';
import { Chips, Field, Toggle } from './ui';
import { Looper, loopFits, type LooperConfig, type LooperSnapshot, type LooperState } from '../lib/looper';
import { BARS_OPTIONS, BEATS_OPTIONS, DEFAULT_LOOPER, normalizeLooper, type LooperPrefs } from '../lib/looper-prefs';
import { MAX_LAYERS, MAX_LOOPS, deleteLoopFiles, fmtDuration, newLoopId, sanitizeLoops, writeLoop, type LoopMeta } from '../lib/loops';
import { explainMicError, micSupported } from '../lib/mic';
import { measureLatency } from '../lib/recorder';
import { useLocalStorage, useStoredList } from '../lib/storage';
import type { Layer } from '../lib/wav';

const EMPTY: LooperSnapshot = { state: 'idle', layers: [], seconds: 0, level: 0, micReady: false, busy: false };
const STATE_LABEL: Record<LooperState, string> = {
  idle: 'Pronto',
  countin: 'Contagem…',
  recording: 'Gravando',
  playing: 'Tocando',
  waiting: 'Aguardando o próximo ciclo…',
  overdubbing: 'Gravando camada',
  stopped: 'Parado',
};
const RING = 2 * Math.PI * 78;

export function LooperPanel() {
  const [rawPrefs, setRawPrefs] = useLocalStorage<LooperPrefs>('ss.looper', DEFAULT_LOOPER);
  const prefs = useMemo(() => normalizeLooper(rawPrefs), [rawPrefs]);
  const patch = useCallback((x: Partial<LooperPrefs>) => setRawPrefs((r) => normalizeLooper({ ...normalizeLooper(r), ...x })), [setRawPrefs]);
  const [rawLoops, setLoops] = useStoredList<LoopMeta>('ss.loops');
  const loops = useMemo(() => sanitizeLoops(rawLoops), [rawLoops]);

  const [snap, setSnap] = useState<LooperSnapshot>(EMPTY);
  const [error, setError] = useState('');
  const [autoLatency, setAutoLatency] = useState(0); // s, estimativa depois de ligar o microfone
  const [starting, setStarting] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calMsg, setCalMsg] = useState('');
  const [loaded, setLoaded] = useState<{ id: string; name: string; createdAt: number } | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const engine = useRef<Looper | null>(null);
  const ring = useRef<SVGCircleElement>(null);

  const latencySec = (prefs.latencyMs ?? Math.round(autoLatency * 1000)) / 1000;
  const cfg: LooperConfig = useMemo(() => ({ bpm: prefs.bpm, beats: prefs.beats, bars: prefs.bars, quantized: prefs.quantized, countIn: prefs.countIn, metronome: prefs.metronome, latency: latencySec }), [prefs, latencySec]);

  useEffect(() => {
    const l = new Looper(cfg, setSnap, setError);
    engine.current = l;
    return () => {
      l.dispose();
      engine.current = null;
    };
    // o motor é criado uma vez; a configuração é atualizada abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (engine.current) engine.current.cfg = cfg;
  }, [cfg]);

  // anel de progresso: desenhado direto no DOM, sem renderizar a página a cada quadro
  useEffect(() => {
    let id = 0;
    const loop = () => {
      const p = engine.current?.position() ?? null;
      if (ring.current) ring.current.style.strokeDashoffset = String(RING * (1 - (p ?? 0)));
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);

  const hasLayers = snap.layers.length > 0;
  const locked = hasLayers || snap.state !== 'idle';
  const supported = micSupported();

  const enable = async () => {
    setStarting(true);
    setError('');
    try {
      await engine.current!.enable();
      setAutoLatency(Looper.estimateLatency());
    } catch (e) {
      setError(e instanceof Error && /AudioWorklet/.test(e.message) ? e.message : explainMicError(e));
    } finally {
      setStarting(false);
    }
  };

  const calibrate = async () => {
    const e = engine.current;
    if (!e?.recorderHandle || !e.audioContext) return;
    setCalibrating(true);
    setCalMsg('Medindo… fique em silêncio.');
    try {
      const sec = await measureLatency(e.recorderHandle, e.audioContext);
      if (sec === null) setCalMsg('Não consegui ouvir o clique. Tire os fones, aumente o volume e tente em um lugar silencioso.');
      else {
        patch({ latencyMs: Math.round(sec * 1000) });
        setCalMsg(`Latência medida: ${Math.round(sec * 1000)} ms. Já está sendo compensada.`);
      }
    } catch (err) {
      setCalMsg(err instanceof Error ? err.message : 'Falha na medição.');
    } finally {
      setCalibrating(false);
    }
  };

  // ação do botão grande, conforme o estado (como o pedal de um looper)
  const main = (() => {
    const s = snap.state;
    if (s === 'idle') return { label: 'Gravar', icon: 'record', run: () => engine.current?.rec(), enabled: snap.micReady };
    if (s === 'countin') return { label: 'Contagem…', icon: 'record', run: () => {}, enabled: false };
    if (s === 'recording') return prefs.quantized ? { label: 'Gravando…', icon: 'record', run: () => {}, enabled: false } : { label: 'Terminar', icon: 'stop', run: () => engine.current?.rec(), enabled: true };
    if (s === 'playing') return { label: 'Gravar camada', icon: 'record', run: () => engine.current?.overdub(), enabled: snap.micReady && !snap.busy && snap.layers.length < MAX_LAYERS };
    if (s === 'waiting') return { label: 'Cancelar', icon: 'x', run: () => engine.current?.overdub(), enabled: true };
    if (s === 'overdubbing') return { label: 'Gravando camada…', icon: 'record', run: () => {}, enabled: false };
    return { label: 'Tocar', icon: 'play', run: () => engine.current?.play(), enabled: hasLayers };
  })();
  const recording = snap.state === 'recording' || snap.state === 'overdubbing' || snap.state === 'waiting' || snap.state === 'countin';

  const save = async (asNew: boolean) => {
    const e = engine.current;
    if (!e || !hasLayers) return;
    const layers = e.exportLayers();
    const updating = !asNew && loaded;
    if (!updating && loops.length >= MAX_LOOPS) {
      setSaveMsg({ ok: false, text: `A biblioteca guarda até ${MAX_LOOPS} itens. Exclua algum antes.` });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const title = (name.trim() || loaded?.name || `Loop ${loops.filter((l) => l.kind === 'loop').length + 1}`).slice(0, 80);
      const id = updating ? loaded.id : newLoopId();
      const made = await writeLoop({ id, name: title, kind: 'loop', bpm: prefs.bpm, beats: prefs.beats, bars: prefs.quantized ? prefs.bars : 0, sampleRate: e.sampleRate, createdAt: updating ? loaded.createdAt : undefined }, layers);
      const old = updating ? loops.find((l) => l.id === id) : undefined;
      setLoops((l) => [made, ...l.filter((x) => x.id !== made.id)]);
      if (old) await deleteLoopFiles(old); // só apaga o áudio antigo depois de o novo estar salvo
      setLoaded({ id: made.id, name: made.name, createdAt: made.createdAt });
      setName(made.name);
      setSaveMsg({ ok: true, text: updating ? `"${made.name}" atualizado.` : `"${made.name}" salvo na biblioteca.` });
    } catch (err) {
      setSaveMsg({ ok: false, text: err instanceof Error ? err.message : 'Não foi possível salvar (armazenamento cheio?).' });
    } finally {
      setSaving(false);
    }
  };

  const open = (meta: LoopMeta, layers: Layer[]) => {
    engine.current?.load(layers, { bpm: meta.bpm, beats: meta.beats, bars: meta.bars || prefs.bars, quantized: meta.bars > 0, countIn: prefs.countIn, metronome: prefs.metronome, latency: latencySec });
    patch({ bpm: Math.round(meta.bpm), beats: BEATS_OPTIONS.includes(meta.beats) ? meta.beats : 4, bars: BARS_OPTIONS.includes(meta.bars) ? meta.bars : prefs.bars, quantized: meta.bars > 0 });
    setLoaded({ id: meta.id, name: meta.name, createdAt: meta.createdAt });
    setName(meta.name);
    setSaveMsg(null);
    engine.current?.play();
  };

  const newLoop = () => {
    engine.current?.clear();
    setLoaded(null);
    setName('');
    setSaveMsg(null);
  };

  const barOptions = BARS_OPTIONS.filter((b) => loopFits({ bpm: prefs.bpm, beats: prefs.beats, bars: b }));

  return (
    <>
      <section className="panel looper">
        <h2 className="section-title">Pedal de loop</h2>
        <p className="muted small-text" style={{ marginTop: 0 }}>
          Grave um trecho, ele toca em repetição e você grava novas camadas por cima. <b>Use fones de ouvido</b>: sem eles, o microfone grava também o som que sai das caixas.
        </p>

        {!supported && <p className="notice err">Este navegador ou endereço não permite usar o microfone (é preciso https ou localhost).</p>}
        {error && (
          <p className="notice err" role="alert">
            {error}
          </p>
        )}

        {!snap.micReady ? (
          <div className="tuner-start">
            <button type="button" className="btn primary big" disabled={starting || !supported} onClick={enable}>
              <Icon name="ear" size={20} /> {starting ? 'Abrindo o microfone…' : 'Ativar microfone'}
            </button>
            <p className="muted small-text">Ligue a guitarra em uma interface de áudio ou use o microfone do aparelho. O áudio é processado aqui mesmo e só é salvo se você pedir.</p>
          </div>
        ) : (
          <>
            <div className="looper-config">
              <Field label={`Andamento · ${prefs.bpm} BPM`}>
                <input type="range" min={40} max={200} value={prefs.bpm} disabled={locked} aria-label="Andamento em BPM" onChange={(e) => patch({ bpm: +e.target.value })} />
              </Field>
              <Field label="Compassos">
                <Chips small value={prefs.bars} onChange={(bars) => !locked && patch({ bars })} options={barOptions.map((b) => ({ value: b, label: String(b) }))} />
              </Field>
              <Field label="Batidas por compasso">
                <Chips small value={prefs.beats} onChange={(beats) => !locked && patch({ beats })} options={BEATS_OPTIONS.map((b) => ({ value: b, label: String(b) }))} />
              </Field>
              <Field label="Modo">
                <Chips
                  small
                  value={prefs.quantized ? 'q' : 'l'}
                  onChange={(v) => !locked && patch({ quantized: v === 'q' })}
                  options={[
                    { value: 'q', label: 'Por compassos' },
                    { value: 'l', label: 'Livre' },
                  ]}
                />
              </Field>
            </div>
            <div className="row gap wrap">
              <Toggle label="Contagem de 1 compasso" checked={prefs.countIn} onChange={(countIn) => patch({ countIn })} />
              <Toggle label="Metrônomo" checked={prefs.metronome && prefs.quantized} onChange={(metronome) => patch({ metronome })} />
            </div>
            {!prefs.quantized && <p className="muted small-text">No modo livre o tamanho do loop é o que você gravar: toque em "Terminar" quando quiser fechar o ciclo. O metrônomo fica desligado.</p>}

            <div className="pedal">
              <div className="pedal-ring">
                <svg viewBox="0 0 180 180" aria-hidden="true">
                  <circle cx="90" cy="90" r="78" className="ring-bg" />
                  <circle ref={ring} cx="90" cy="90" r="78" className={`ring-fg${recording ? ' rec' : ''}`} strokeDasharray={RING} strokeDashoffset={RING} transform="rotate(-90 90 90)" />
                </svg>
                <div className="pedal-center">
                  <b>{STATE_LABEL[snap.state]}</b>
                  <span className="muted small-text">
                    {hasLayers ? `${snap.layers.length} camada(s) · ${fmtDuration(snap.seconds)}` : prefs.quantized ? `${prefs.bars} compasso(s)` : 'tamanho livre'}
                  </span>
                </div>
              </div>
              <div className="level pedal-level" role="img" aria-label={`Nível do microfone: ${Math.min(100, Math.round(snap.level * 400))}%`}>
                <span style={{ width: `${Math.min(100, Math.round(snap.level * 400))}%` }} />
              </div>
              <button type="button" className={`btn big pedal-main${recording ? ' danger' : ' primary'}`} disabled={!main.enabled} onClick={main.run}>
                <Icon name={main.icon as 'play'} size={22} /> {main.label}
              </button>
              <div className="row gap wrap" style={{ justifyContent: 'center' }}>
                <button type="button" className="btn small" disabled={snap.state === 'idle' || snap.state === 'stopped'} onClick={() => engine.current?.stop()}>
                  <Icon name="stop" size={13} /> Parar
                </button>
                <button type="button" className="btn small" disabled={!hasLayers && snap.state !== 'recording' && snap.state !== 'countin'} onClick={() => engine.current?.undo()}>
                  Desfazer
                </button>
                <button type="button" className="btn small danger" disabled={snap.state === 'idle'} onClick={newLoop}>
                  <Icon name="trash" size={13} /> Limpar tudo
                </button>
              </div>
            </div>
            <span className="sr-only" role="status" aria-live="polite">
              {STATE_LABEL[snap.state]}
            </span>

            {hasLayers && (
              <>
                <h3 aria-level={2} className="section-title">
                  Camadas
                </h3>
                <ul className="layer-list">
                  {snap.layers.map((l, i) => (
                    <li key={i} className="layer-row">
                      <span>Camada {i + 1}</span>
                      <input type="range" min={0} max={1} step={0.05} value={l.vol} aria-label={`Volume da camada ${i + 1}`} onChange={(e) => engine.current?.setVol(i, +e.target.value)} />
                      <button type="button" className={`btn small${l.mute ? ' danger' : ''}`} aria-pressed={l.mute} onClick={() => engine.current?.setMute(i, !l.mute)}>
                        {l.mute ? 'Mudo' : 'Som'}
                      </button>
                      {l.peak >= 0.98 && <span className="tag warn-text" title="O som chegou ao máximo e pode estar distorcendo. Baixe o volume de entrada.">saturou</span>}
                    </li>
                  ))}
                </ul>

                <div className="row gap wrap save-row">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={loaded ? loaded.name : 'Nome do loop'} aria-label="Nome do loop" maxLength={80} />
                  <button type="button" className="btn primary small" disabled={saving} onClick={() => save(false)}>
                    <Icon name="download" size={13} /> {loaded ? 'Salvar alterações' : 'Salvar loop'}
                  </button>
                  {loaded && (
                    <button type="button" className="btn small" disabled={saving} onClick={() => save(true)}>
                      Salvar como novo
                    </button>
                  )}
                </div>
                {saveMsg && (
                  <p className={saveMsg.ok ? 'notice ok' : 'notice err'} role={saveMsg.ok ? 'status' : 'alert'}>
                    {saveMsg.text}
                  </p>
                )}
              </>
            )}

            <details className="looper-adv">
              <summary>Ajuste de latência ({Math.round(latencySec * 1000)} ms{prefs.latencyMs === null ? ', automático' : ''})</summary>
              <p className="muted small-text">O som do microfone chega um pouco atrasado. Esse valor é descontado de cada gravação para que ela fique no tempo da base. Se as camadas parecerem atrasadas, aumente; se adiantadas, diminua.</p>
              <div className="row gap wrap">
                <input type="range" min={0} max={300} step={1} value={Math.round(latencySec * 1000)} disabled={locked} aria-label="Latência em milissegundos" onChange={(e) => patch({ latencyMs: +e.target.value })} />
                <button type="button" className="btn small" disabled={calibrating || locked} onClick={calibrate}>
                  {calibrating ? 'Medindo…' : 'Medir automaticamente'}
                </button>
                {prefs.latencyMs !== null && (
                  <button type="button" className="btn small" disabled={locked} onClick={() => patch({ latencyMs: null })}>
                    Voltar ao automático
                  </button>
                )}
              </div>
              <p className="muted small-text">A medição toca um clique e ouve pelo microfone: tire os fones, deixe o volume alto e fique em silêncio.</p>
              {calMsg && (
                <p className="small-text" role="status">
                  {calMsg}
                </p>
              )}
            </details>
          </>
        )}
      </section>

      <LoopLibrary loops={loops} setLoops={setLoops} onOpen={open} show="both" />
    </>
  );
}
