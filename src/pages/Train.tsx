import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Fretboard, type Marker } from '../components/Fretboard';
import { Icon } from '../components/Icon';
import { Prompt, useBoardEnv, useLater } from '../components/quiz';
import { PageHeader } from '../components/ui';
import { pcAt, pcLabelBoth } from '../lib/music';
import { bumpDay, dueIds, gradeFirst, gradeRetry, prune, streak, weakest } from '../lib/srs';
import { useDays, useLocalStorage, useSettings, useSrs } from '../lib/storage';
import { CATEGORIES, KIND_TITLE, buildCard, isCorrect, kindOfId, kindsOf, planSession, type Card, type Category, type Ctx, type Kind } from '../lib/training';

interface Cfg {
  size: number;
  cats: Category[];
}
const DEFAULT_CFG: Cfg = { size: 12, cats: CATEGORIES.map((c) => c.id) };
const SIZES = [8, 12, 20];
const RETRY_GAP = 3; // quantos cartões depois um erro reaparece na mesma sessão

interface Entry {
  id: string;
  retry: boolean;
}
interface Result {
  id: string;
  kind: Kind;
  ok: boolean;
}

export function Train() {
  const { settings } = useSettings();
  const ctx = useMemo<Ctx>(() => ({ tuningId: settings.tuningId, pref: settings.pref, lang: settings.lang }), [settings.tuningId, settings.pref, settings.lang]);
  const [cfgRaw, setCfg] = useLocalStorage<Cfg>('ss.treino', DEFAULT_CFG);
  // preferência salva pode estar corrompida/antiga: normaliza antes de usar
  const cfg: Cfg = useMemo(() => {
    const valid = new Set<string>(CATEGORIES.map((c) => c.id));
    const cats = Array.isArray(cfgRaw.cats) ? (cfgRaw.cats.filter((c) => valid.has(c)) as Category[]) : DEFAULT_CFG.cats;
    return { size: SIZES.includes(cfgRaw.size) ? cfgRaw.size : DEFAULT_CFG.size, cats };
  }, [cfgRaw]);
  const kinds = useMemo(() => kindsOf(cfg.cats), [cfg.cats]);

  const [srs, setSrs] = useSrs();
  const [days, setDays] = useDays();

  const [queue, setQueue] = useState<Entry[] | null>(null); // null = tela inicial
  const [results, setResults] = useState<Result[]>([]);
  const [total, setTotal] = useState(0);

  const start = useCallback(() => {
    const plan = planSession({ srs, now: Date.now(), size: cfg.size, kinds, ctx });
    if (!plan.ids.length) return;
    setQueue(plan.ids.map((id) => ({ id, retry: false })));
    setTotal(plan.ids.length);
    setResults([]);
  }, [srs, cfg.size, kinds, ctx]);

  const answered = useCallback(
    (entry: Entry, ok: boolean) => {
      const now = Date.now();
      setSrs((cur) => prune({ ...cur, [entry.id]: entry.retry ? gradeRetry(cur[entry.id] ?? gradeFirst(undefined, false, now), ok, now) : gradeFirst(cur[entry.id], ok, now) }));
      if (!entry.retry) {
        setDays((d) => bumpDay(d, now, kindOfId(entry.id), ok));
        setResults((r) => [...r, { id: entry.id, kind: kindOfId(entry.id), ok }]);
        if (!ok) setQueue((q) => (q ? [...q.slice(0, RETRY_GAP + 1), { id: entry.id, retry: true }, ...q.slice(RETRY_GAP + 1)] : q)); // reaparece daqui a alguns cartões
      }
    },
    [setSrs, setDays],
  );

  const next = useCallback(() => setQueue((q) => (q ? q.slice(1) : q)), []);

  // fila vazia (mas não nula) = acabou a sessão
  if (queue && queue.length) return <Run key={queue[0].id + queue[0].retry} entry={queue[0]} ctx={ctx} position={results.length} total={total} onAnswer={answered} onNext={next} onQuit={() => setQueue(null)} />;
  if (queue) return <Summary results={results} ctx={ctx} onAgain={start} onHome={() => setQueue(null)} />;

  const dueNow = dueIds(srs, Date.now(), (id) => kinds.includes(kindOfId(id)) && buildCard(id, ctx) !== null).length;
  return <Home cfg={cfg} setCfg={setCfg} dueNow={dueNow} days={days} srsCount={Object.keys(srs).length} srs={srs} ctx={ctx} onStart={start} canStart={kinds.length > 0} />;
}

// ============ Tela inicial ============

