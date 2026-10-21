import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useIsNarrow } from '../lib/storage';

/**
 * Gráficos em SVG do SongState (sem biblioteca). Regras: marcas finas, uma cor com ênfase (a que importa
 * em destaque, o resto discreto), grade discreta, rótulos só onde ajudam, dica ao passar o mouse/tocar e
 * uma tabela equivalente para quem não enxerga o desenho (`ChartTable`).
 * As cores vêm das variáveis `--viz-*` (styles.css), validadas contra o fundo escuro do app.
 */

interface Tip {
  x: number; // em unidades do viewBox
  y: number;
  text: ReactNode;
}

/**
 * Dica do gráfico. Mouse: aparece ao passar e some ao sair. Toque: aparece ao tocar e some sozinha após
 * alguns segundos (no toque o navegador dispara "sair" assim que o dedo levanta, então não dá para usar).
 */
function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const bind = (make: () => Tip | null) => ({
    onPointerEnter: (e: PointerEvent) => e.pointerType === 'mouse' && setTip(make()),
    onPointerLeave: (e: PointerEvent) => e.pointerType === 'mouse' && setTip(null),
    onPointerDown: (e: PointerEvent) => {
      setTip(make());
      if (e.pointerType !== 'mouse') {
        clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setTip(null), 3500);
      }
    },
  });
  return [tip, bind] as const;
}

/** Contêiner com a dica posicionada por porcentagem (o SVG escala de forma uniforme). */
function Frame({ w, h, label, children, tip, cls = '' }: { w: number; h: number; label: string; children: ReactNode; tip: Tip | null; cls?: string }) {
  return (
    <div className="viz-frame">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className={`viz-svg ${cls}`}>
        {children}
      </svg>
      {tip && (
        <div className={`viz-tip${tip.x / w < 0.18 ? ' start' : tip.x / w > 0.82 ? ' end' : ''}`} style={{ left: `${(tip.x / w) * 100}%`, top: `${(tip.y / h) * 100}%` }} role="presentation">
          {tip.text}
        </div>
      )}
    </div>
  );
}

/** Tabela com os mesmos dados do gráfico, escondida em um <details>. */
export function ChartTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="viz-table">
      <summary>Ver como tabela</summary>
      <div className="table-scroll">
        <table className="field-table ref-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Escala "bonita": maior valor arredondado para cima com 2 divisões. */
export function niceMax(v: number, step: number): number {
  return Math.max(step * 2, Math.ceil(v / step) * step);
}

// ============ Colunas (uma série, hoje em destaque) ============

export interface Col {
  label: string; // rótulo do eixo (ex.: "seg")
  value: number;
  tip: string;
  accent?: boolean; // destaque (hoje)
  muted?: boolean; // dia que ainda não chegou
}

