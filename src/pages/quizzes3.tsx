import { useCallback, useEffect, useMemo, useState } from 'react';
import { autoPref, romanOf, shortName, sym } from '../components/FieldViews';
import { Prompt, QuizBar, useBoardEnv, useLater, useQuiz } from '../components/quiz';
import { Chips, Field, Toggle } from '../components/ui';
import { chordTypeById } from '../lib/chords';
import { buildField, fieldById, type Field as HField, type FieldChord } from '../lib/harmony';
import { noteLabel, pick, randInt, shuffle } from '../lib/music';
import { useLocalStorage } from '../lib/storage';

const POOLS: Record<string, { label: string; ids: string[] }> = {
  major: { label: 'Só maior', ids: ['major'] },
  minor: { label: 'Menores', ids: ['natural-minor', 'harmonic-minor'] },
  tonal: { label: 'Maior + menores', ids: ['major', 'natural-minor', 'harmonic-minor', 'melodic-minor'] },
  modes: { label: 'Modais', ids: ['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'] },
};

interface Cfg {
  pool: string;
  tetrad: boolean;
}

function useCfg(id: string) {
  return useLocalStorage<Cfg>(`ss.cfg.${id}`, { pool: 'major', tetrad: false });
}

function FieldConfig({ cfg, setCfg }: { cfg: Cfg; setCfg: (c: Cfg) => void }) {
  return (
    <details className="panel quiz-config">
      <summary>Configurar</summary>
      <Field label="Campos sorteados">
        <Chips small value={cfg.pool} onChange={(pool) => setCfg({ ...cfg, pool })} options={Object.entries(POOLS).map(([value, v]) => ({ value, label: v.label }))} />
      </Field>
      <Toggle label="Usar tétrades (acordes com sétima)" checked={cfg.tetrad} onChange={(tetrad) => setCfg({ ...cfg, tetrad })} />
    </details>
  );
}

function randomField(cfg: Cfg, fallback: 'sharp' | 'flat'): HField {
  const def = fieldById(pick(POOLS[cfg.pool]?.ids ?? POOLS.major.ids));
  const root = randInt(12);
  return buildField(def, root, autoPref(def, root, fallback));
}

/** Alternativas erradas "convincentes": mesma tônica com outra qualidade e acordes de outros graus do campo. */
function wrongChords(field: HField, c: FieldChord, tetrad: boolean, n: number): string[] {
  const correct = sym(c, tetrad);
  const quals = tetrad ? ['maj7', '7', 'm7', 'm7b5'] : ['maj', 'min', 'dim', 'aug'];
  const pool = new Set<string>();
  for (const q of shuffle(quals)) pool.add(c.rootName + chordTypeById(q).symbol);
  for (const o of shuffle(field.chords)) pool.add(sym(o, tetrad));
  pool.delete(correct);
  return shuffle([...pool]).slice(0, n);
}

function FieldStrip({ field, tetrad }: { field: HField; tetrad: boolean }) {
  return (
    <div className="field-strip">
      {field.chords.map((c) => (
        <span key={c.degree} className={`prog-chord func-${c.func ?? 'none'}`}>
          <b>{sym(c, tetrad)}</b>
          <small>{romanOf(c, tetrad)}</small>
        </span>
      ))}
    </div>
  );
}

const ROMAN_NAMES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

// ============ Qual é o acorde do grau X? ============

