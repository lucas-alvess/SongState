import { useCallback, useEffect, useMemo, useState } from 'react';
import { Fretboard, type Marker } from '../components/Fretboard';
import { Chips, Field, Toggle } from '../components/ui';
import { Prompt, QuizBar, useBoardEnv, useLater, useQuiz } from '../components/quiz';
import { chordFullName, chordNotes, chordPcs, chordSymbol, chordTypeById, detectChords, findVoicings } from '../lib/chords';
import { getCtx, pluck, strum } from '../lib/audio';
import { INTERVAL_NAMES, INTERVAL_TOKENS, mod12, pcAt, pcLabel, pcLabelBoth, pick, randInt, tokenSemis } from '../lib/music';
import { useLocalStorage } from '../lib/storage';

// ============ Notas do acorde ============

const SPELL_SETS: Record<string, string[]> = {
  triads: ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4'],
  sevenths: ['7', 'maj7', 'm7', 'm7b5', 'dim7'],
  all: ['maj', 'min', 'dim', 'aug', 'sus4', '7', 'maj7', 'm7', 'm7b5', '6', 'm6', 'add9', '9'],
};

export function ChordSpell() {
  const env = useBoardEnv();
  const quiz = useQuiz('chord-spell');
  const later = useLater();
  const [set, setSet] = useLocalStorage<{ id: string }>('ss.cfg.chord-spell', { id: 'triads' });
  const make = useCallback(() => ({ root: randInt(12), type: chordTypeById(pick(SPELL_SETS[set.id] ?? SPELL_SETS.triads)) }), [set.id]);
  const [q, setQ] = useState(make);
  const [found, setFound] = useState<number[]>([]);
  const [bad, setBad] = useState<number | null>(null);
  const [errors, setErrors] = useState(0);

  const notes = chordNotes(q.root, q.type, env.pref);
  const done = found.length === notes.length;

  const next = useCallback(() => {
    setQ(make());
    setFound([]);
    setBad(null);
    setErrors(0);
    quiz.startTimer();
  }, [make, quiz]);
  useEffect(next, [set.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (pc: number) => {
    if (done || found.includes(pc)) return;
    if (notes.some((n) => n.pc === pc)) {
      const nf = [...found, pc];
      setFound(nf);
      if (nf.length === notes.length) {
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
        Quais as notas de <b>{chordSymbol(q.root, q.type, q.root, env.pref)}</b>?
        <div className="prompt-sub">{chordFullName(q.root, q.type, q.root, env.pref)}</div>
      </Prompt>
      <div className="spell-slots">
        {notes.map((n) => (
          <div key={n.token} className={`slot${found.includes(n.pc) ? ' filled' : ''}`}>
            <b>{found.includes(n.pc) ? pcLabel(n.pc, env.pref, env.lang) : '?'}</b>
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
      <Field label="Acordes sorteados">
        <Chips small value={set.id} onChange={(id) => setSet({ id })} options={[{ value: 'triads', label: 'Tríades' }, { value: 'sevenths', label: 'Sétimas' }, { value: 'all', label: 'Todos' }]} />
      </Field>
    </>
  );
}

// ============ Monte o acorde ============

export function ChordBuild() {
  const env = useBoardEnv();
  const quiz = useQuiz('chord-build');
  const later = useLater();
  const N = env.tuning.length;
  const [set, setSet] = useLocalStorage<{ id: string }>('ss.cfg.chord-build', { id: 'triads' });
  const make = useCallback(() => ({ root: randInt(12), type: chordTypeById(pick(SPELL_SETS[set.id] ?? SPELL_SETS.triads)) }), [set.id]);
  const [q, setQ] = useState(make);
  const [sel, setSel] = useState<number[]>(() => Array(N).fill(-1));
  const [result, setResult] = useState<{ ok: boolean; msg: string; show?: number[] } | null>(null);

  const next = useCallback(() => {
    setQ(make());
    setSel(Array(N).fill(-1));
    setResult(null);
    quiz.startTimer();
  }, [make, quiz, N]);
  useEffect(next, [set.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pcs = chordPcs(q.root, q.type.id);

  const onCell = (s: number, f: number) => {
    if (result?.ok) return;
    setResult(null);
    setSel((cur) => cur.map((x, i) => (i === s ? (x === f ? -1 : f) : x)));
    if (sel[s] !== f) strum([env.tuning[s] + f], 0);
  };

  const check = () => {
    const played = sel.map((f, s) => (f >= 0 ? pcAt(env.tuning, s, f) : -1)).filter((p) => p >= 0);
    const required = new Set(pcs);
    if (pcs.length >= 4) required.delete(mod12(q.root + 7));
    const covers = [...required].every((p) => played.includes(p));
    const onlyChord = played.every((p) => pcs.includes(p));
    const ok = covers && onlyChord && played.length >= Math.min(3, pcs.length);
    quiz.mark(ok);
    if (ok) {
      setResult({ ok, msg: 'Acorde correto!' });
      later(next, 1500);
    } else {
      const first = played.length ? detectChords(played, played[0])[0] : null;
      setResult({ ok, msg: first ? `Você montou ${chordSymbol(first.rootPc, first.type, first.bassPc, env.pref)}.` : 'Faltam notas do acorde.' });
    }
  };

  const reveal = () => {
    const v = findVoicings(q.root, q.type, env.tuning, 1)[0];
    if (!v) return;
    quiz.mark(false);
    setSel(v.frets);
    setResult({ ok: false, msg: 'Uma digitação possível:', show: v.frets });
  };

  const markers: Marker[] = sel.flatMap((f, s) => (f >= 0 ? [{ string: s, fret: f, kind: result ? (result.ok ? 'correct' : result.show ? 'target' : 'chord') : 'chord', label: result ? pcLabel(pcAt(env.tuning, s, f), env.pref, env.lang) : undefined } as Marker] : []));
  const notes = chordNotes(q.root, q.type, env.pref);

  return (
    <>
      <QuizBar score={quiz.score} onReset={quiz.reset} />
      <Prompt state={result ? (result.ok ? 'ok' : 'bad') : null}>
        Monte <b>{chordSymbol(q.root, q.type, q.root, env.pref)}</b>
        <div className="prompt-sub">{result ? result.msg : chordFullName(q.root, q.type, q.root, env.pref)}</div>
      </Prompt>
      <div className="board-wrap">
        <div className="board-scroll">
          <Fretboard tuning={env.tuning} fretMax={12} vertical={env.vertical} leftHanded={env.leftHanded} markers={markers} onCell={onCell} quiz />
        </div>
      </div>
      <div className="row gap wrap">
        <button type="button" className="btn primary" onClick={check} disabled={!sel.some((f) => f >= 0) || result?.ok}>
          Verificar
        </button>
        <button type="button" className="btn" onClick={() => setSel(Array(N).fill(-1))}>
          Limpar
        </button>
        <button type="button" className="btn" onClick={reveal}>
          Mostrar uma digitação
        </button>
        <button type="button" className="btn" onClick={next}>
          Pular
        </button>
      </div>
      {result?.show && <p className="muted">Notas do acorde: {notes.map((n) => pcLabel(n.pc, env.pref, env.lang)).join(' · ')}</p>}
      <Field label="Acordes sorteados">
        <Chips small value={set.id} onChange={(id) => setSet({ id })} options={[{ value: 'triads', label: 'Tríades' }, { value: 'sevenths', label: 'Sétimas' }, { value: 'all', label: 'Todos' }]} />
      </Field>
    </>
  );
}

// ============ Ouvido: intervalos ============

const EAR_SETS: Record<string, number[]> = {
  basic: [3, 4, 5, 7, 12],
  medium: [2, 3, 4, 5, 7, 9, 10, 12],
  all: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

export function EarInterval() {
  const env = useBoardEnv();
  const quiz = useQuiz('ear-interval');
  const later = useLater();
  const [cfg, setCfg] = useLocalStorage<{ set: string; harmonic: boolean }>('ss.cfg.ear-interval', { set: 'basic', harmonic: false });
  const make = useCallback(() => ({ root: 52 + randInt(13), i: pick(EAR_SETS[cfg.set] ?? EAR_SETS.basic) }), [cfg.set]);
  const [q, setQ] = useState(make);
  const [started, setStarted] = useState(false);
  const [fb, setFb] = useState<{ ok: boolean } | null>(null);

  const play = useCallback(
    (qq = q) => {
      const c = getCtx();
      const t = c.currentTime + 0.05;
      pluck(c, qq.root, t);
      pluck(c, qq.root + qq.i, t + (cfg.harmonic ? 0 : 0.8));
    },
    [q, cfg.harmonic],
  );

  const next = useCallback(() => {
    const nq = make();
    setFb(null);
    setQ(nq);
    quiz.startTimer();
    if (started) later(() => play(nq), 300);
  }, [make, quiz, started, later, play]);
  useEffect(() => {
    setQ(make());
    setFb(null);
  }, [cfg.set]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (i: number) => {
    if (fb || !started) return;
    const ok = i === q.i;
    quiz.mark(ok);
    setFb({ ok });
    later(next, ok ? 900 : 2000);
  };

  const options = EAR_SETS[cfg.set] ?? EAR_SETS.basic;
  const tok = (i: number) => (i === 12 ? '8ª' : INTERVAL_TOKENS[i]);
  const name = (i: number) => (i === 12 ? 'Oitava' : INTERVAL_NAMES[i]);

  return (
    <>
      <QuizBar score={quiz.score} onReset={quiz.reset} />
      <Prompt state={fb ? (fb.ok ? 'ok' : 'bad') : null}>
        {fb ? (fb.ok ? 'Isso mesmo!' : <>Era <b>{name(q.i)}</b> ({tok(q.i)})</>) : started ? 'Que intervalo você ouviu?' : 'Pressione "Ouvir" para começar'}
        <div className="prompt-sub">
          {pcLabel(q.root % 12, env.pref, env.lang)} + {fb ? name(q.i) : '?'}
        </div>
      </Prompt>
      <div className="row gap wrap" style={{ justifyContent: 'center', marginBottom: 12 }}>
        <button
          type="button"
          className="btn primary big"
          onClick={() => {
            setStarted(true);
            play();
          }}
        >
          {started ? 'Ouvir de novo' : 'Ouvir'}
        </button>
      </div>
      <div className="answer-grid">
        {options.map((i) => (
          <button key={i} type="button" className="btn answer" disabled={!!fb || !started} onClick={() => onPick(i)}>
            <b>{tok(i)}</b>
            <small>{name(i)}</small>
          </button>
        ))}
      </div>
      <div className="panel soft">
        <Field label="Intervalos sorteados">
          <Chips small value={cfg.set} onChange={(set) => setCfg({ ...cfg, set })} options={[{ value: 'basic', label: 'Básicos' }, { value: 'medium', label: 'Intermediários' }, { value: 'all', label: 'Todos' }]} />
        </Field>
        <Toggle label="Tocar as duas notas juntas (harmônico)" checked={cfg.harmonic} onChange={(harmonic) => setCfg({ ...cfg, harmonic })} />
      </div>
    </>
  );
}

// ============ Ouvido: acordes ============

const EAR_CHORDS: Record<string, string[]> = {
  basic: ['maj', 'min'],
  medium: ['maj', 'min', 'dim', 'aug'],
  all: ['maj', 'min', 'dim', 'aug', '7', 'maj7', 'm7'],
};
const EAR_LABEL: Record<string, string> = { maj: 'Maior', min: 'Menor', dim: 'Diminuto', aug: 'Aumentado', '7': 'Dominante (7)', maj7: 'Maior com 7ª maior', m7: 'Menor com 7ª' };

export function EarChord() {
  const env = useBoardEnv();
  const quiz = useQuiz('ear-chord');
  const later = useLater();
  const [set, setSet] = useLocalStorage<{ id: string }>('ss.cfg.ear-chord', { id: 'basic' });
  const make = useCallback(() => ({ root: 48 + randInt(12), type: pick(EAR_CHORDS[set.id] ?? EAR_CHORDS.basic) }), [set.id]);
  const [q, setQ] = useState(make);
  const [started, setStarted] = useState(false);
  const [fb, setFb] = useState<{ ok: boolean } | null>(null);

  const play = useCallback((qq = q) => {
    const semis = chordTypeById(qq.type).tokens.map(tokenSemis);
    strum(semis.map((s) => qq.root + s), 0.07, 0.3);
  }, [q]);

  const next = useCallback(() => {
    const nq = make();
    setFb(null);
    setQ(nq);
    quiz.startTimer();
    if (started) later(() => play(nq), 300);
  }, [make, quiz, started, later, play]);
  useEffect(() => {
    setQ(make());
    setFb(null);
  }, [set.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (id: string) => {
    if (fb || !started) return;
    const ok = id === q.type;
    quiz.mark(ok);
    setFb({ ok });
    later(next, ok ? 900 : 2000);
  };
  const options = useMemo(() => EAR_CHORDS[set.id] ?? EAR_CHORDS.basic, [set.id]);

  return (
    <>
      <QuizBar score={quiz.score} onReset={quiz.reset} />
      <Prompt state={fb ? (fb.ok ? 'ok' : 'bad') : null}>
        {fb ? (fb.ok ? 'Isso mesmo!' : <>Era <b>{EAR_LABEL[q.type]}</b></>) : started ? 'Que tipo de acorde é esse?' : 'Pressione "Ouvir" para começar'}
        <div className="prompt-sub">{fb ? chordSymbol(q.root % 12, chordTypeById(q.type), q.root % 12, env.pref) : '?'}</div>
      </Prompt>
      <div className="row gap wrap" style={{ justifyContent: 'center', marginBottom: 12 }}>
        <button
          type="button"
          className="btn primary big"
          onClick={() => {
            setStarted(true);
            play();
          }}
        >
          {started ? 'Ouvir de novo' : 'Ouvir'}
        </button>
      </div>
      <div className="answer-grid wide">
        {options.map((id) => (
          <button key={id} type="button" className="btn answer" disabled={!!fb || !started} onClick={() => onPick(id)}>
            {EAR_LABEL[id]}
          </button>
        ))}
      </div>
      <Field label="Tipos sorteados">
        <Chips small value={set.id} onChange={(id) => setSet({ id })} options={[{ value: 'basic', label: 'Maior / Menor' }, { value: 'medium', label: '+ dim / aug' }, { value: 'all', label: '+ sétimas' }]} />
      </Field>
      <p className="muted small-text">Dica: acordes maiores soam “abertos” e brilhantes; menores, mais escuros; o diminuto é tenso e instável; o aumentado soa “flutuante”.</p>
    </>
  );
}
