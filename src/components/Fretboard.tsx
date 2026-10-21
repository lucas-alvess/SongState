import { memo, useId, useMemo, useRef, useState } from 'react';
import { pcAt, pcLabel, stringNumber } from '../lib/music';
import { useSettings } from '../lib/storage';

export type MarkerKind = 'root' | 'scale' | 'chord' | 'ghost' | 'target' | 'correct' | 'wrong' | 'hint';

export interface Marker {
  string: number; // 0 = corda mais grave
  fret: number;
  label?: string;
  kind: MarkerKind;
  color?: string; // sobrescreve a cor (modo por grau)
}

interface Props {
  tuning: number[];
  fretMin?: number;
  fretMax: number;
  vertical: boolean;
  leftHanded: boolean;
  markers: Marker[];
  stringsOff?: number[];
  onCell?: (string: number, fret: number) => void;
  /** Em exercícios, os nomes das notas não são lidos em voz alta (entregariam a resposta). */
  quiz?: boolean;
}

const KIND_TEXT: Partial<Record<MarkerKind, string>> = { root: 'tônica', scale: 'da escala', chord: 'do acorde', target: 'alvo', correct: 'correta', wrong: 'errada', hint: 'dica' };

const HALO = new Set<MarkerKind>(['root', 'chord', 'target', 'correct', 'wrong']);
const INLAY_SINGLE = [3, 5, 7, 9, 15, 17, 19, 21];
const INLAY_DOUBLE = [12, 24];
const NONE: number[] = [];
const raw = (n: number) => 1 - Math.pow(2, -n / 12);

/** Geometria do braço: só depende de afinação, casas visíveis e orientação (não das notas). */
function useGeometry(tuning: number[], a: number, b: number, vertical: boolean, leftHanded: boolean) {
  return useMemo(() => {
    const N = tuning.length;
    const hasNut = a === 0;
    const nF = b - a + 1;
    const SS = vertical ? 54 : 40; // espaçamento entre cordas
    const OPEN = hasNut ? (vertical ? 46 : 52) : 0;
    const LEN = vertical ? Math.max(420, nF * 62) : Math.max(560, nF * 70);
    const M_ALONG = 14; // margem no eixo do braço
    const M_ACROSS = vertical ? 38 : 22;
    const LABEL = 30; // espaço para números das casas
    const U = OPEN + LEN;
    const across = (N - 1) * SS;

    const n0 = hasNut ? 0 : a - 1;
    const uAt = (n: number) => OPEN + ((raw(n) - raw(n0)) / (raw(b) - raw(n0))) * LEN;
    const mirror = leftHanded && !vertical;
    const fix = (u: number) => (mirror ? U - u : u);

    // posição (x,y) a partir de u (ao longo do braço) e w (através)
    const P = (u: number, w: number): [number, number] => (vertical ? [M_ACROSS + w + LABEL, M_ALONG + u] : [M_ALONG + fix(u), M_ACROSS + w]);
    const wOf = (s: number) => (vertical ? (leftHanded ? N - 1 - s : s) * SS : (N - 1 - s) * SS);

    const cellU = (f: number) => (f === 0 ? OPEN / 2 : (uAt(f - 1) + uAt(f)) / 2);
    const cellLen = (f: number) => (f === 0 ? OPEN : uAt(f) - uAt(f - 1));
    const cellBounds = (f: number): [number, number] => (f === 0 ? [0, OPEN] : [uAt(f - 1), uAt(f)]);

    const vbW = vertical ? M_ACROSS * 2 + across + LABEL : M_ALONG * 2 + U;
    const vbH = vertical ? M_ALONG * 2 + U : M_ACROSS * 2 + across + LABEL;

    const frets: number[] = [];
    for (let f = a; f <= b; f++) frets.push(f);
    const lines: number[] = [];
    for (let n = hasNut ? 0 : a - 1; n <= b; n++) lines.push(n);

    return { vertical, N, hasNut, nF, SS, OPEN, U, across, P, wOf, uAt, cellU, cellLen, cellBounds, vbW, vbH, frets, lines, mid: across / 2, R: Math.min(vertical ? 18 : 15, SS * 0.44) };
  }, [tuning, a, b, vertical, leftHanded]);
}

type Geo = ReturnType<typeof useGeometry>;

