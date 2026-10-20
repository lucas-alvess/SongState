import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Chips, Field, Toggle } from './ui';
import { pcLabelBoth, tuningById, pcLabel } from '../lib/music';
import { useLocalStorage, useSettings, useStats, useVertical } from '../lib/storage';

/** Dados comuns a todos os exercícios com braço. */
export function useBoardEnv() {
  const { settings } = useSettings();
  const vertical = useVertical();
  const tuning = tuningById(settings.tuningId).midi;
  return { tuning, vertical, leftHanded: settings.leftHanded, lang: settings.lang, pref: settings.pref };
}

interface Score {
  correct: number;
  wrong: number;
  streak: number;
  best: number;
  times: number[];
}
const ZERO: Score = { correct: 0, wrong: 0, streak: 0, best: 0, times: [] };

export function useQuiz(id: string) {
  const { record } = useStats();
  const [score, setScore] = useState<Score>(ZERO);
  const ref = useRef<Score>(ZERO);
  const t0 = useRef(performance.now());

  const startTimer = useCallback(() => {
    t0.current = performance.now();
  }, []);
  const mark = useCallback(
    (ok: boolean) => {
      const p = ref.current;
      const streak = ok ? p.streak + 1 : 0;
      const next: Score = {
        correct: p.correct + (ok ? 1 : 0),
        wrong: p.wrong + (ok ? 0 : 1),
        streak,
        best: Math.max(p.best, streak),
        times: ok ? [...p.times.slice(-19), performance.now() - t0.current] : p.times,
      };
      ref.current = next;
      setScore(next);
      record(id, ok, streak);
    },
    [id, record],
  );
  const reset = useCallback(() => {
    ref.current = ZERO;
    setScore(ZERO);
  }, []);
  return { score, mark, reset, startTimer };
}

/** Executa uma ação adiada e cancela ao desmontar. */
export function useLater() {
  const ids = useRef<number[]>([]);
  useEffect(() => () => ids.current.forEach(clearTimeout), []);
  return useCallback((fn: () => void, ms: number) => {
    ids.current.push(window.setTimeout(fn, ms));
  }, []);
}

export function QuizBar({ score, onReset }: { score: Score; onReset: () => void }) {
  const avg = score.times.length ? (score.times.reduce((a, b) => a + b, 0) / score.times.length / 1000).toFixed(1) : '–';
  return (
    <div className="quizbar">
      <span className="stat ok">✓ {score.correct}</span>
      <span className="stat bad">✗ {score.wrong}</span>
      <span className="stat">🔥 {score.streak}</span>
      <span className="stat">melhor {score.best}</span>
      <span className="stat">⏱ {avg}s</span>
      <button type="button" className="btn small" onClick={onReset}>
        Zerar
      </button>
    </div>
  );
}

export function Prompt({ children, state }: { children: ReactNode; state?: 'ok' | 'bad' | null }) {
  return <div className={`prompt${state ? ` ${state}` : ''}`}>{children}</div>;
}

// ---------- Configuração de notas (cordas / casas / acidentes) ----------

export interface NoteCfg {
  strings: number[]; // vazio = todas
  maxFret: number;
  accidentals: boolean;
}
export const DEFAULT_NOTE_CFG: NoteCfg = { strings: [], maxFret: 12, accidentals: false };

export function useNoteCfg(id: string) {
  return useLocalStorage<NoteCfg>(`ss.cfg.${id}`, DEFAULT_NOTE_CFG);
}

export function allowedStrings(cfg: NoteCfg, n: number) {
  const list = cfg.strings.filter((s) => s < n);
  return list.length ? list : Array.from({ length: n }, (_, i) => i);
}

export const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11];
export const notePool = (cfg: NoteCfg) => (cfg.accidentals ? Array.from({ length: 12 }, (_, i) => i) : NATURAL_PCS);

export function NoteConfig({ cfg, setCfg, tuning, noStrings }: { cfg: NoteCfg; setCfg: (c: NoteCfg) => void; tuning: number[]; noStrings?: boolean }) {
  const { settings } = useSettings();
  const active = allowedStrings(cfg, tuning.length);
  return (
    <details className="panel quiz-config">
      <summary>Configurar</summary>
      {!noStrings && (
        <Field label="Cordas">
          <div className="chips small">
            {tuning.map((m, s) => (
              <button
                key={s}
                type="button"
                className={`chip${active.includes(s) ? ' active' : ''}`}
                onClick={() => {
                  const next = active.includes(s) ? active.filter((x) => x !== s) : [...active, s];
                  setCfg({ ...cfg, strings: next.length === tuning.length || next.length === 0 ? [] : next });
                }}
              >
                {tuning.length - s}ª {pcLabel(m % 12, settings.pref, settings.lang)}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label="Até a casa">
        <Chips small value={cfg.maxFret} onChange={(maxFret) => setCfg({ ...cfg, maxFret })} options={[5, 7, 12, 15, 22].map((n) => ({ value: n, label: n }))} />
      </Field>
      <Toggle label="Incluir sustenidos e bemóis" checked={cfg.accidentals} onChange={(accidentals) => setCfg({ ...cfg, accidentals })} />
    </details>
  );
}

/** Botões com as 12 notas para responder. */
export function NoteButtons({ onPick, accidentals, disabled, lang }: { onPick: (pc: number) => void; accidentals: boolean; disabled?: boolean; lang: 'letters' | 'latin' }) {
  const pcs = accidentals ? Array.from({ length: 12 }, (_, i) => i) : NATURAL_PCS;
  return (
    <div className="answer-grid">
      {pcs.map((pc) => (
        <button key={pc} type="button" className="btn answer" disabled={disabled} onClick={() => onPick(pc)}>
          {pcLabelBoth(pc, lang)}
        </button>
      ))}
    </div>
  );
}
