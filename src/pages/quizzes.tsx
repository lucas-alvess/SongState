import { useCallback, useEffect, useMemo, useState } from 'react';
import { Fretboard, type Marker } from '../components/Fretboard';
import { Chips, Field, ScaleSelect } from '../components/ui';
import {
  NoteButtons,
  NoteConfig,
  Prompt,
  QuizBar,
  allowedStrings,
  notePool,
  useBoardEnv,
  useLater,
  useNoteCfg,
  useQuiz,
  type NoteCfg,
} from '../components/quiz';
import {
  INTERVAL_NAMES,
  INTERVAL_TOKENS,
  SCALES,
  buildScale,
  mod12,
  noteLabel,
  pcAt,
  pcLabel,
  pcLabelBoth,
  pick,
  randInt,
  scaleById,
  scalePositions,
  shuffle,
  stringNumber,
  type FretNote,
  type Scale,
} from '../lib/music';
import { useLocalStorage } from '../lib/storage';

type Env = ReturnType<typeof useBoardEnv>;
const key = (s: number, f: number) => `${s}:${f}`;

function Board({ env, fretMax, fretMin = 0, markers, onCell, stringsOff }: { env: Env; fretMax: number; fretMin?: number; markers: Marker[]; onCell?: (s: number, f: number) => void; stringsOff?: number[] }) {
  return (
    <div className="board-wrap">
      <div className="board-scroll">
        <Fretboard tuning={env.tuning} fretMin={fretMin} fretMax={fretMax} vertical={env.vertical} leftHanded={env.leftHanded} markers={markers} onCell={onCell} stringsOff={stringsOff} quiz />
      </div>
    </div>
  );
}

/** Todas as casas (até maxFret) de uma corda que soam o pitch class. */
const fretsOf = (tuning: number[], s: number, pc: number, maxFret: number) => {
  const out: number[] = [];
  for (let f = 0; f <= maxFret; f++) if (pcAt(tuning, s, f) === pc) out.push(f);
  return out;
};

// ============ 1. Encontre a nota na corda ============