function FretboardImpl({ tuning, fretMin = 0, fretMax, vertical, leftHanded, markers, stringsOff = NONE, onCell, quiz }: Props) {
  const a = fretMin;
  const b = fretMax;
  const g = useGeometry(tuning, a, b, vertical, leftHanded);
  const offKey = stringsOff.join(',');
  const hasCell = !!onCell;

  // o clique chama sempre a versão mais recente do handler, sem refazer as áreas de toque
  const cellRef = useRef(onCell);
  cellRef.current = onCell;

  // ---- teclado e leitores de tela: um cursor único (em vez de 150 elementos focáveis) ----
  const { settings } = useSettings();
  const helpId = useId();
  const [cur, setCur] = useState({ s: tuning.length - 1, f: a });
  const [said, setSaid] = useState('');
  const markersRef = useRef(markers);
  markersRef.current = markers;

  const describeCell = (s: number, f: number) => {
    const base = `Corda ${stringNumber(s, tuning.length)}, casa ${f}`;
    if (quiz) return base;
    const note = pcLabel(pcAt(tuning, s, f), settings.pref, settings.lang);
    const mk = markersRef.current.find((m) => m.string === s && m.fret === f && m.kind !== 'ghost');
    return `${base}, ${note}${mk ? `, marcada${KIND_TEXT[mk.kind] ? ` (${KIND_TEXT[mk.kind]})` : ''}` : ''}`;
  };
  const usable = (s: number) => s >= 0 && s < tuning.length && !stringsOff.includes(s);
  const clampCur = (c: { s: number; f: number }) => ({ s: usable(c.s) ? c.s : [...tuning.keys()].reverse().find(usable) ?? 0, f: Math.min(b, Math.max(a, c.f)) });
  const here = clampCur(cur);

  const onKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (!hasCell || e.altKey || e.ctrlKey || e.metaKey) return;
    let { s, f } = here;
    const sign = leftHanded && !vertical ? -1 : 1; // braço espelhado: a direita é o lado do nut
    const stepString = (d: number) => {
      let n = s + d;
      while (n >= 0 && n < tuning.length && !usable(n)) n += d;
      if (usable(n)) s = n;
    };
    switch (e.key) {
      case vertical ? 'ArrowDown' : 'ArrowRight': f += sign; break;
      case vertical ? 'ArrowUp' : 'ArrowLeft': f -= sign; break;
      case vertical ? 'ArrowRight' : 'ArrowUp': stepString(vertical && leftHanded ? -1 : 1); break;
      case vertical ? 'ArrowLeft' : 'ArrowDown': stepString(vertical && leftHanded ? 1 : -1); break;
      case 'Home': f = a; break;
      case 'End': f = b; break;
      case 'PageUp': f += 5; break;
      case 'PageDown': f -= 5; break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        cellRef.current?.(here.s, here.f);
        setSaid(`${describeCell(here.s, here.f)}, selecionada`);
        return;
      default:
        return;
    }
    e.preventDefault();
    f = Math.min(b, Math.max(a, f));
    setCur({ s, f });
    setSaid(describeCell(s, f));
  };

  // camada fixa: madeira, marcações, trastes, cordas e números (não muda ao trocar de nota)
  const structure = useMemo(() => {
    const { N, hasNut, SS, OPEN, U, across, P, wOf, uAt, cellU, mid, frets, lines } = g as Geo;
    const off = new Set(offKey ? offKey.split(',').map(Number) : []);
    const line = (u1: number, w1: number, u2: number, w2: number, cls: string, sw?: number, key?: string | number) => {
      const [x1, y1] = P(u1, w1);
      const [x2, y2] = P(u2, w2);
      return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} className={cls} strokeWidth={sw} />;
    };
    const [wx, wy] = P(hasNut ? OPEN : 0, -SS * 0.55);
    const [wx2, wy2] = P(U, across + SS * 0.55);
    return (
      <>
        <rect x={Math.min(wx, wx2)} y={Math.min(wy, wy2)} width={Math.abs(wx2 - wx)} height={Math.abs(wy2 - wy)} rx={6} className="fb-wood" />
        {frets.map((f) => {
          const double = INLAY_DOUBLE.includes(f);
          if (!double && !INLAY_SINGLE.includes(f)) return null;
          const u = cellU(f);
          return (double ? [mid - SS, mid + SS] : [mid]).map((w, i) => {
            const [x, y] = P(u, w);
            return <circle key={`${f}-${i}`} cx={x} cy={y} r={7} className="fb-inlay" />;
          });
        })}
        {lines.map((n) => (n === 0 ? null : line(uAt(n), -SS * 0.55, uAt(n), across + SS * 0.55, 'fb-fret', 2, `f${n}`)))}
        {hasNut && line(OPEN, -SS * 0.55, OPEN, across + SS * 0.55, 'fb-nut', 6, 'nut')}
        {Array.from({ length: N }, (_, s) => {
          const th = 1.2 + (2.4 * (N - 1 - s)) / Math.max(1, N - 1);
          return line(hasNut ? OPEN : 0, wOf(s), U, wOf(s), off.has(s) ? 'fb-string off' : 'fb-string', th, `s${s}`);
        })}
        {hasNut && Array.from({ length: N }, (_, s) => line(OPEN * 0.25, wOf(s), OPEN, wOf(s), off.has(s) ? 'fb-string off' : 'fb-string', 1, `o${s}`))}
        {frets.map((f) => {
          if (f === 0) return null;
          const [x, y] = P(cellU(f), g.vertical ? -SS * 0.55 - 14 : across + SS * 0.55 + 14);
          return (
            <text key={`n${f}`} x={x} y={y} className="fb-num" textAnchor="middle" dominantBaseline="central">
              {f}
            </text>
          );
        })}
      </>
    );
  }, [g, offKey]);

  // camada de toque: um retângulo por casa (só existe quando o braço é clicável)
  const hits = useMemo(() => {
    if (!hasCell) return null;
    const { N, SS, P, wOf, cellBounds, frets } = g as Geo;
    const off = new Set(offKey ? offKey.split(',').map(Number) : []);
    const out = [];
    for (let s = 0; s < N; s++) {
      if (off.has(s)) continue;
      for (const f of frets) {
        const [u1, u2] = cellBounds(f);
        const [xa, ya] = P(u1, wOf(s) - SS / 2);
        const [xb, yb] = P(u2, wOf(s) + SS / 2);
        out.push(<rect key={`c${s}-${f}`} x={Math.min(xa, xb)} y={Math.min(ya, yb)} width={Math.abs(xb - xa)} height={Math.abs(yb - ya)} className="fb-hit" onClick={() => {
          setCur({ s, f });
          cellRef.current?.(s, f);
        }} />);
      }
    }
    return out;
  }, [g, offKey, hasCell]); // eslint-disable-line react-hooks/exhaustive-deps -- setCur é estável

  // camada das notas: a única que muda quando você troca escala, posição ou filtros
  const notes = useMemo(() => {
    const { N, P, wOf, cellU, cellLen, R } = g as Geo;
    return markers.map((m) => {
      if (m.fret < a || m.fret > b || m.string >= N) return null;
      const [x, y] = P(cellU(m.fret), wOf(m.string));
      const r = Math.min(R, cellLen(m.fret) * 0.46);
      return (
        <g key={`${m.string}-${m.fret}-${m.kind}`} className={`mk mk-${m.kind}`} style={m.color ? ({ '--mk': m.color } as React.CSSProperties) : undefined}>
          {HALO.has(m.kind) && <circle className="halo" cx={x} cy={y} r={r + 5} />}
          <circle cx={x} cy={y} r={r} />
          {m.label && (
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={m.label.length > 3 ? r * 0.7 : r * 0.9}>
              {m.label}
            </text>
          )}
        </g>
      );
    });
  }, [markers, g, a, b]);

  const ring = (() => {
    if (!hasCell) return null;
    const { SS, P, wOf, cellBounds } = g as Geo;
    const [u1, u2] = cellBounds(here.f);
    const [xa, ya] = P(u1, wOf(here.s) - SS / 2);
    const [xb, yb] = P(u2, wOf(here.s) + SS / 2);
    return <rect className="fb-cursor" x={Math.min(xa, xb) + 1.5} y={Math.min(ya, yb) + 1.5} width={Math.abs(xb - xa) - 3} height={Math.abs(yb - ya) - 3} rx={6} />;
  })();

  // sem interação: resumo do que está destacado, para quem não enxerga o desenho
  const summary = useMemo(() => {
    if (hasCell || quiz) return 'Braço da guitarra';
    const shown = markers.filter((m) => m.kind !== 'ghost' && m.fret >= a && m.fret <= b && m.string < tuning.length);
    const list = shown.slice(0, 40).map((m) => `corda ${stringNumber(m.string, tuning.length)} casa ${m.fret}${m.label ? ` ${m.label}` : ''}`);
    return `Braço da guitarra, casas ${a} a ${b}.${list.length ? ` Notas destacadas: ${list.join('; ')}${shown.length > list.length ? ` e mais ${shown.length - list.length}` : ''}.` : ''}`;
  }, [markers, hasCell, quiz, a, b, tuning.length]);

  return (
    <>
      <svg
        className="fretboard"
        viewBox={`0 0 ${g.vbW} ${g.vbH}`}
        style={vertical ? { maxWidth: 440 } : { minWidth: Math.min(g.vbW, g.nF * 46 + 80) }}
        {...(hasCell
          ? { role: 'group', tabIndex: 0, 'aria-label': `Braço da guitarra interativo. Corda ${stringNumber(here.s, tuning.length)}, casa ${here.f} em foco.`, 'aria-describedby': helpId, onKeyDown: onKey }
          : { role: 'img', 'aria-label': summary })}
      >
        {structure}
        {hits}
        {notes}
        {ring}
      </svg>
      {hasCell && (
        <>
          <span id={helpId} className="sr-only">
            Use as setas para mover entre cordas e casas, Home e End para ir à primeira e à última casa, Enter ou espaço para selecionar.
            {vertical ? ' Neste braço vertical, as setas para cima e para baixo mudam a casa.' : ''}
          </span>
          <span className="sr-only" role="status" aria-live="polite">
            {said}
          </span>
        </>
      )}
    </>
  );
}

export const Fretboard = memo(FretboardImpl);