export function ColumnChart({ cols, unit, label, step = 15 }: { cols: Col[]; unit: string; label: string; step?: number }) {
  const narrow = useIsNarrow(520);
  const W = narrow ? 380 : 560; // no celular o desenho é menor, então o texto não encolhe demais
  const H = narrow ? 210 : 230;
  const m = { l: 40, r: 8, t: 22, b: 30 };
  const [tip, bind] = useTip();
  const max = niceMax(Math.max(0, ...cols.map((c) => c.value)), step);
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const slot = iw / cols.length;
  const bw = Math.min(34, slot - 8); // marcas finas, com folga de ao menos 8 px entre elas
  const y = (v: number) => m.t + ih - (v / max) * ih;
  const top = Math.max(0, ...cols.map((c) => c.value));

  const bar = (x: number, v: number) => {
    const h = Math.max(0, (v / max) * ih);
    if (h <= 0) return '';
    const r = Math.min(4, h, bw / 2); // topo arredondado, base reta ancorada na linha de base
    return `M${x},${m.t + ih} V${m.t + ih - h + r} Q${x},${m.t + ih - h} ${x + r},${m.t + ih - h} H${x + bw - r} Q${x + bw},${m.t + ih - h} ${x + bw},${m.t + ih - h + r} V${m.t + ih} Z`;
  };

  return (
    <Frame w={W} h={H} label={label} tip={tip}>
      {[0, max / 2, max].map((g) => (
        <g key={g}>
          <line x1={m.l} x2={W - m.r} y1={y(g)} y2={y(g)} className={g === 0 ? 'viz-axis' : 'viz-grid'} />
          <text x={m.l - 8} y={y(g)} className="viz-tick" textAnchor="end" dominantBaseline="central">
            {Math.round(g)}
          </text>
        </g>
      ))}
      <text x={m.l - 8} y={10} className="viz-tick" textAnchor="end">
        {unit}
      </text>
      {cols.map((c, i) => {
        const cx = m.l + slot * i + slot / 2;
        const x = cx - bw / 2;
        const show = c.value > 0 && (c.accent || c.value === top); // rótulo seletivo: hoje e o maior
        return (
          <g key={i} {...bind(() => ({ x: cx, y: y(c.value) - 6, text: c.tip }))}>
            <rect x={m.l + slot * i} y={m.t} width={slot} height={ih + 22} fill="transparent" /> {/* área de toque maior que a marca */}
            <path d={bar(x, c.value)} className={c.accent ? 'viz-mark accent' : c.muted ? 'viz-mark faint' : 'viz-mark'} />
            {show && (
              <text x={cx} y={y(c.value) - 6} className="viz-label" textAnchor="middle">
                {Math.round(c.value)}
              </text>
            )}
            <text x={cx} y={H - 8} className={`viz-tick${c.accent ? ' strong' : ''}`} textAnchor="middle">
              {c.label}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

// ============ Linha (taxa de acerto) ============

export interface Pt {
  label: string;
  value: number | null; // null = sem dados (interrompe a linha)
  tip: string;
}

export function LineChart({ points, label, unit = '%' }: { points: Pt[]; label: string; unit?: string }) {
  const narrow = useIsNarrow(520);
  const W = narrow ? 380 : 560;
  const H = narrow ? 210 : 230;
  const m = { l: 40, r: 18, t: 22, b: 30 };
  const [tip, bind] = useTip();
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const x = (i: number) => m.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => m.t + ih - (v / 100) * ih;
  const lastIdx = points.reduce((a, p, i) => (p.value !== null ? i : a), -1);

  // trechos contínuos (a linha quebra onde não há dados)
  const runs: number[][] = [];
  points.forEach((p, i) => {
    if (p.value === null) return;
    if (i > 0 && points[i - 1].value !== null) runs[runs.length - 1].push(i);
    else runs.push([i]);
  });

  return (
    <Frame w={W} h={H} label={label} tip={tip}>
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={m.l} x2={W - m.r} y1={y(g)} y2={y(g)} className={g === 0 ? 'viz-axis' : 'viz-grid'} />
          <text x={m.l - 8} y={y(g)} className="viz-tick" textAnchor="end" dominantBaseline="central">
            {g}
          </text>
        </g>
      ))}
      <text x={m.l - 8} y={10} className="viz-tick" textAnchor="end">
        {unit}
      </text>
      {runs.map((r, k) => (r.length > 1 ? <polyline key={k} points={r.map((i) => `${x(i)},${y(points[i].value!)}`).join(' ')} className="viz-line" /> : null))}
      {points.map((p, i) => (
        <g key={i} {...bind(() => (p.value === null ? null : { x: x(i), y: y(p.value) - 12, text: p.tip }))}>
          <rect x={x(i) - iw / points.length / 2} y={m.t} width={iw / points.length} height={ih + 22} fill="transparent" />
          {p.value !== null && <circle cx={x(i)} cy={y(p.value)} r={5} className="viz-dot" />}
          {i === lastIdx && p.value !== null && (
            <text x={x(i)} y={y(p.value) - 12} className="viz-label" textAnchor="middle">
              {p.value}%
            </text>
          )}
          <text x={x(i)} y={H - 8} className="viz-tick" textAnchor="middle">
            {p.label}
          </text>
        </g>
      ))}
    </Frame>
  );
}

// ============ Mapa de calor (calendário de atividade) ============

export interface HeatCell {
  level: 0 | 1 | 2 | 3 | 4;
  tip: string;
  future: boolean;
  today: boolean;
}

const WEEKDAYS = ['seg', '', 'qua', '', 'sex', '', 'dom'];

export function Heatmap({ weeks, label, monthLabels }: { weeks: HeatCell[][]; label: string; monthLabels: string[] }) {
  const cell = 16;
  const gap = 4;
  const ml = 30;
  const mt = 20;
  const W = ml + weeks.length * (cell + gap);
  const H = mt + 7 * (cell + gap);
  const [tip, bind] = useTip();
  return (
    <>
      <Frame w={W} h={H} label={label} tip={tip} cls="heat-svg">
        {WEEKDAYS.map((d, i) => (
          <text key={i} x={ml - 6} y={mt + i * (cell + gap) + cell / 2} className="viz-tick" textAnchor="end" dominantBaseline="central">
            {d}
          </text>
        ))}
        {monthLabels.map((t, w) =>
          t ? (
            <text key={w} x={ml + w * (cell + gap)} y={11} className="viz-tick">
              {t}
            </text>
          ) : null,
        )}
        {weeks.map((col, w) =>
          col.map((c, d) => {
            if (c.future) return null;
            const x = ml + w * (cell + gap);
            const y = mt + d * (cell + gap);
            return <rect key={`${w}-${d}`} x={x} y={y} width={cell} height={cell} rx={4} className={`heat l${c.level}${c.today ? ' today' : ''}`} {...bind(() => ({ x: x + cell / 2, y: y - 4, text: c.tip }))} />;
          }),
        )}
      </Frame>
      <div className="heat-legend" aria-hidden="true">
        menos
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className={`heat l${l}`} />
        ))}
        mais
      </div>
    </>
  );
}

// ============ Barras horizontais com rótulo direto ============

export interface HRow {
  label: string;
  value: number; // 0–100 (largura)
  text: string; // valor escrito
  sub?: string;
}

export function HBars({ rows }: { rows: HRow[] }) {
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="hbar-head">
            <span>{r.label}</span>
            <b>{r.text}</b>
          </div>
          <div className="hbar-track" role="presentation">
            <i style={{ width: `${Math.max(2, Math.min(100, r.value))}%` }} />
          </div>
          {r.sub && <span className="muted small-text">{r.sub}</span>}
        </li>
      ))}
    </ul>
  );
}