function Home({ cfg, setCfg, dueNow, days, srsCount, srs, ctx, onStart, canStart }: { cfg: Cfg; setCfg: (v: Cfg | ((p: Cfg) => Cfg)) => void; dueNow: number; days: ReturnType<typeof useDays>[0]; srsCount: number; srs: ReturnType<typeof useSrs>[0]; ctx: Ctx; onStart: () => void; canStart: boolean }) {
  const now = Date.now();
  const run = streak(days, now);
  const todayKey = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  const today = days[`${todayKey.getFullYear()}-${p(todayKey.getMonth() + 1)}-${p(todayKey.getDate())}`];
  const weak = useMemo(
    () =>
      weakest(srs, 5)
        .map((w) => ({ w, card: buildCard(w.id, ctx) }))
        .filter((x): x is { w: ReturnType<typeof weakest>[number]; card: Card } => !!x.card),
    [srs, ctx],
  );
  const toggle = (id: Category) => setCfg((c) => ({ ...c, cats: c.cats.includes(id) ? c.cats.filter((x) => x !== id) : [...c.cats, id] }));

  return (
    <>
      <Link to="/exercicios" className="back">
        <Icon name="back" size={16} /> Exercícios
      </Link>
      <PageHeader eyebrow="Revisão espaçada" title="Treino de hoje" sub="Uma sessão curta que mistura os assuntos e repete mais as perguntas que você erra. Acertou, a pergunta volta daqui a mais dias; errou, volta em minutos." />

      <p className="muted small-text" style={{ margin: '0 0 10px' }}>
        <Link to="/progresso">Ver meu progresso e metas →</Link>
      </p>
      <section className="panel train-stats">
        <div>
          <b>{dueNow}</b>
          <span>para revisar agora</span>
        </div>
        <div>
          <b>{today?.n ?? 0}</b>
          <span>respostas hoje</span>
        </div>
        <div>
          <b>{run}</b>
          <span>{run === 1 ? 'dia seguido' : 'dias seguidos'}</span>
        </div>
        <div>
          <b>{srsCount}</b>
          <span>itens aprendendo</span>
        </div>
      </section>

      <section className="panel">
        <h3 aria-level={2} className="section-title">
          Assuntos
        </h3>
        <div className="chips" role="group" aria-label="Assuntos do treino">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={`chip${cfg.cats.includes(c.id) ? ' active' : ''}`} aria-pressed={cfg.cats.includes(c.id)} onClick={() => toggle(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <h3 aria-level={2} className="section-title">
          Tamanho da sessão
        </h3>
        <div className="chips" role="group" aria-label="Tamanho da sessão">
          {SIZES.map((n) => (
            <button key={n} type="button" className={`chip${cfg.size === n ? ' active' : ''}`} aria-pressed={cfg.size === n} onClick={() => setCfg((c) => ({ ...c, size: n }))}>
              {n} perguntas
            </button>
          ))}
        </div>
        <button type="button" className="btn primary big block" onClick={onStart} disabled={!canStart}>
          {dueNow > 0 ? `Começar (${Math.min(dueNow, cfg.size)} revisões + novas)` : 'Começar treino'}
        </button>
        {!canStart && <p className="notice err">Escolha ao menos um assunto.</p>}
      </section>

      {weak.length > 0 && (
        <section className="panel">
          <h3 aria-level={2} className="section-title">
            Seus pontos fracos
          </h3>
          <ul className="weak-list">
            {weak.map(({ w, card }) => (
              <li key={w.id}>
                <span className="tag">{KIND_TITLE[card.kind]}</span> {card.prompt}
                {card.sub ? ` — ${card.sub}` : ''}
                <span className="muted small-text">
                  {' '}
                  · errou {w.lapses} de {w.seen}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// ============ Uma pergunta ============

function Run({ entry, ctx, position, total, onAnswer, onNext, onQuit }: { entry: Entry; ctx: Ctx; position: number; total: number; onAnswer: (e: Entry, ok: boolean) => void; onNext: () => void; onQuit: () => void }) {
  const env = useBoardEnv();
  const later = useLater();
  const card = useMemo(() => buildCard(entry.id, ctx), [entry.id, ctx]);
  const [fb, setFb] = useState<{ ok: boolean; picked: string; clicked?: [number, number] } | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  // item que não pode ser montado (ex.: afinação removida): pula sem contar
  useEffect(() => {
    if (!card) onNext();
  }, [card, onNext]);
  useEffect(() => {
    if (fb && !fb.ok) nextRef.current?.focus();
  }, [fb]);

  const give = useCallback(
    (key: string, clicked?: [number, number]) => {
      if (!card || fb) return;
      const ok = isCorrect(card, key);
      setFb({ ok, picked: key, clicked });
      onAnswer(entry, ok);
      if (ok) later(onNext, entry.retry ? 1300 : 900);
    },
    [card, fb, entry, onAnswer, onNext, later],
  );

  if (!card) return null;

  let markers: Marker[] = card.board?.markers ?? [];
  if (card.board && fb) {
    if (card.kind === 'note') markers = markers.map((m) => ({ ...m, kind: fb.ok ? 'correct' : 'wrong', label: pcLabelBoth(Number(card.answer[0].slice(3)), ctx.lang) }));
    if (card.kind === 'find') {
      const [s, pc] = card.answer[0].split(':').map(Number);
      const targets: Marker[] = [];
      for (let f = 0; f <= card.board.fretMax; f++) if (pcAt(card.board.tuning, s, f) === pc) targets.push({ string: s, fret: f, kind: 'correct', label: pcLabelBoth(pc, ctx.lang) });
      markers = fb.ok ? targets : [...targets.map((m) => ({ ...m, kind: 'target' as const })), ...(fb.clicked ? [{ string: fb.clicked[0], fret: fb.clicked[1], kind: 'wrong' as const }] : [])];
    }
  }

  return (
    <>
      <h1 className="sr-only">Treino de hoje</h1>
      <div className="train-head">
        <button type="button" className="btn small" onClick={onQuit}>
          <Icon name="back" size={14} /> Sair
        </button>
        <span className="tag">{entry.retry ? 'Tente de novo' : KIND_TITLE[card.kind]}</span>
        <span className="muted small-text" aria-live="off">
          {Math.min(position + (fb || entry.retry ? 0 : 1), total)}/{total}
        </span>
      </div>
      <div className="bar" role="progressbar" aria-label="Progresso da sessão" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(position, total)}>
        <i style={{ width: `${(Math.min(position, total) / Math.max(1, total)) * 100}%` }} />
      </div>

      <Prompt state={fb ? (fb.ok ? 'ok' : 'bad') : null}>
        {card.prompt}
        {card.sub && <div className="prompt-sub">{card.sub}</div>}
      </Prompt>

      {card.board && (
        <div className="board-wrap">
          <div className="board-scroll">
            <Fretboard
              tuning={card.board.tuning}
              fretMax={card.board.fretMax}
              vertical={env.vertical}
              leftHanded={env.leftHanded}
              markers={markers}
              stringsOff={card.board.stringsOff}
              onCell={card.board.clickable && !fb ? (s, f) => give(`${s}:${pcAt(card.board!.tuning, s, f)}`, [s, f]) : undefined}
              quiz
            />
          </div>
        </div>
      )}

      {card.choices && (
        <div className={`answer-grid${card.choices.length === 12 ? ' twelve' : card.choices.length < 12 ? ' wide' : ''}`} role="group" aria-label="Alternativas">
          {card.choices.map((c) => {
            const right = !!fb && card.answer.includes(c.key);
            const wrongPick = !!fb && !fb.ok && fb.picked === c.key;
            return (
              <button key={c.key} type="button" className={`btn answer${right ? ' right' : ''}${wrongPick ? ' wrongpick' : ''}`} disabled={!!fb} onClick={() => give(c.key)}>
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      <div role="status" aria-live="polite" className="train-feedback">
        {fb && (
          <>
            <p className={fb.ok ? 'ok-text' : 'warn-text'}>
              <b>{fb.ok ? 'Certo!' : 'Não foi dessa vez.'}</b> {card.explain}
            </p>
            {!fb.ok && (
              <button ref={nextRef} type="button" className="btn primary" onClick={onNext}>
                Continuar <Icon name="back" size={14} />
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ============ Resumo ============

function Summary({ results, ctx, onAgain, onHome }: { results: Result[]; ctx: Ctx; onAgain: () => void; onHome: () => void }) {
  const ok = results.filter((r) => r.ok).length;
  const pct = results.length ? Math.round((ok / results.length) * 100) : 0;
  const byKind = new Map<Kind, [number, number]>();
  for (const r of results) {
    const [n, a] = byKind.get(r.kind) ?? [0, 0];
    byKind.set(r.kind, [n + 1, a + (r.ok ? 1 : 0)]);
  }
  const missed = results.filter((r) => !r.ok);
  return (
    <>
      <PageHeader eyebrow="Sessão concluída" title={`${ok} de ${results.length} certas (${pct}%)`} sub={pct >= 80 ? 'Ótimo ritmo! As que você acertou voltam daqui a alguns dias.' : 'As que você errou voltam logo, para fixar.'} />
      <section className="panel">
        <h3 aria-level={2} className="section-title">
          Por assunto
        </h3>
        {[...byKind].map(([k, [n, a]]) => (
          <div key={k} className="kind-row">
            <span>{KIND_TITLE[k]}</span>
            <span className="muted small-text">
              {a}/{n}
            </span>
            <div className="bar">
              <i style={{ width: `${(a / n) * 100}%` }} />
            </div>
          </div>
        ))}
      </section>
      {missed.length > 0 && (
        <section className="panel">
          <h3 aria-level={2} className="section-title">
            Para rever
          </h3>
          <ul className="weak-list">
            {missed.map((m) => {
              const c = buildCard(m.id, ctx);
              return c ? (
                <li key={m.id}>
                  <b>{c.prompt}</b>
                  {c.sub ? ` — ${c.sub}` : ''}
                  <div className="muted small-text">{c.explain}</div>
                </li>
              ) : null;
            })}
          </ul>
        </section>
      )}
      <div className="row gap wrap">
        <button type="button" className="btn primary" onClick={onAgain}>
          Mais uma sessão
        </button>
        <button type="button" className="btn" onClick={onHome}>
          Voltar
        </button>
      </div>
    </>
  );
}