export function FieldChordQuiz() {
  const env = useBoardEnv();
  const [cfg, setCfg] = useCfg('field-chord');
  const quiz = useQuiz('field-chord');
  const later = useLater();
  const make = useCallback(() => {
    const field = randomField(cfg, env.pref);
    const c = field.chords[randInt(7)];
    return { field, c, options: shuffle([sym(c, cfg.tetrad), ...wrongChords(field, c, cfg.tetrad, 3)]) };
  }, [cfg, env.pref]);
  const [q, setQ] = useState(make);
  const [fb, setFb] = useState<{ ok: boolean; picked: string } | null>(null);

  const next = useCallback(() => {
    setFb(null);
    setQ(make());
    quiz.startTimer();
  }, [make, quiz]);
  useEffect(next, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (s: string) => {
    if (fb) return;
    const ok = s === sym(q.c, cfg.tetrad);
    quiz.mark(ok);
    setFb({ ok, picked: s });
    later(next, ok ? 1200 : 3200);
  };

  return (
    <>
      <QuizBar score={quiz.score} onReset={quiz.reset} />
      <Prompt state={fb ? (fb.ok ? 'ok' : 'bad') : null}>
        No campo de <b>{noteLabel(q.field.scale.root, env.lang)} {shortName(q.field.def)}</b>, qual é o acorde do grau <b>{ROMAN_NAMES[q.c.degree - 1]}</b>?
        {fb && <div className="prompt-sub">Resposta: {sym(q.c, cfg.tetrad)} ({romanOf(q.c, cfg.tetrad)}) · {cfg.tetrad ? q.c.fullNameTetrad : q.c.fullName}</div>}
      </Prompt>
      <div className="answer-grid">
        {q.options.map((o) => (
          <button key={o} type="button" className={`btn answer${fb && o === sym(q.c, cfg.tetrad) ? ' right' : ''}${fb && fb.picked === o && !fb.ok ? ' wrongpick' : ''}`} disabled={!!fb} onClick={() => onPick(o)}>
            {o}
          </button>
        ))}
      </div>
      {fb && <FieldStrip field={q.field} tetrad={cfg.tetrad} />}
      <FieldConfig cfg={cfg} setCfg={setCfg} />
    </>
  );
}

// ============ Que grau é esse acorde? ============

export function FieldDegreeQuiz() {
  const env = useBoardEnv();
  const [cfg, setCfg] = useCfg('field-degree');
  const quiz = useQuiz('field-degree');
  const later = useLater();
  const make = useCallback(() => {
    const field = randomField(cfg, env.pref);
    return { field, c: field.chords[randInt(7)] };
  }, [cfg, env.pref]);
  const [q, setQ] = useState(make);
  const [fb, setFb] = useState<{ ok: boolean; picked: number } | null>(null);

  const next = useCallback(() => {
    setFb(null);
    setQ(make());
    quiz.startTimer();
  }, [make, quiz]);
  useEffect(next, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (degree: number) => {
    if (fb) return;
    const ok = degree === q.c.degree;
    quiz.mark(ok);
    setFb({ ok, picked: degree });
    later(next, ok ? 1200 : 3200);
  };

  return (
    <>
      <QuizBar score={quiz.score} onReset={quiz.reset} />
      <Prompt state={fb ? (fb.ok ? 'ok' : 'bad') : null}>
        No campo de <b>{noteLabel(q.field.scale.root, env.lang)} {shortName(q.field.def)}</b>, que grau é o acorde <b>{sym(q.c, cfg.tetrad)}</b>?
        {fb && <div className="prompt-sub">É o {q.c.degree}º grau: {romanOf(q.c, cfg.tetrad)} · {cfg.tetrad ? q.c.fullNameTetrad : q.c.fullName}</div>}
      </Prompt>
      <div className="answer-grid">
        {q.field.chords.map((c) => (
          <button key={c.degree} type="button" className={`btn answer${fb && c.degree === q.c.degree ? ' right' : ''}${fb && fb.picked === c.degree && !fb.ok ? ' wrongpick' : ''}`} disabled={!!fb} onClick={() => onPick(c.degree)}>
            {ROMAN_NAMES[c.degree - 1]}
            <small>{c.token}</small>
          </button>
        ))}
      </div>
      {fb && <FieldStrip field={q.field} tetrad={cfg.tetrad} />}
      <FieldConfig cfg={cfg} setCfg={setCfg} />
    </>
  );
}

// ============ Monte o campo (7 acordes na ordem) ============

export function FieldBuildQuiz() {
  const env = useBoardEnv();
  const [cfg, setCfg] = useCfg('field-build');
  const quiz = useQuiz('field-build');
  const later = useLater();
  const [field, setField] = useState(() => randomField(cfg, env.pref));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState(0);
  const [bad, setBad] = useState<string | null>(null);

  const c = field.chords[Math.min(step, 6)];
  const done = step >= 7;
  const options = useMemo(() => (done ? [] : shuffle([sym(c, cfg.tetrad), ...wrongChords(field, c, cfg.tetrad, 5)])), [field, c, done, cfg.tetrad]);

  const next = useCallback(() => {
    setField(randomField(cfg, env.pref));
    setStep(0);
    setErrors(0);
    setBad(null);
    quiz.startTimer();
  }, [cfg, env.pref, quiz]);
  useEffect(next, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (s: string) => {
    if (done) return;
    if (s === sym(c, cfg.tetrad)) {
      setBad(null);
      setStep(step + 1);
      if (step + 1 === 7) {
        quiz.mark(errors === 0);
        later(next, 2200);
      }
    } else {
      setErrors((e) => e + 1);
      setBad(s);
      later(() => setBad(null), 500);
    }
  };

  return (
    <>
      <QuizBar score={quiz.score} onReset={quiz.reset} />
      <Prompt state={done ? 'ok' : null}>
        {done ? (
          <>Campo completo! {errors === 0 ? 'Sem erros.' : `${errors} erro(s).`}</>
        ) : (
          <>
            Monte o campo de <b>{noteLabel(field.scale.root, env.lang)} {shortName(field.def)}</b>: acorde do grau <b>{ROMAN_NAMES[step]}</b>
          </>
        )}
      </Prompt>
      <div className="field-strip">
        {field.chords.map((x, i) => (
          <span key={x.degree} className={`prog-chord func-${x.func ?? 'none'}${i === step ? ' current' : ''}`}>
            <b>{i < step ? sym(x, cfg.tetrad) : '?'}</b>
            <small>{romanOf(x, cfg.tetrad)}</small>
          </span>
        ))}
      </div>
      {!done && (
        <div className="answer-grid">
          {options.map((o) => (
            <button key={o} type="button" className={`btn answer${bad === o ? ' shake' : ''}`} onClick={() => onPick(o)}>
              {o}
            </button>
          ))}
        </div>
      )}
      <FieldConfig cfg={cfg} setCfg={setCfg} />
    </>
  );
}

