import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MarkerShape, PrintBoard } from '../components/PrintBoard';
import { Icon } from '../components/Icon';
import { Chips, Field, PageHeader, RootChips, ScaleSelect, Toggle } from '../components/ui';
import type { BoardState } from '../components/ScaleBoard';
import { CHORD_GROUPS, CHORD_TYPES } from '../lib/chords';
import { FIELDS, FIELD_GROUPS } from '../lib/harmony';
import { buildScale, hasCagedShapes, scaleById, scalePositions, TUNINGS, tuningById } from '../lib/music';
import { BLANK_CHOICES, DEFAULT_PRINT, FRET_CHOICES, MARGIN_CHOICES, PAPER_MM, PRINT_KEY, VOICING_CHOICES, buildSheet, normalizePrint, printDocTitle, printableMm, type PrintConfig } from '../lib/printsheet';
import { useLocalStorage, useSettings } from '../lib/storage';

const KINDS: { value: PrintConfig['kind']; label: string }[] = [
  { value: 'shapes', label: 'Shapes da escala' },
  { value: 'neck', label: 'Braço inteiro' },
  { value: 'chord', label: 'Acorde (tríade, tétrade…)' },
  { value: 'field', label: 'Campo harmônico' },
  { value: 'blank', label: 'Braço em branco' },
];

