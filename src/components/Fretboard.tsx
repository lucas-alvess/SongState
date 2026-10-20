import { memo } from 'react';

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
}

const INLAY_SINGLE = [3, 5, 7, 9, 15, 17, 19, 21];
const INLAY_DOUBLE = [12, 24];
const raw = (n: number) => 1 - Math.pow(2, -n / 12);

function FretboardImpl({ tuning, fretMin = 0, fretMax, vertical, leftHanded, markers, stringsOff = [], onCell }: Props) {
  const N = tuning.length;
  const a = fretMin;
  const b = fretMax;
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
  const P = (u: number, w: number): [number, number] =>
    vertical ? [M_ACROSS + w + LABEL, M_ALONG + u] : [M_ALONG + fix(u), M_ACROSS + w];
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

  const mid = across / 2;
  const R = Math.min(vertical ? 18 : 15, SS * 0.44);

  const line = (u1: number, w1: number, u2: number, w2: number, cls: string, sw?: number, key?: string | number) => {
    const [x1, y1] = P(u1, w1);
    const [x2, y2] = P(u2, w2);
    return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} className={cls} strokeWidth={sw} />;
  };

  return (
    <svg
      className="fretboard"
      viewBox={`0 0 ${vbW} ${vbH}`}
      style={vertical ? { maxWidth: 440 } : { minWidth: Math.min(vbW, nF * 46 + 80) }}
      role="img"
      aria-label="Braço da guitarra"
    >
      {/* madeira */}
      {(() => {
        const [x, y] = P(hasNut ? OPEN : 0, -SS * 0.55);
        const [x2, y2] = P(U, across + SS * 0.55);
        return <rect x={Math.min(x, x2)} y={Math.min(y, y2)} width={Math.abs(x2 - x)} height={Math.abs(y2 - y)} rx={6} className="fb-wood" />;
      })()}

      {/* marcadores de posição */}
      {frets.map((f) => {
        const double = INLAY_DOUBLE.includes(f);
        if (!double && !INLAY_SINGLE.includes(f)) return null;
        const u = cellU(f);
        const pts = double ? [mid - SS, mid + SS] : [mid];
        return pts.map((w, i) => {
          const [x, y] = P(u, w);
          return <circle key={`${f}-${i}`} cx={x} cy={y} r={7} className="fb-inlay" />;
        });
      })}

      {/* trastes */}
      {lines.map((n) => (n === 0 ? null : line(uAt(n), -SS * 0.55, uAt(n), across + SS * 0.55, 'fb-fret', n === 0 ? 5 : 2, `f${n}`)))}
      {hasNut && line(OPEN, -SS * 0.55, OPEN, across + SS * 0.55, 'fb-nut', 6, 'nut')}

      {/* cordas */}
      {tuning.map((_, s) => {
        const th = 1.2 + (2.4 * (N - 1 - s)) / Math.max(1, N - 1);
        return line(hasNut ? OPEN : 0, wOf(s), U, wOf(s), stringsOff.includes(s) ? 'fb-string off' : 'fb-string', th, `s${s}`);
      })}
      {hasNut && tuning.map((_, s) => line(OPEN * 0.25, wOf(s), OPEN, wOf(s), stringsOff.includes(s) ? 'fb-string off' : 'fb-string', 1, `o${s}`))}

      {/* números das casas */}
      {frets.map((f) => {
        if (f === 0) return null;
        const [x, y] = P(cellU(f), vertical ? -SS * 0.55 - 14 : across + SS * 0.55 + 14);
        return (
          <text key={`n${f}`} x={x} y={y} className="fb-num" textAnchor="middle" dominantBaseline="central">
            {f}
          </text>
        );
      })}

      {/* áreas clicáveis */}
      {onCell &&
        tuning.map((_, s) =>
          frets.map((f) => {
            if (stringsOff.includes(s)) return null;
            const [u1, u2] = cellBounds(f);
            const [xa, ya] = P(u1, wOf(s) - SS / 2);
            const [xb, yb] = P(u2, wOf(s) + SS / 2);
            return (
              <rect
                key={`c${s}-${f}`}
                x={Math.min(xa, xb)}
                y={Math.min(ya, yb)}
                width={Math.abs(xb - xa)}
                height={Math.abs(yb - ya)}
                className="fb-hit"
                onClick={() => onCell(s, f)}
              />
            );
          }),
        )}

      {/* notas */}
      {markers.map((m) => {
        if (m.fret < a || m.fret > b || m.string >= N) return null;
        const [x, y] = P(cellU(m.fret), wOf(m.string));
        const r = Math.min(R, cellLen(m.fret) * 0.46);
        return (
          <g key={`${m.string}-${m.fret}-${m.kind}`} className={`mk mk-${m.kind}`} style={m.color ? ({ '--mk': m.color } as React.CSSProperties) : undefined}>
            <circle cx={x} cy={y} r={r} />
            {m.label && (
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={m.label.length > 3 ? r * 0.7 : r * 0.9}>
                {m.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export const Fretboard = memo(FretboardImpl);
