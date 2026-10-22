import type { CSSProperties } from 'react';
import { pcLabel, type AccPref, type Lang } from '../lib/music';
import { SS, boardGeometry, type Diagram, type Role } from '../lib/printsheet';

/**
 * Diagrama de braço para impressão: SVG autônomo (cores escritas nos próprios elementos, sem depender do tema do site),
 * com espaçamento igual entre as casas para os números e nomes caberem. Estilo "mono" = tinta preta sobre papel branco.
 */
export type PrintStyle = 'color' | 'mono';

interface Props {
  diagram: Diagram;
  style: PrintStyle;
  names: { lang: Lang; pref: AccPref };
  leftHanded: boolean;
  showNumbers: boolean;
  showInlays: boolean;
  showStringNames: boolean;
  /** altura máxima do desenho, em mm (para nunca passar de uma página) */
  maxHeightMm?: number;
}

const R = 10.5; // raio das notas
const INLAY_SINGLE = [3, 5, 7, 9, 15, 17, 19, 21];
const INLAY_DOUBLE = [12, 24];
const FONT = "Inter, system-ui, 'Segoe UI', sans-serif";

interface Look {
  fill: string;
  stroke: string;
  text: string;
  sw: number;
}

const LOOK: Record<PrintStyle, Record<Role, Look>> = {
  mono: {
    tone: { fill: '#ffffff', stroke: '#111111', text: '#111111', sw: 1.4 },
    root: { fill: '#111111', stroke: '#111111', text: '#ffffff', sw: 1.4 },
    sub: { fill: '#ffffff', stroke: '#111111', text: '#111111', sw: 2.6 },
    dom: { fill: '#ffffff', stroke: '#111111', text: '#111111', sw: 2.6 },
    chord: { fill: '#d4d4d8', stroke: '#111111', text: '#111111', sw: 1.4 },
  },
  color: {
    tone: { fill: '#e5e7eb', stroke: '#4b5563', text: '#111827', sw: 1.4 },
    root: { fill: '#dc2626', stroke: '#7f1d1d', text: '#ffffff', sw: 1.6 },
    sub: { fill: '#2563eb', stroke: '#1e3a8a', text: '#ffffff', sw: 1.6 },
    dom: { fill: '#16a34a', stroke: '#14532d', text: '#ffffff', sw: 1.6 },
    chord: { fill: '#f59e0b', stroke: '#92400e', text: '#111827', sw: 1.6 },
  },
};

const fontSize = (label: string, r: number) => (label.length <= 1 ? r * 1.05 : label.length === 2 ? r * 0.95 : label.length === 3 ? r * 0.78 : r * 0.62);

/** Uma nota. Formas diferentes (círculo, quadrado, losango) para distinguir os papéis mesmo em preto e branco. */
export function MarkerShape({ role, x, y, r = R, label, style }: { role: Role; x: number; y: number; r?: number; label?: string; style: PrintStyle }) {
  const k = LOOK[style][role];
  const common = { fill: k.fill, stroke: k.stroke, strokeWidth: k.sw };
  return (
    <g>
      {role === 'sub' ? (
        <rect x={x - r * 0.92} y={y - r * 0.92} width={r * 1.84} height={r * 1.84} rx={r * 0.28} {...common} />
      ) : role === 'dom' ? (
        <polygon points={`${x},${y - r * 1.25} ${x + r * 1.25},${y} ${x},${y + r * 1.25} ${x - r * 1.25},${y}`} {...common} />
      ) : (
        <circle cx={x} cy={y} r={r} {...common} />
      )}
      {label && (
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={fontSize(label, r)} fontWeight={700} fontFamily={FONT} fill={k.text}>
          {label}
        </text>
      )}
    </g>
  );
}

