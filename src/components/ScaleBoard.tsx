import { useMemo, useState } from 'react';
import { Fretboard, type Marker } from './Fretboard';
import { Chips, Field, RootChips, ScaleSelect, Toggle } from './ui';
import {
  MAX_FRET,
  buildScale,
  chordToneTokens,
  hasCagedShapes,
  noteLabel,
  pcAt,
  pcLabel,
  scaleById,
  scalePositions,
  tuningById,
  type PositionSystem,
  type Scale,
} from '../lib/music';
import { useSettings, useVertical } from '../lib/storage';

export interface BoardState {
  root: number;
  scaleId: string;
  pos: number | null; // null = todas
  system?: PositionSystem; // 7 posições (3 notas por corda) ou 5 formas (CAGED); ausente = 7 posições
  label: 'note' | 'degree' | 'none';
  color: 'role' | 'degree';
  chordTones: boolean;
  degrees: string[]; // vazio = todos
  ghost: 'off' | 'scale' | 'all';
  stringsOff: number[];
  fretMin: number;
  fretMax: number;
  hide: boolean;
  focus: boolean;
}

export const DEFAULT_BOARD: BoardState = {
  root: 9,
  scaleId: 'minor-pent',
  pos: null,
  system: 'seven',
  label: 'note',
  color: 'role',
  chordTones: false,
  degrees: [],
  ghost: 'off',
  stringsOff: [],
  fretMin: 0,
  fretMax: 15,
  hide: false,
  focus: false,
};

export const degreeColor = (semis: number) => `hsl(${(semis * 30 + 200) % 360} 85% 62%)`;

interface Props {
  state: BoardState;
  setState: (patch: Partial<BoardState>) => void;
  /** pitch classes do acorde atual (backing tracks) — destacados em âmbar. */
  chordPcs?: number[];
  scaleIds?: string[]; // restringe as escalas do seletor
  advanced?: boolean;
  hideRoot?: boolean;
}

