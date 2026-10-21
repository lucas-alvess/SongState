import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { downloadBlob, safeFileName } from '../lib/download';
import { MAX_LOOPS, chainLoops, deleteLoopFiles, duplicateLoop, fmtDuration, loopSeconds, mergeProblem, mixdown, readLayers, stackLoops, type LoopMeta } from '../lib/loops';
import { playTake, type TakePlayback } from '../lib/take';
import { encodeWav, type Layer } from '../lib/wav';

interface Props {
  loops: LoopMeta[];
  setLoops: (v: LoopMeta[] | ((p: LoopMeta[]) => LoopMeta[])) => void;
  /** abrir no pedal (só loops) */
  onOpen?: (meta: LoopMeta, layers: Layer[]) => void;
  /** mostrar só as gravações desta música */
  songId?: string;
  /** quais tipos aparecem */
  show: 'loops' | 'takes' | 'both';
}

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Algo deu errado.');

/** Lista de loops e gravações salvos: abrir, ouvir, renomear, duplicar, baixar, excluir e juntar. */
export function LoopLibrary({ loops, setLoops, onOpen, songId, show }: Props) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [mergeName, setMergeName] = useState('');
  const [playing, setPlaying] = useState<{ id: string; mode: 'base' | 'solo' } | null>(null);
  const player = useRef<TakePlayback | null>(null);

  useEffect(() => () => player.current?.stop(), []);

  const list = useMemo(() => loops.filter((m) => (songId ? m.songId === songId : true)), [loops, songId]);
  const plain = list.filter((m) => m.kind === 'loop');
  const takes = list.filter((m) => m.kind === 'take');
  const chosen = plain.filter((m) => picked.includes(m.id));
  const problem = chosen.length >= 2 ? mergeProblem(chosen) : null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  const add = (m: LoopMeta) => setLoops((l) => [m, ...l.filter((x) => x.id !== m.id)]);
  const room = loops.length < MAX_LOOPS;
  const needRoom = () => {
    if (!room) throw new Error(`A biblioteca guarda até ${MAX_LOOPS} itens. Exclua algum antes.`);
  };

  const rename = (m: LoopMeta) => {
    const name = draft.trim().slice(0, 80);
    if (name) setLoops((l) => l.map((x) => (x.id === m.id ? { ...x, name, updatedAt: Date.now() } : x)));
    setRenaming(null);
  };

  const remove = (m: LoopMeta) =>
    run(async () => {
      if (!confirm(`Excluir "${m.name}"? O áudio é apagado deste aparelho.`)) return;
      player.current?.stop();
      await deleteLoopFiles(m);
      setLoops((l) => l.filter((x) => x.id !== m.id));
      setPicked((p) => p.filter((id) => id !== m.id));
    });

  const download = (m: LoopMeta) =>
    run(async () => {
      const mixed = await mixdown(m);
      downloadBlob(encodeWav(mixed, m.sampleRate), safeFileName(m.name, 'wav'));
    });

  const open = (m: LoopMeta) =>
    run(async () => {
      const layers = await readLayers(m);
      onOpen?.(m, layers);
    });

  const listen = (m: LoopMeta, mode: 'base' | 'solo') => {
    if (playing?.id === m.id && playing.mode === mode) {
      player.current?.stop();
      return;
    }
    void run(async () => {
      player.current?.stop();
      const samples = await mixdown(m);
      const pb = playTake(samples, m.sampleRate, m.take!, mode === 'base');
      player.current = pb;
      setPlaying({ id: m.id, mode });
      void pb.ended.then(() => {
        if (player.current === pb) {
          player.current = null;
          setPlaying(null);
        }
      });
    });
  };

  const merge = (kind: 'stack' | 'chain') =>
    run(async () => {
      needRoom();
      const name = mergeName.trim() || chosen.map((m) => m.name).join(kind === 'stack' ? ' + ' : ' → ').slice(0, 80);
      const made = kind === 'stack' ? await stackLoops(chosen, name) : await chainLoops(chosen, name);
      add(made);
      setPicked([]);
      setMergeName('');
      setMsg({ ok: true, text: `"${made.name}" criado (${fmtDuration(loopSeconds(made))}). Os originais continuam salvos.` });
    });

  const row = (m: LoopMeta) => (
    <li key={m.id} className="loop-item">
      <div className="loop-head">
        {m.kind === 'loop' && (
          <input type="checkbox" aria-label={`Selecionar ${m.name} para juntar`} checked={picked.includes(m.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, m.id] : p.filter((id) => id !== m.id)))} />
        )}
        {renaming === m.id ? (
          <input
            className="loop-rename"
            value={draft}
            autoFocus
            aria-label="Novo nome"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => rename(m)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') rename(m);
              if (e.key === 'Escape') setRenaming(null);
            }}
          />
        ) : (
          <b className="loop-name">{m.name}</b>
        )}
        <span className="muted small-text">
          {fmtDuration(loopSeconds(m))}
          {m.kind === 'loop' ? ` · ${m.bars ? `${m.bars} compasso(s) · ` : ''}${Math.round(m.bpm)} BPM · ${m.layers.length} camada(s)` : ` · gravação · ${Math.round(m.take?.bpm ?? m.bpm)} BPM`}
        </span>
      </div>
      <div className="row gap wrap">
        {m.kind === 'loop' && onOpen && (
          <button type="button" className="btn small primary" disabled={busy} onClick={() => open(m)}>
            <Icon name="play" size={13} /> Abrir no pedal
          </button>
        )}
        {m.kind === 'take' && (
          <>
            <button type="button" className={`btn small ${playing?.id === m.id && playing.mode === 'base' ? 'danger' : 'primary'}`} disabled={busy} onClick={() => listen(m, 'base')}>
              <Icon name={playing?.id === m.id && playing.mode === 'base' ? 'stop' : 'play'} size={13} /> {playing?.id === m.id && playing.mode === 'base' ? 'Parar' : 'Ouvir com a base'}
            </button>
            <button type="button" className={`btn small ${playing?.id === m.id && playing.mode === 'solo' ? 'danger' : ''}`} disabled={busy} onClick={() => listen(m, 'solo')}>
              <Icon name={playing?.id === m.id && playing.mode === 'solo' ? 'stop' : 'volume'} size={13} /> {playing?.id === m.id && playing.mode === 'solo' ? 'Parar' : 'Só a gravação'}
            </button>
          </>
        )}
        <button type="button" className="btn small" onClick={() => (setDraft(m.name), setRenaming(m.id))}>
          <Icon name="edit" size={13} /> Renomear
        </button>
        {m.kind === 'loop' && (
          <button
            type="button"
            className="btn small"
            disabled={busy}
            onClick={() =>
              run(async () => {
                needRoom();
                add(await duplicateLoop(m, `${m.name} (cópia)`.slice(0, 80)));
              })
            }
          >
            Duplicar
          </button>
        )}
        <button type="button" className="btn small" disabled={busy} onClick={() => download(m)}>
          <Icon name="download" size={13} /> WAV
        </button>
        <button type="button" className="btn small danger" disabled={busy} onClick={() => remove(m)}>
          <Icon name="trash" size={13} /> Excluir
        </button>
      </div>
    </li>
  );

  return (
    <div className="loop-library">
      {msg && (
        <p className={msg.ok ? 'notice ok' : 'notice err'} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}

      {(show === 'loops' || show === 'both') && (
        <>
          <h3 aria-level={2} className="section-title">
            Meus loops
          </h3>
          {plain.length === 0 ? <p className="muted small-text">Nenhum loop salvo ainda. Grave no pedal e use "Salvar loop".</p> : <ul className="loop-list">{plain.map(row)}</ul>}
          {chosen.length >= 1 && (
            <div className="panel soft loop-merge">
              <p className="small-text" style={{ margin: '0 0 8px' }}>
                {chosen.length} selecionado(s). <b>Empilhar</b> toca os loops juntos; <b>Encadear</b> coloca um depois do outro. Precisam ter o mesmo BPM.
              </p>
              {problem && <p className="notice err">{problem}</p>}
              <div className="row gap wrap">
                <input value={mergeName} onChange={(e) => setMergeName(e.target.value)} placeholder="Nome do novo loop (opcional)" aria-label="Nome do novo loop" maxLength={80} />
                <button type="button" className="btn small primary" disabled={busy || chosen.length < 2 || !!problem} onClick={() => merge('stack')}>
                  Empilhar
                </button>
                <button type="button" className="btn small primary" disabled={busy || chosen.length < 2 || !!problem} onClick={() => merge('chain')}>
                  Encadear
                </button>
                <button type="button" className="btn small" onClick={() => setPicked([])}>
                  Limpar seleção
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {(show === 'takes' || show === 'both') && (
        <>
          <h3 aria-level={2} className="section-title">
            {songId ? 'Minhas gravações desta música' : 'Gravações sobre bases'}
          </h3>
          {takes.length === 0 ? <p className="muted small-text">{songId ? 'Nenhuma gravação ainda. Arme a gravação acima e toque a base.' : 'Nenhuma gravação ainda. Elas aparecem aqui quando você grava por cima de uma base, na página da música.'}</p> : <ul className="loop-list">{takes.map(row)}</ul>}
        </>
      )}
    </div>
  );
}