export function NoteFind() {
  const env = useBoardEnv();
  const [cfg, setCfg] = useNoteCfg('note-find');
  const quiz = useQuiz('note-find');
  const later = useLater();
  const make = useCallback(() => ({ pc: pick(notePool(cfg)), s: pick(allowedStrings(cfg, env.tuning.length)) }), [cfg, env.tuning.length]);
  const [q, setQ] = useState(make);
  const [fb, setFb] = useState<{ markers: Marker[]; ok: boolean } | null>(null);

  const next = useCallback(() => {
    setFb(null);
    setQ(make());
    quiz.startTimer();
  }, [make, quiz]);
  useEffect(next, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCell = (s: number, f: number) => {
    if (fb || s !== q.s) return;
    const ok = pcAt(env.tuning, s, f) === q.pc;
    quiz.mark(ok);
    const targets = fretsOf(env.tuning, q.s, q.pc, cfg.maxFret);
    const markers: Marker[] = ok
      ? [{ string: s, fret: f, kind: 'correct', label: pcLabel(q.pc, env.pref, env.lang) }]
      : [...targets.map((t) => ({ string: q.s, fret: t, kind: 'target' as const, label: pcLabel(q.pc, env.pref, env.lang) })), { string: s, fret: f, kind: 'wrong' as const }];
    setFb({ markers, ok });
    later(next, ok ? 700 : 1700);
  };

  const others = env.tuning.map((_, i) => i).filter((i) => i !== q.s);
  return (
    <>
      <QuizBar score={quiz.score} onReset={quiz.reset} />
      <Prompt state={fb ? (fb.ok ? 'ok' : 'bad') : null}>
        Toque a nota <b>{pcLabelBoth(q.pc, env.lang)}</b> na corda <b>{stringNumber(q.s, env.tuning.length)}ª</b>
      </Prompt>
      <Board env={env} fretMax={cfg.maxFret} markers={fb?.markers ?? []} onCell={onCell} stringsOff={others} />
      <NoteConfig cfg={cfg} setCfg={setCfg} tuning={env.tuning} />
    </>
  );
}

// ============ 2. Que nota é essa? ============

export function NoteName() {
  const env = useBoardEnv();
  const [cfg, setCfg] = useNoteCfg('note-name');
  const quiz = useQuiz('note-name');
  const later = useLater();
  const make = useCallback(() => {
    const pool = notePool(cfg);
    for (;;) {
      const s = pick(allowedStrings(cfg, env.tuning.length));
      const f = randInt(cfg.maxFret + 1);
      if (pool.includes(pcAt(env.tuning, s, f))) return { s, f };
    }
  }, [cfg, env.tuning]);
  const [q, setQ] = useState(make);
  const [fb, setFb] = useState<{ ok: boolean; picked: number } | null>(null);
  const answer = pcAt(env.tuning, q.s, q.f);

  const next = useCallback(() => {
    setFb(null);
    setQ(make());
    quiz.startTimer();
  }, [make, quiz]);
  useEffect(next, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (pc: number) => {
    if (fb) return;
    const ok = pc === answer;
    quiz.mark(ok);
    setFb({ ok, picked: pc });
    later(next, ok ? 600 : 1500);
  };

  const markers: Marker[] = [{ string: q.s, fret: q.f, kind: fb ? (fb.ok ? 'correct' : 'wrong') : 'target', label: fb ? pcLabel(answer, env.pref, env.lang) : '?' }];
  return (
    <>
      <QuizBar score={quiz.score} onReset={quiz.reset} />
      <Prompt state={fb ? (fb.ok ? 'ok' : 'bad') : null}>
        {fb ? (fb.ok ? 'Isso!' : <>Era <b>{pcLabelBoth(answer, env.lang)}</b></>) : 'Que nota é essa?'}
      </Prompt>
      <Board env={env} fretMax={cfg.maxFret} markers={markers} />
      <NoteButtons onPick={onPick} accidentals={cfg.accidentals} disabled={!!fb} lang={env.lang} />
      <NoteConfig cfg={cfg} setCfg={setCfg} tuning={env.tuning} />
    </>
  );
}

// ============ 3. Todas as ocorrências ============

export function FindAll() {
  const env = useBoardEnv();
  const [cfg, setCfg] = useNoteCfg('find-all');
  const quiz = useQuiz('find-all');
  const make = useCallback(() => pick(notePool(cfg)), [cfg]);
  const [pc, setPc] = useState(make);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const later = useLater();

  const strings = allowedStrings(cfg, env.tuning.length);
  const targets = useMemo(() => {
    const out: FretNote[] = [];
    for (const s of strings) for (const f of fretsOf(env.tuning, s, pc, cfg.maxFret)) out.push({ string: s, fret: f, pc });
    return out;
  }, [strings, env.tuning, pc, cfg.maxFret]);
  const done = targets.length > 0 && found.size === targets.length;

  const reset = useCallback(() => {
    setPc(make());
    setFound(new Set());
    setMistakes(0);
    setWrong(null);
    quiz.startTimer();
  }, [make, quiz]);
  useEffect(reset, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCell = (s: number, f: number) => {
    if (done || !strings.includes(s)) return;
    const k = key(s, f);
    if (found.has(k)) return;
    if (pcAt(env.tuning, s, f) === pc) {
      const nf = new Set(found).add(k);
      setFound(nf);
      if (nf.size === targets.length) quiz.mark(mistakes === 0);
    } else {
      setMistakes((m) => m + 1);
      setWrong(k);
      later(() => setWrong(null), 600);
    }
  };

  const label = pcLabel(pc, env.pref, env.lang);
  const markers: Marker[] = [...found].map((k) => {
    const [s, f] = k.split(':').map(Number);
    return { string: s, fret: f, kind: 'correct', label };
  });
  if (wrong) {
    const [s, f] = wrong.split(':').map(Number);
    markers.push({ string: s, fret: f, kind: 'wrong' });
  }
  const hint = () => {
    const t = targets.find((x) => !found.has(key(x.string, x.fret)));
    if (t) {
      setMistakes((m) => m + 1);
      setFound((f) => new Set(f).add(key(t.string, t.fret)));
    }
  };

  return (
    <>
      <QuizBar score={quiz.score} onReset={quiz.reset} />
      <Prompt state={done ? 'ok' : null}>
        Encontre <b>todas</b> as notas <b>{pcLabelBoth(pc, env.lang)}</b> <span className="muted">({found.size}/{targets.length})</span>
      </Prompt>
      <Board env={env} fretMax={cfg.maxFret} markers={markers} onCell={onCell} stringsOff={env.tuning.map((_, i) => i).filter((i) => !strings.includes(i))} />
      <div className="row gap">
        <button type="button" className="btn primary" onClick={reset}>{done ? 'Próxima nota' : 'Pular'}</button>
        {!done && <button type="button" className="btn" onClick={hint}>Dica</button>}
      </div>
      <NoteConfig cfg={cfg} setCfg={setCfg} tuning={env.tuning} />
    </>
  );
}

// ============ 4. Qual o intervalo? ============

function randomPair(env: Env, cfg: NoteCfg) {
  const strings = allowedStrings(cfg, env.tuning.length);
  for (let tries = 0; tries < 200; tries++) {
    const s1 = pick(strings);
    const f1 = randInt(cfg.maxFret + 1);
    const i = 1 + randInt(11);
    const targetPc = mod12(pcAt(env.tuning, s1, f1) + i);
    const s2 = pick(strings.filter((s) => Math.abs(s - s1) <= 2));
    if (s2 === undefined) continue;
    const opts = fretsOf(env.tuning, s2, targetPc, cfg.maxFret);
    if (!opts.length) continue;
    opts.sort((a, b) => Math.abs(a - f1) - Math.abs(b - f1));
    if (s2 === s1 && opts[0] === f1) continue;
    return { s1, f1, s2, f2: opts[0], i };
  }
  return { s1: 0, f1: 0, s2: 1, f2: 2, i: 7 };
}

export function IntervalId() {
  const env = useBoardEnv();
  const [cfg, setCfg] = useNoteCfg('interval-id');
  const quiz = useQuiz('interval-id');
  const later = useLater();
  const [q, setQ] = useState(() => randomPair(env, cfg));
  const [fb, setFb] = useState<{ ok: boolean } | null>(null);

  const next = useCallback(() => {
    setFb(null);
    setQ(randomPair(env, cfg));
    quiz.startTimer();
  }, [env, cfg, quiz]);
  useEffect(next, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = Array.from({ length: 11 }, (_, i) => i + 1);
  const onPick = (i: number) => {
    if (fb) return;
    const ok = i === q.i;
    quiz.mark(ok);
    setFb({ ok });
    later(next, ok ? 700 : 1700);
  };
  const rootLabel = pcLabel(pcAt(env.tuning, q.s1, q.f1), env.pref, env.lang);
  const markers: Marker[] = [
    { string: q.s1, fret: q.f1, kind: 'root', label: rootLabel },
    { string: q.s2, fret: q.f2, kind: fb ? (fb.ok ? 'correct' : 'wrong') : 'target', label: fb ? INTERVAL_TOKENS[q.i] : '?' },
  ];
  return (
    <>
      <QuizBar score={quiz.score} onReset={quiz.reset} />
      <Prompt state={fb ? (fb.ok ? 'ok' : 'bad') : null}>
        {fb && !fb.ok ? <>Era <b>{INTERVAL_NAMES[q.i]}</b> ({INTERVAL_TOKENS[q.i]})</> : <>Qual o intervalo a partir de <b>{rootLabel}</b>?</>}
      </Prompt>
      <Board env={env} fretMax={cfg.maxFret} markers={markers} />
      <div className="answer-grid">
        {options.map((i) => (
          <button key={i} type="button" className="btn answer" disabled={!!fb} onClick={() => onPick(i)}>
            <b>{INTERVAL_TOKENS[i]}</b>
            <small>{INTERVAL_NAMES[i]}</small>
          </button>
        ))}
      </div>
      <NoteConfig cfg={cfg} setCfg={setCfg} tuning={env.tuning} />
    </>
  );
}

// ============ 5. Encontre o intervalo ============

export function IntervalFind() {
  const env = useBoardEnv();
  const [cfg, setCfg] = useNoteCfg('interval-find');
  const quiz = useQuiz('interval-find');
  const later = useLater();
  const make = useCallback(() => {
    const strings = allowedStrings(cfg, env.tuning.length);
    return { s: pick(strings), f: randInt(Math.min(cfg.maxFret, 12) + 1), i: pick([2, 3, 4, 5, 7, 8, 9, 10, 11]) };
  }, [cfg, env.tuning.length]);
  const [q, setQ] = useState(make);
  const [fb, setFb] = useState<{ markers: Marker[]; ok: boolean } | null>(null);
  const rootPc = pcAt(env.tuning, q.s, q.f);
  const targetPc = mod12(rootPc + q.i);

  const next = useCallback(() => {
    setFb(null);
    setQ(make());
    quiz.startTimer();
  }, [make, quiz]);
  useEffect(next, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCell = (s: number, f: number) => {
    if (fb) return;
    const ok = pcAt(env.tuning, s, f) === targetPc;
    quiz.mark(ok);
    const markers: Marker[] = [];
    if (!ok) for (let ss = 0; ss < env.tuning.length; ss++) for (const ff of fretsOf(env.tuning, ss, targetPc, cfg.maxFret)) markers.push({ string: ss, fret: ff, kind: 'target', label: INTERVAL_TOKENS[q.i] });
    markers.push({ string: s, fret: f, kind: ok ? 'correct' : 'wrong', label: ok ? INTERVAL_TOKENS[q.i] : undefined });
    setFb({ markers, ok });
    later(next, ok ? 700 : 2000);
  };
  const markers: Marker[] = [{ string: q.s, fret: q.f, kind: 'root', label: pcLabel(rootPc, env.pref, env.lang) }, ...(fb?.markers ?? [])];
  return (
    <>
      <QuizBar score={quiz.score} onReset={quiz.reset} />
      <Prompt state={fb ? (fb.ok ? 'ok' : 'bad') : null}>
        Toque a <b>{INTERVAL_NAMES[q.i]}</b> ({INTERVAL_TOKENS[q.i]}) de <b>{pcLabel(rootPc, env.pref, env.lang)}</b> — em qualquer corda
      </Prompt>
      <Board env={env} fretMax={cfg.maxFret} markers={markers} onCell={onCell} />
      <NoteConfig cfg={cfg} setCfg={setCfg} tuning={env.tuning} />
    </>
  );
}

// ============ 6. Monte o shape ============

interface ShapeCfg {
  scaleId: string;
  root: number; // -1 = aleatória
  pos: number; // -1 = aleatória
  hint: 'none' | 'root' | 'shape';
}
const DEFAULT_SHAPE_CFG: ShapeCfg = { scaleId: 'minor-pent', root: -1, pos: -1, hint: 'root' };

export function ShapeBuild() {
  const env = useBoardEnv();
  const [cfg, setCfg] = useLocalStorage<ShapeCfg>('ss.cfg.shape-build', DEFAULT_SHAPE_CFG);
  const quiz = useQuiz('shape-build');
  const later = useLater();
  const def = scaleById(cfg.scaleId);

  const make = useCallback(() => {
    const root = cfg.root >= 0 ? cfg.root : randInt(12);
    const scale = buildScale(def, root, env.pref);
    const positions = scalePositions(scale, env.tuning);
    const pos = positions[cfg.pos >= 0 && cfg.pos < positions.length ? cfg.pos : randInt(positions.length)];
    const cluster = pos.clusters.find((c) => Math.max(...c.map((n) => n.fret)) <= 15) ?? pos.clusters[0];
    return { scale, pos, cluster };
  }, [cfg, def, env.pref, env.tuning]);

  const [q, setQ] = useState(make);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const t0 = useMemo(() => performance.now(), [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    setQ(make());
    setFound(new Set());
    setMistakes(0);
    setWrong(null);
    setRevealed(false);
    setElapsed(null);
  }, [make]);
  useEffect(reset, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const req = new Set(q.cluster.map((n) => key(n.string, n.fret)));
  const done = found.size === req.size;
  const fretMax = Math.max(15, ...q.cluster.map((n) => n.fret + 1));

  const onCell = (s: number, f: number) => {
    if (done || revealed) return;
    const k = key(s, f);
    if (found.has(k)) return;
    if (req.has(k)) {
      const nf = new Set(found).add(k);
      setFound(nf);
      if (nf.size === req.size) {
        setElapsed((performance.now() - t0) / 1000);
        quiz.mark(mistakes === 0);
      }
    } else {
      setMistakes((m) => m + 1);
      setWrong(k);
      quiz.mark(false);
      later(() => setWrong(null), 600);
    }
  };

  const lab = (pc: number) => {
    const n = q.scale.byPc.get(pc);
    return n ? noteLabel(n.spelled, env.lang) : undefined;
  };
  const markers: Marker[] = [];
  if (cfg.hint === 'root' || cfg.hint === 'shape')
    for (let s = 0; s < env.tuning.length; s++)
      for (let f = 0; f <= fretMax; f++) {
        const pc = pcAt(env.tuning, s, f);
        if (pc === q.scale.rootPc && !found.has(key(s, f))) markers.push({ string: s, fret: f, kind: 'root', label: lab(pc) });
        else if (cfg.hint === 'shape' && req.has(key(s, f)) && !found.has(key(s, f))) markers.push({ string: s, fret: f, kind: 'ghost' });
      }
  for (const k of found) {
    const [s, f] = k.split(':').map(Number);
    markers.push({ string: s, fret: f, kind: s >= 0 && pcAt(env.tuning, s, f) === q.scale.rootPc ? 'root' : 'correct', label: lab(pcAt(env.tuning, s, f)) });
  }
  if (revealed) for (const n of q.cluster) if (!found.has(key(n.string, n.fret))) markers.push({ string: n.string, fret: n.fret, kind: 'target', label: lab(n.pc) });
  if (wrong) {
    const [s, f] = wrong.split(':').map(Number);
    markers.push({ string: s, fret: f, kind: 'wrong' });
  }

  return (
    <>
      <QuizBar score={quiz.score} onReset={quiz.reset} />
      <Prompt state={done ? 'ok' : null}>
        {done ? (
          <>Shape completo em <b>{elapsed?.toFixed(1)}s</b> com {mistakes} erro(s)</>
        ) : (
          <>
            Toque todas as notas de <b>{noteLabel(q.scale.root, env.lang)} {def.name}</b> — posição <b>{q.pos.label}</b>{' '}
            <span className="muted">({found.size}/{req.size})</span>
          </>
        )}
      </Prompt>
      <Board env={env} fretMax={fretMax} markers={markers} onCell={onCell} />
      <div className="row gap">
        <button type="button" className="btn primary" onClick={reset}>{done || revealed ? 'Novo shape' : 'Pular'}</button>
        {!done && !revealed && <button type="button" className="btn" onClick={() => { setRevealed(true); quiz.mark(false); }}>Revelar</button>}
      </div>
      <details className="panel quiz-config">
        <summary>Configurar</summary>
        <Field label="Escala"><ScaleSelect value={cfg.scaleId} onChange={(scaleId) => setCfg({ ...cfg, scaleId, pos: -1 })} /></Field>
        <Field label="Tônica">
          <Chips small value={cfg.root} onChange={(root) => setCfg({ ...cfg, root })} options={[{ value: -1, label: 'Aleatória' }, ...Array.from({ length: 12 }, (_, pc) => ({ value: pc, label: pcLabel(pc, env.pref, env.lang) }))]} />
        </Field>
        <Field label="Posição">
          <Chips small value={cfg.pos} onChange={(pos) => setCfg({ ...cfg, pos })} options={[{ value: -1, label: 'Aleatória' }, ...q.scale.notes.map((_, i) => ({ value: i, label: i + 1 }))]} />
        </Field>
        <Field label="Ajuda">
          <Chips small value={cfg.hint} onChange={(hint) => setCfg({ ...cfg, hint })} options={[{ value: 'shape', label: 'Contorno do shape' }, { value: 'root', label: 'Só as tônicas' }, { value: 'none', label: 'Nenhuma' }]} />
        </Field>
      </details>
    </>
  );
}

// ============ 7. Soletre a escala ============

const SPELL_POOLS: Record<string, string[]> = {
  basic: ['major', 'natural-minor', 'major-pent', 'minor-pent'],
  modes: ['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'],
  all: SCALES.map((s) => s.id),
};

export function ScaleSpell() {
  const env = useBoardEnv();
  const quiz = useQuiz('scale-spell');
  const later = useLater();
  const [pool, setPool] = useLocalStorage<{ id: string }>('ss.cfg.scale-spell', { id: 'basic' });
  const make = useCallback((): Scale => buildScale(scaleById(pick(SPELL_POOLS[pool.id] ?? SPELL_POOLS.basic)), randInt(12), env.pref), [pool.id, env.pref]);
  const [scale, setScale] = useState(make);
  const [step, setStep] = useState(0);
  const [bad, setBad] = useState<number | null>(null);
  const [errors, setErrors] = useState(0);
  const done = step >= scale.notes.length;

  const next = useCallback(() => {
    setScale(make());
    setStep(0);
    setBad(null);
    setErrors(0);
    quiz.startTimer();
  }, [make, quiz]);
  useEffect(next, [pool.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (pc: number) => {
    if (done) return;
    if (pc === scale.notes[step].pc) {
      setStep(step + 1);
      setBad(null);
      if (step + 1 === scale.notes.length) {
        quiz.mark(errors === 0);
        later(next, 1500);
      }
    } else {
      setErrors((e) => e + 1);
      setBad(pc);
      quiz.mark(false);
      later(() => setBad(null), 500);
    }
  };

  return (
    <>
      <QuizBar score={quiz.score} onReset={quiz.reset} />
      <Prompt state={done ? 'ok' : null}>
        Soletre a escala de <b>{noteLabel(scale.root, env.lang)} {scale.def.name}</b>
      </Prompt>
      <div className="spell-slots">
        {scale.notes.map((n, i) => (
          <div key={i} className={`slot${i < step ? ' filled' : ''}${i === step ? ' current' : ''}`}>
            <b>{i < step ? noteLabel(n.spelled, env.lang) : '?'}</b>
            <small>{n.token}</small>
          </div>
        ))}
      </div>
      <div className="answer-grid">
        {Array.from({ length: 12 }, (_, pc) => (
          <button key={pc} type="button" className={`btn answer${bad === pc ? ' shake' : ''}`} onClick={() => onPick(pc)}>
            {pcLabelBoth(pc, env.lang)}
          </button>
        ))}
      </div>
      <Field label="Escalas sorteadas">
        <Chips small value={pool.id} onChange={(id) => setPool({ id })} options={[{ value: 'basic', label: 'Básicas' }, { value: 'modes', label: 'Modos' }, { value: 'all', label: 'Todas' }]} />
      </Field>
    </>
  );
}

// ============ 8. Que escala é essa? ============

export function ScaleId() {
  const env = useBoardEnv();
  const quiz = useQuiz('scale-id');
  const later = useLater();
  const [pool, setPool] = useLocalStorage<{ id: string }>('ss.cfg.scale-id', { id: 'basic' });
  const ids = useMemo(
    () =>
      ({
        basic: ['major', 'natural-minor', 'major-pent', 'minor-pent', 'blues-minor'],
        modes: ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'natural-minor', 'locrian'],
        all: SCALES.map((s) => s.id),
      })[pool.id] ?? [],
    [pool.id],
  );
  const make = useCallback(() => {
    const id = pick(ids);
    const others = shuffle(ids.filter((x) => x !== id)).slice(0, 3);
    return { scale: buildScale(scaleById(id), randInt(12), env.pref), options: shuffle([id, ...others]) };
  }, [ids, env.pref]);
  const [q, setQ] = useState(make);
  const [fb, setFb] = useState<{ ok: boolean; picked: string } | null>(null);

  const next = useCallback(() => {
    setFb(null);
    setQ(make());
    quiz.startTimer();
  }, [make, quiz]);
  useEffect(next, [pool.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (id: string) => {
    if (fb) return;
    const ok = id === q.scale.def.id;
    quiz.mark(ok);
    setFb({ ok, picked: id });
    later(next, ok ? 900 : 2200);
  };

  const markers: Marker[] = [];
  for (let s = 0; s < env.tuning.length; s++)
    for (let f = 0; f <= 12; f++) {
      const n = q.scale.byPc.get(pcAt(env.tuning, s, f));
      if (n) markers.push({ string: s, fret: f, kind: n.index === 0 ? 'root' : 'scale', label: fb ? n.token : undefined });
    }
  return (
    <>
      <QuizBar score={quiz.score} onReset={quiz.reset} />
      <Prompt state={fb ? (fb.ok ? 'ok' : 'bad') : null}>
        {fb ? <>É <b>{noteLabel(q.scale.root, env.lang)} {q.scale.def.name}</b></> : <>Que escala é essa? Tônica: <b>{noteLabel(q.scale.root, env.lang)}</b> (rosa)</>}
      </Prompt>
      <Board env={env} fretMax={12} markers={markers} />
      <div className="answer-grid wide">
        {q.options.map((id) => (
          <button key={id} type="button" className={`btn answer${fb && id === q.scale.def.id ? ' right' : ''}${fb && fb.picked === id && !fb.ok ? ' wrongpick' : ''}`} disabled={!!fb} onClick={() => onPick(id)}>
            {scaleById(id).name}
          </button>
        ))}
      </div>
      <Field label="Escalas sorteadas">
        <Chips small value={pool.id} onChange={(id) => setPool({ id })} options={[{ value: 'basic', label: 'Básicas' }, { value: 'modes', label: 'Modos' }, { value: 'all', label: 'Todas' }]} />
      </Field>
    </>
  );
}
