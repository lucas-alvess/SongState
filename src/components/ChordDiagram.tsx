import { memo } from 'react';
import { mod12 } from '../lib/music';

interface Props {
  frets: number[]; // -1 = não tocada
  tuning: number[];
  rootPc: number;
  onPick?: (frets: number[]) => void;
  active?: boolean;
}

const SS = 15; // espaço entre cordas
const FH = 17; // altura da casa
const ROWS = 5;

/** Diagrama de acorde (vertical, cordas graves à esquerda). */
function ChordDiagramImpl({ frets, tuning, rootPc, onPick, active }: Props) {
  const N = tuning.length;
  const fretted = frets.filter((f) => f > 0);
  const maxF = fretted.length ? Math.max(...fretted) : 0;
  const minF = fretted.length ? Math.min(...fretted) : 1;
  const base = maxF <= ROWS ? 1 : minF;
  const padL = 18;
  const padT = 24;
  const w = padL + (N - 1) * SS + 14;
  const h = padT + ROWS * FH + 10;
  const x = (s: number) => padL + s * SS;
  const y = (f: number) => padT + (f - base + 0.5) * FH;

  return (
    <button type="button" className={`diagram${active ? ' active' : ''}`} onClick={() => onPick?.(frets)}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Diagrama de acorde">
        {base === 1 ? (
          <rect x={x(0) - 1} y={padT - 3} width={(N - 1) * SS + 2} height={3.5} className="dg-nut" />
        ) : (
          <text x={4} y={padT + FH / 2 + 1} className="dg-base" dominantBaseline="central">
            {base}
          </text>
        )}
        {Array.from({ length: ROWS + 1 }, (_, i) => (
          <line key={i} x1={x(0)} x2={x(N - 1)} y1={padT + i * FH} y2={padT + i * FH} className="dg-line" />
        ))}
        {Array.from({ length: N }, (_, s) => (
          <line key={s} x1={x(s)} x2={x(s)} y1={padT} y2={padT + ROWS * FH} className="dg-line" />
        ))}
        {frets.map((f, s) => {
          if (f < 0) return <path key={s} d={`M${x(s) - 3.5} ${padT - 12}l7 7m0 -7l-7 7`} className="dg-x" />;
          if (f === 0) return <circle key={s} cx={x(s)} cy={padT - 9} r={3.4} className="dg-open" />;
          const isRoot = mod12(tuning[s] + f) === rootPc;
          return <circle key={s} cx={x(s)} cy={y(f)} r={6} className={isRoot ? 'dg-dot root' : 'dg-dot'} />;
        })}
      </svg>
      <span className="dg-label">{frets.map((f) => (f < 0 ? 'x' : f)).join(frets.some((f) => f > 9) ? '-' : '')}</span>
    </button>
  );
}

export const ChordDiagram = memo(ChordDiagramImpl, (a, b) => a.active === b.active && a.rootPc === b.rootPc && a.tuning === b.tuning && a.onPick === b.onPick && a.frets.join() === b.frets.join());