export function Print() {
  const { settings } = useSettings();
  const [raw, setRaw] = useLocalStorage<PrintConfig>(PRINT_KEY, DEFAULT_PRINT);
  const [board] = useLocalStorage<BoardState | null>('ss.board', null as unknown as BoardState);
  const cfg = useMemo(() => normalizePrint(raw), [raw]);
  const patch = useCallback((p: Partial<PrintConfig>) => setRaw((prev) => ({ ...normalizePrint(prev), ...p })), [setRaw]);
  const [copied, setCopied] = useState(false);
  const [params, setParams] = useSearchParams();

  // atalhos de outras telas: #/imprimir?scale=minor-pent&root=9  ou  #/imprimir?chord=maj7&root=0
  useEffect(() => {
    const root = Number(params.get('root'));
    const scale = params.get('scale');
    const chord = params.get('chord');
    if (!scale && !chord) return;
    const base = Number.isInteger(root) && root >= 0 && root < 12 ? { root } : {};
    patch(scale ? { ...base, kind: 'shapes', scaleId: scale, positions: [] } : { ...base, kind: 'chord', chordType: chord as string, chordView: 'voicings' });
    setParams({}, { replace: true });
  }, [params, setParams, patch]);

  const names = useMemo(() => ({ lang: cfg.lang === 'auto' ? settings.lang : cfg.lang, pref: cfg.pref === 'auto' ? settings.pref : cfg.pref }), [cfg.lang, cfg.pref, settings.lang, settings.pref]);
  const sheet = useMemo(() => buildSheet(cfg, names), [cfg, names]);
  const area = printableMm(cfg);
  const paper = PAPER_MM[cfg.paper];
  const sheetW = cfg.landscape ? paper.h : paper.w;
  const scaleBased = cfg.kind === 'shapes' || cfg.kind === 'neck';
  const hasNotes = cfg.kind !== 'blank' && !(cfg.kind === 'neck' && cfg.neckContent === 'empty');
  const scaleObj = useMemo(() => buildScale(scaleById(cfg.scaleId), cfg.root, names.pref), [cfg.scaleId, cfg.root, names.pref]);
  const canCaged = hasCagedShapes(scaleObj);
  const posCount = useMemo(() => (cfg.kind === 'shapes' ? scalePositions(scaleObj, tuningById(cfg.tuningId).midi, cfg.system).length : 0), [cfg.kind, cfg.system, scaleObj, cfg.tuningId]);

  // o título da aba vira o nome sugerido do PDF enquanto a janela de impressão está aberta
  const doPrint = () => {
    const prev = document.title;
    const restore = () => {
      document.title = prev;
      window.removeEventListener('afterprint', restore);
    };
    document.title = printDocTitle(sheet);
    window.addEventListener('afterprint', restore);
    window.setTimeout(restore, 60000);
    window.print();
  };

  const fromBoard = () => {
    if (!board || typeof board !== 'object') return;
    const sc = typeof board.scaleId === 'string' ? board.scaleId : cfg.scaleId;
    patch({
      kind: typeof board.pos === 'number' ? 'shapes' : 'neck',
      neckContent: 'scale',
      root: typeof board.root === 'number' ? board.root : cfg.root,
      scaleId: sc,
      positions: typeof board.pos === 'number' ? [board.pos] : [],
      system: board.system === 'caged' ? 'caged' : 'seven',
      label: board.label === 'degree' || board.label === 'none' ? board.label : 'note',
      fretMax: [12, 15, 17, 19, 22, 24].find((n) => n >= (board.fretMax ?? 15)) ?? 24,
    });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const togglePos = (i: number) => patch({ positions: cfg.positions.includes(i) ? cfg.positions.filter((p) => p !== i) : [...cfg.positions, i].sort((a, b) => a - b) });
  const pageCss = `@page { size: ${paper.name === 'Carta' ? 'letter' : 'A4'} ${cfg.landscape ? 'landscape' : 'portrait'}; margin: ${cfg.margin}mm; }`;
  const maxH = Math.max(40, area.h - 24);

  return (
    <>
      <style>{pageCss}</style>
      <PageHeader title="Imprimir" sub="Monte folhas de estudo — shapes, braço inteiro, acordes, campos harmônicos ou braço em branco — e imprima ou salve em PDF." eyebrow="Ferramentas" />
      <div className="print-page">
        <div className="print-controls panel no-print">
          <div className="row gap wrap">
            <button type="button" className="btn primary" onClick={doPrint} disabled={!sheet.diagrams.length}>
              <Icon name="download" size={16} /> Imprimir / Salvar PDF
            </button>
            <button type="button" className="btn small" onClick={() => setRaw(DEFAULT_PRINT)}>
              Restaurar padrão
            </button>
          </div>
          <p className="muted small-text">Na janela de impressão, escolha <b>Salvar como PDF</b> como destino para gerar o arquivo. Para papel comum, use o estilo <b>Preto e branco</b>: a folha sai branca, só com tinta preta.</p>

          <details open>
            <summary>Conteúdo</summary>
            <Field label="O que imprimir">
              <Chips small value={cfg.kind} onChange={(kind) => patch({ kind })} options={KINDS} />
            </Field>
            {board && (cfg.kind === 'shapes' || cfg.kind === 'neck') && (
              <button type="button" className="btn small" onClick={fromBoard}>
                {copied ? 'Copiado' : 'Copiar escala e posição da tela Braço'}
              </button>
            )}
            {cfg.kind !== 'blank' && (
              <Field label="Tônica">
                <RootChips value={cfg.root} onChange={(root) => patch({ root })} />
              </Field>
            )}
            {scaleBased && !(cfg.kind === 'neck' && cfg.neckContent !== 'scale') && (
              <Field label="Escala">
                <ScaleSelect value={cfg.scaleId} onChange={(scaleId) => patch({ scaleId, positions: [] })} />
              </Field>
            )}
            {cfg.kind === 'shapes' && (
              <>
                {canCaged && (
                  <Field label="Sistema de posições">
                    <Chips
                      small
                      value={cfg.system}
                      onChange={(system) => patch({ system, positions: [] })}
                      options={[
                        { value: 'caged', label: '5 formas (CAGED)' },
                        { value: 'seven', label: '7 posições (3 notas por corda)' },
                      ]}
                    />
                  </Field>
                )}
                <Field label={`Posições (${posCount})`}>
                  <div className="chips small" role="group" aria-label="Posições a imprimir">
                    <button type="button" className={`chip${cfg.positions.length === 0 ? ' active' : ''}`} aria-pressed={cfg.positions.length === 0} onClick={() => patch({ positions: [] })}>
                      Todas
                    </button>
                    {Array.from({ length: posCount }, (_, i) => (
                      <button key={i} type="button" className={`chip${cfg.positions.includes(i) ? ' active' : ''}`} aria-pressed={cfg.positions.includes(i)} onClick={() => togglePos(i)}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Região do braço">
                  <Chips small value={cfg.region} onChange={(region) => patch({ region })} options={[{ value: 0, label: 'Grave' }, { value: 1, label: '2ª' }, { value: 2, label: '3ª' }]} />
                </Field>
              </>
            )}
            {cfg.kind === 'neck' && (
              <Field label="Notas no braço">
                <Chips
                  small
                  value={cfg.neckContent}
                  onChange={(neckContent) => patch({ neckContent })}
                  options={[
                    { value: 'scale', label: 'Só da escala' },
                    { value: 'all', label: 'Todas as notas' },
                    { value: 'empty', label: 'Nenhuma (em branco)' },
                  ]}
                />
              </Field>
            )}
            {cfg.kind === 'chord' && (
              <>
                <Field label="Acorde">
                  <select value={cfg.chordType} onChange={(e) => patch({ chordType: e.target.value })} aria-label="Tipo de acorde">
                    {CHORD_GROUPS.map((g) => (
                      <optgroup key={g} label={g}>
                        {CHORD_TYPES.filter((t) => t.group === g).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.symbol || 'maior'} — {t.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                <Field label="Mostrar">
                  <Chips small value={cfg.chordView} onChange={(chordView) => patch({ chordView })} options={[{ value: 'voicings', label: 'Digitações' }, { value: 'neck', label: 'Notas no braço todo' }]} />
                </Field>
                {cfg.chordView === 'voicings' && (
                  <Field label="Quantas digitações">
                    <Chips small value={cfg.voicings} onChange={(voicings) => patch({ voicings })} options={VOICING_CHOICES.map((n) => ({ value: n, label: String(n) }))} />
                  </Field>
                )}
              </>
            )}
            {cfg.kind === 'field' && (
              <>
                <Field label="Campo">
                  <select value={cfg.fieldId} onChange={(e) => patch({ fieldId: e.target.value })} aria-label="Campo harmônico">
                    {FIELD_GROUPS.map((g) => (
                      <optgroup key={g} label={g}>
                        {FIELDS.filter((f) => f.group === g).map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                <Field label="Acordes">
                  <Chips small value={cfg.fieldSize} onChange={(fieldSize) => patch({ fieldSize })} options={[{ value: 'triads', label: 'Tríades' }, { value: 'tetrads', label: 'Tétrades' }]} />
                </Field>
              </>
            )}
            {cfg.kind === 'blank' && (
              <Field label="Quantos braços">
                <Chips small value={cfg.blankCount} onChange={(blankCount) => patch({ blankCount })} options={BLANK_CHOICES.map((n) => ({ value: n, label: String(n) }))} />
              </Field>
            )}
            {(cfg.kind === 'neck' || cfg.kind === 'blank' || (cfg.kind === 'chord' && cfg.chordView === 'neck')) && (
              <Field label="Até a casa">
                <Chips small value={cfg.fretMax} onChange={(fretMax) => patch({ fretMax })} options={FRET_CHOICES.map((n) => ({ value: n, label: String(n) }))} />
              </Field>
            )}
          </details>

          {hasNotes && (
            <details open>
              <summary>Notas e destaques</summary>
              <Field label="Escrever nas notas">
                <Chips small value={cfg.label} onChange={(label) => patch({ label })} options={[{ value: 'note', label: 'Nome da nota' }, { value: 'degree', label: 'Grau' }, { value: 'none', label: 'Nada' }]} />
              </Field>
              <Field label="Destacar">
                <Chips
                  small
                  value={scaleBased ? cfg.highlight : cfg.highlight === 'none' ? 'none' : 'root'}
                  onChange={(highlight) => patch({ highlight })}
                  options={[
                    { value: 'none', label: 'Nada' },
                    { value: 'root', label: 'Tônica' },
                    ...(scaleBased ? [{ value: 'tsd' as const, label: 'Tônica, subdominante e dominante' }, { value: 'chordtones' as const, label: 'Notas do acorde' }] : []),
                  ]}
                />
              </Field>
              <Field label="Nomes das notas">
                <Chips small value={cfg.lang} onChange={(lang) => patch({ lang })} options={[{ value: 'auto', label: 'Como no site' }, { value: 'letters', label: 'C D E' }, { value: 'latin', label: 'Dó Ré Mi' }]} />
              </Field>
              <Field label="Acidentes">
                <Chips small value={cfg.pref} onChange={(pref) => patch({ pref })} options={[{ value: 'auto', label: 'Como no site' }, { value: 'sharp', label: 'Sustenidos ♯' }, { value: 'flat', label: 'Bemóis ♭' }]} />
              </Field>
            </details>
          )}

          <details open>
            <summary>Braço</summary>
            <Field label="Afinação">
              <select value={cfg.tuningId} onChange={(e) => patch({ tuningId: e.target.value })} aria-label="Afinação">
                {TUNINGS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Direção do braço">
              <Chips small value={cfg.direction} onChange={(direction) => patch({ direction })} options={[{ value: 'auto', label: 'Automática' }, { value: 'h', label: 'Horizontal' }, { value: 'v', label: 'Vertical' }]} />
            </Field>
            <Toggle label="Canhoto (espelhado)" checked={cfg.leftHanded} onChange={(leftHanded) => patch({ leftHanded })} />
            <Toggle label="Números das casas" checked={cfg.showNumbers} onChange={(showNumbers) => patch({ showNumbers })} />
            <Toggle label="Marcações do braço (casas 3, 5, 7, 12…)" checked={cfg.showInlays} onChange={(showInlays) => patch({ showInlays })} />
            <Toggle label="Nomes das cordas soltas" checked={cfg.showStringNames} onChange={(showStringNames) => patch({ showStringNames })} />
          </details>

          <details open>
            <summary>Página</summary>
            <Field label="Estilo">
              <Chips small value={cfg.style} onChange={(style) => patch({ style })} options={[{ value: 'mono', label: 'Preto e branco' }, { value: 'color', label: 'Colorido' }]} />
            </Field>
            <Field label="Papel">
              <Chips small value={cfg.paper} onChange={(paper) => patch({ paper })} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Carta' }]} />
            </Field>
            <Field label="Orientação">
              <Chips small value={cfg.landscape ? 1 : 0} onChange={(v) => patch({ landscape: v === 1 })} options={[{ value: 1, label: 'Paisagem' }, { value: 0, label: 'Retrato' }]} />
            </Field>
            <Field label="Margem (mm)">
              <Chips small value={cfg.margin} onChange={(margin) => patch({ margin })} options={MARGIN_CHOICES.map((n) => ({ value: n, label: String(n) }))} />
            </Field>
            <Field label="Diagramas por linha">
              <Chips small value={cfg.cols} onChange={(cols) => patch({ cols })} options={[{ value: 0, label: 'Auto' }, ...[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))]} />
            </Field>
            <Field label="Título (opcional)">
              <input value={cfg.title} maxLength={80} placeholder={sheet.title} onChange={(e) => patch({ title: e.target.value })} aria-label="Título da folha" />
            </Field>
            <Toggle label="Rodapé com o nome do site" checked={cfg.showFooter} onChange={(showFooter) => patch({ showFooter })} />
          </details>
        </div>

        <div className="print-preview">
          {sheet.warnings.length > 0 && (
            <div className="notice err no-print" role="status">
              {sheet.warnings.join(' ')}
            </div>
          )}
          <p className="muted small-text no-print" style={{ margin: '0 0 8px' }}>
            Prévia da folha ({paper.name}, {cfg.landscape ? 'paisagem' : 'retrato'}). A quebra de páginas final aparece na janela de impressão.
          </p>
          <article className={`print-sheet ${cfg.style}`} style={{ ['--sheet-w' as string]: `${sheetW}mm`, ['--sheet-pad' as string]: `${cfg.margin}mm` }} aria-label="Folha para impressão">
            <header className="ps-head">
              <h2>{sheet.title}</h2>
              {sheet.subtitle && <p>{sheet.subtitle}</p>}
              {sheet.legend.length > 0 && (
                <ul className="ps-legend" aria-label="Legenda">
                  {sheet.legend.map((l) => (
                    <li key={l.role}>
                      <svg viewBox="0 0 30 30" width={24} height={24} aria-hidden="true">
                        <MarkerShape role={l.role} x={15} y={15} r={10} style={cfg.style} />
                      </svg>
                      {l.text}
                    </li>
                  ))}
                </ul>
              )}
            </header>
            {sheet.diagrams.length === 0 ? (
              <p className="ps-empty">Nada para imprimir com estas opções.</p>
            ) : (
              <div className="ps-grid" style={{ gridTemplateColumns: `repeat(${sheet.cols}, minmax(0, 1fr))` }}>
                {sheet.diagrams.map((d) => (
                  <figure key={d.id} className="ps-card">
                    {(d.title || d.subtitle) && (
                      <figcaption>
                        {d.title && <b>{d.title}</b>}
                        {d.subtitle && <span>{d.subtitle}</span>}
                      </figcaption>
                    )}
                    <PrintBoard diagram={d} style={cfg.style} names={names} leftHanded={cfg.leftHanded} showNumbers={cfg.showNumbers} showInlays={cfg.showInlays} showStringNames={cfg.showStringNames} maxHeightMm={maxH} />
                  </figure>
                ))}
              </div>
            )}
            {cfg.showFooter && <footer className="ps-foot">SongState · material de estudo de guitarra</footer>}
          </article>
        </div>
      </div>
    </>
  );
}