export function PrintBoard({ diagram, style, names, leftHanded, showNumbers, showInlays, showStringNames, maxHeightMm }: Props) {
  const { board, vertical } = diagram;
  const { tuning, fretMin, fretMax, markers, muted } = board;
  const { N, hasNut, nF, CELL, OPEN, L, across, X0, Y0, vbW, vbH } = boardGeometry(board, vertical, showNumbers, showStringNames);
  const mirror = leftHanded && !vertical;

  const uStart = (f: number) => (hasNut ? (f === 0 ? 0 : OPEN + (f - 1) * CELL) : (f - fretMin) * CELL);
  const uEnd = (f: number) => uStart(f) + (hasNut && f === 0 ? OPEN : CELL);
  const cellU = (f: number) => (uStart(f) + uEnd(f)) / 2;
  const wOf = (s: number) => (vertical ? (leftHanded ? N - 1 - s : s) * SS : (N - 1 - s) * SS);
  const P = (u: number, w: number): [number, number] => (vertical ? [X0 + w, Y0 + u] : [X0 + (mirror ? L - u : u), Y0 + w]);

  const ink = style === 'mono' ? '#111111' : '#374151';
  const lineSoft = style === 'mono' ? '#6b7280' : '#9ca3af';
  const line = (u1: number, w1: number, u2: number, w2: number, stroke: string, sw: number, key: string) => {
    const [x1, y1] = P(u1, w1);
    const [x2, y2] = P(u2, w2);
    return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />;
  };

  const edge = SS * 0.55;
  const fretLines: number[] = hasNut ? Array.from({ length: fretMax }, (_, k) => OPEN + (k + 1) * CELL) : Array.from({ length: nF + 1 }, (_, k) => k * CELL);
  const frets = Array.from({ length: nF }, (_, i) => fretMin + i);

  const [bx1, by1] = P(0, -edge);
  const [bx2, by2] = P(L, across + edge);

  const open = (s: number) => pcLabel(tuning[s] % 12, names.pref, names.lang);
  const style_: CSSProperties = { width: '100%', height: 'auto', display: 'block', maxHeight: maxHeightMm ? `${maxHeightMm}mm` : undefined };

  return (
    <svg className="pb" viewBox={`0 0 ${vbW} ${vbH}`} role="img" aria-label={diagram.description} style={style_} preserveAspectRatio="xMidYMid meet">
      {style === 'color' && <rect x={Math.min(bx1, bx2)} y={Math.min(by1, by2)} width={Math.abs(bx2 - bx1)} height={Math.abs(by2 - by1)} rx={5} fill="#faf5ea" stroke="#d6c7a1" strokeWidth={1} />}

      {showInlays &&
        frets.map((f) => {
          if (f < 1) return null;
          const dbl = INLAY_DOUBLE.includes(f);
          if (!dbl && !INLAY_SINGLE.includes(f)) return null;
          return (dbl ? [across / 2 - SS, across / 2 + SS] : [across / 2]).map((w, i) => {
            const [x, y] = P(cellU(f), w);
            return <circle key={`in${f}-${i}`} cx={x} cy={y} r={6.5} fill="#e5e7eb" opacity={style === 'mono' ? 0.9 : 0.8} />;
          });
        })}

      {fretLines.map((u, i) => line(u, -edge, u, across + edge, lineSoft, 1.3, `fl${i}`))}
      {hasNut ? line(OPEN, -edge, OPEN, across + edge, ink, 4.5, 'nut') : line(0, -edge, 0, across + edge, ink, 2, 'top')}
      {Array.from({ length: N }, (_, s) => {
        const th = 0.9 + (1.6 * (N - 1 - s)) / Math.max(1, N - 1);
        return line(0, wOf(s), L, wOf(s), ink, th, `st${s}`);
      })}

      {showStringNames &&
        Array.from({ length: N }, (_, s) => {
          const [x, y] = vertical ? P(0, wOf(s)) : P(-14, wOf(s));
          const py = vertical ? Y0 - 7 - (!hasNut && muted.length ? 14 : 0) : y;
          return (
            <text key={`nm${s}`} x={x} y={py} textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={600} fontFamily={FONT} fill={ink} aria-hidden="true">
              {open(s)}
            </text>
          );
        })}

      {showNumbers &&
        frets.map((f) => {
          if (f === 0) return null;
          const [x, y] = vertical ? P(cellU(f), -edge - 9) : P(cellU(f), across + edge + 12);
          return (
            <text key={`fn${f}`} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={11} fontFamily={FONT} fill={ink} aria-hidden="true">
              {f}
            </text>
          );
        })}

      {muted.map((s) => {
        const [x, y] = hasNut ? P(OPEN / 2, wOf(s)) : P(-9, wOf(s));
        return <path key={`x${s}`} d={`M${x - 4.5} ${y - 4.5}l9 9m0 -9l-9 9`} stroke={ink} strokeWidth={2} strokeLinecap="round" fill="none" />;
      })}

      {markers.map((m) => {
        if (m.fret < fretMin || m.fret > fretMax || m.string >= N) return null;
        const [x, y] = P(cellU(m.fret), wOf(m.string));
        return <MarkerShape key={`${m.string}-${m.fret}`} role={m.role} x={x} y={y} label={m.label} style={style} />;
      })}
    </svg>
  );
}