export function ScaleBoard({ state: st, setState, chordPcs, scaleIds, advanced = true, hideRoot }: Props) {
  const { settings } = useSettings();
  const vertical = useVertical();
  const tuning = tuningById(settings.tuningId).midi;
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const scale: Scale = useMemo(() => buildScale(scaleById(st.scaleId), st.root, settings.pref), [st.scaleId, st.root, settings.pref]);
  const system: PositionSystem = st.system === 'caged' && hasCagedShapes(scale) ? 'caged' : 'seven';
  const positions = useMemo(() => scalePositions(scale, tuning, system), [scale, tuning, system]);
  const position = st.pos !== null ? positions[st.pos] : null;
  const chordTok = useMemo(() => chordToneTokens(scale), [scale]);

  const view = useMemo(() => {
    if (st.focus && position && position.clusters.length) {
      const c = position.clusters.find((cl) => Math.max(...cl.map((n) => n.fret)) <= MAX_FRET) ?? position.clusters[0];
      const lo = Math.min(...c.map((n) => n.fret));
      const hi = Math.max(...c.map((n) => n.fret));
      return { min: Math.max(0, lo - 1), max: Math.min(MAX_FRET, hi + 1) };
    }
    return { min: st.fretMin, max: Math.max(st.fretMax, st.fretMin + 4) };
  }, [st.focus, position, st.fretMin, st.fretMax]);

  const markers = useMemo(() => {
    const out: Marker[] = [];
    const posSet = position ? new Set(position.notes.map((n) => `${n.string}:${n.fret}`)) : null;
    const chordSet = chordPcs ? new Set(chordPcs) : null;
    for (let s = 0; s < tuning.length; s++) {
      if (st.stringsOff.includes(s)) continue;
      for (let f = view.min; f <= view.max; f++) {
        const pc = pcAt(tuning, s, f);
        const note = scale.byPc.get(pc);
        const inChord = chordSet?.has(pc) ?? false;
        if (!note) {
          if (inChord) out.push({ string: s, fret: f, kind: 'chord', label: pcLabel(pc, settings.pref, settings.lang) });
          else if (st.ghost === 'all') out.push({ string: s, fret: f, kind: 'ghost', label: pcLabel(pc, settings.pref, settings.lang) });
          continue;
        }
        const shown = (!posSet || posSet.has(`${s}:${f}`)) && (st.degrees.length === 0 || st.degrees.includes(note.token));
        if (!shown) {
          if (st.ghost !== 'off') out.push({ string: s, fret: f, kind: 'ghost', label: st.ghost === 'all' ? pcLabel(pc, settings.pref, settings.lang) : undefined });
          continue;
        }
        const isRoot = note.index === 0;
        const kind = chordSet ? (inChord ? 'chord' : isRoot && !hideRoot ? 'root' : 'scale') : isRoot ? 'root' : st.chordTones && chordTok.has(note.token) ? 'chord' : 'scale';
        let label: string | undefined;
        const revealOk = !st.hide || revealed.has(`${s}:${f}`);
        if (revealOk && st.label === 'note') label = noteLabel(note.spelled, settings.lang);
        if (revealOk && st.label === 'degree') label = note.token;
        out.push({ string: s, fret: f, kind, label, color: st.color === 'degree' && kind !== 'root' ? degreeColor(note.semis) : undefined });
      }
    }
    return out;
  }, [scale, tuning, position, st, view, chordPcs, chordTok, settings.lang, settings.pref, revealed, hideRoot]);

  const onCell = st.hide
    ? (s: number, f: number) =>
        setRevealed((r) => {
          const n = new Set(r);
          const k = `${s}:${f}`;
          if (n.has(k)) n.delete(k);
          else n.add(k);
          return n;
        })
    : undefined;

  const toggleDegree = (t: string) => setState({ degrees: st.degrees.includes(t) ? st.degrees.filter((d) => d !== t) : [...st.degrees, t] });
  const stringNames = tuning.map((m, i) => ({ value: i, label: `${tuning.length - i}ª ${pcLabel(m % 12, settings.pref, settings.lang)}` }));

  return (
    <div className="scale-board">
      <div className="panel controls">
        <Field label="Tônica">
          <RootChips value={st.root} onChange={(root) => setState({ root })} />
        </Field>
        <div className="row">
          <Field label="Escala">
            <ScaleSelect value={st.scaleId} onChange={(scaleId) => setState({ scaleId, pos: null, degrees: [] })} ids={scaleIds} />
          </Field>
        </div>
        {hasCagedShapes(scale) && (
          <Field label="Sistema de posições">
            <Chips
              small
              value={system}
              onChange={(v) => setState({ system: v, pos: null })}
              options={[
                { value: 'seven', label: '7 posições (3 notas por corda)' },
                { value: 'caged', label: '5 formas (CAGED)' },
              ]}
            />
          </Field>
        )}
        <Field label={`Posição / shape (${positions.length})`}>
          <Chips
            small
            value={st.pos ?? -1}
            onChange={(v) => setState({ pos: v < 0 ? null : v })}
            options={[{ value: -1, label: 'Todas' }, ...positions.map((p) => ({ value: p.index, label: p.label }))]}
          />
        </Field>
        <div className="scale-info">
          <b>{noteLabel(scale.root, settings.lang)} {scale.def.name}</b>
          <span className="muted">
            {scale.notes.map((n) => noteLabel(n.spelled, settings.lang)).join(' · ')}
          </span>
          <span className="muted">{scale.def.formula.join(' ')}</span>
        </div>
      </div>

      <div className="board-wrap">
        <div className="board-scroll">
          <Fretboard
            tuning={tuning}
            fretMin={view.min}
            fretMax={view.max}
            vertical={vertical}
            leftHanded={settings.leftHanded}
            markers={markers}
            stringsOff={st.stringsOff}
            onCell={onCell}
            quiz={st.hide}
          />
        </div>
      </div>

      {advanced && (
        <details className="panel filters" open>
          <summary>Filtros de estudo</summary>
          <div className="filters-grid">
            <Field label="Rótulo">
              <Chips
                small
                value={st.label}
                onChange={(label) => setState({ label })}
                options={[
                  { value: 'note', label: 'Nota' },
                  { value: 'degree', label: 'Grau' },
                  { value: 'none', label: 'Nenhum' },
                ]}
              />
            </Field>
            <Field label="Cores">
              <Chips
                small
                value={st.color}
                onChange={(color) => setState({ color })}
                options={[
                  { value: 'role', label: 'Tônica / escala' },
                  { value: 'degree', label: 'Por grau' },
                ]}
              />
            </Field>
            <Field label="Mostrar só estes graus">
              <div className="chips small">
                {scale.notes.map((n) => (
                  <button key={n.token} type="button" className={`chip${st.degrees.includes(n.token) ? ' active' : ''}`} onClick={() => toggleDegree(n.token)}>
                    {n.token}
                  </button>
                ))}
                {st.degrees.length > 0 && (
                  <button type="button" className="chip" onClick={() => setState({ degrees: [] })}>
                    limpar
                  </button>
                )}
              </div>
            </Field>
            <Field label="Notas fora do filtro">
              <Chips
                small
                value={st.ghost}
                onChange={(ghost) => setState({ ghost })}
                options={[
                  { value: 'off', label: 'Ocultas' },
                  { value: 'scale', label: 'Esmaecidas' },
                  { value: 'all', label: 'Todas as casas' },
                ]}
              />
            </Field>
            <Field label="Cordas visíveis">
              <div className="chips small">
                {stringNames.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={`chip${st.stringsOff.includes(o.value) ? '' : ' active'}`}
                    onClick={() => setState({ stringsOff: st.stringsOff.includes(o.value) ? st.stringsOff.filter((x) => x !== o.value) : [...st.stringsOff, o.value] })}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Casas">
              <div className="range-row">
                <select aria-label="Casa inicial" value={st.fretMin} disabled={st.focus} onChange={(e) => setState({ fretMin: +e.target.value })}>
                  {Array.from({ length: 20 }, (_, i) => (
                    <option key={i} value={i}>
                      de {i === 0 ? 'solta' : i}
                    </option>
                  ))}
                </select>
                <select aria-label="Casa final" value={st.fretMax} disabled={st.focus} onChange={(e) => setState({ fretMax: +e.target.value })}>
                  {[7, 9, 12, 15, 17, 19, 22, 24].map((n) => (
                    <option key={n} value={n}>
                      até {n}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
            <div className="toggles">
              <Toggle label="Destacar notas do acorde (1-3-5-7)" checked={st.chordTones} onChange={(chordTones) => setState({ chordTones })} />
              <Toggle label="Aproximar na posição escolhida" checked={st.focus} onChange={(focus) => setState({ focus })} />
              <Toggle
                label="Modo teste: esconder nomes (toque para revelar)"
                checked={st.hide}
                onChange={(hide) => {
                  setRevealed(new Set());
                  setState({ hide });
                }}
              />
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
