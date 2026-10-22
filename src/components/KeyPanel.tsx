import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { chordNotes, chordPcs, chordTypeById } from '../lib/chords';
import { confidenceLabel, type KeyResult } from '../lib/keyfind';
import type { ChordAdvice, KeyAdvice, ScaleAdvice } from '../lib/keyadvice';
import { noteLabel, pcLabel, scaleById, type AccPref, type Lang } from '../lib/music';

export interface KeyCandidate {
  keyPc: number;
  minor: boolean;
  tag: string; // "salvo", "cifra", "áudio", "possível"
}

interface Props {
  keyPc: number;
  minor: boolean;
  source: 'escolhido' | 'salvo' | 'áudio' | 'cifra' | 'primeiro acorde';
  result: KeyResult | null;
  candidates: KeyCandidate[];
  advice: KeyAdvice;
  pref: AccPref;
  lang: Lang;
  canSave: boolean;
  onPick: (keyPc: number, minor: boolean) => void;
  onSave: () => void;
  audio: { available: boolean; busy: boolean; message: string; onAnalyze: () => void };
  hasChart: boolean;
  hasStream: boolean; // fonte do YouTube/Spotify
  onScale: (s: ScaleAdvice, chordPcs?: number[], id?: string) => void;
  focusId: string | null;
}

export const keyName = (pc: number, minor: boolean, pref: AccPref, lang: Lang) => `${pcLabel(pc, pref, lang)} ${minor ? 'menor' : 'maior'}`;
const scaleName = (s: ScaleAdvice, pref: AccPref, lang: Lang) => `${pcLabel(s.rootPc, pref, lang)} ${scaleById(s.scaleId).name}`;

/** Tom da música e recomendações de escalas e arpejos (pelo tom e por acorde). */
export function KeyPanel(p: Props) {
  const { pref, lang } = p;
  const conf = p.result ? confidenceLabel(p.result.confidence) : null;
  const row = (c: ChordAdvice) => {
    const notes = chordNotes(c.rootPc, chordTypeById(c.typeId), pref).map((n) => noteLabel(n.spelled, lang)).join(' · ');
    const id = `${c.rootPc}:${c.typeId}`;
    const symbol = `${pcLabel(c.rootPc, pref, lang)}${chordTypeById(c.typeId).symbol}`;
    return (
      <li key={id} className={`key-row${p.focusId === id ? ' active' : ''}`}>
        <div className="key-chord">
          <b>{symbol}</b>
          <span className="muted small-text">{c.roman}</span>
        </div>
        <div className="key-notes">
          <span className="muted small-text">Arpejo</span> {notes}
        </div>
        <div className="key-scale">
          <span className="muted small-text">Escala</span> {scaleName(c.scale, pref, lang)}
          {c.alt && <span className="muted small-text"> · ou {scaleName(c.alt, pref, lang)}</span>}
          <span className="muted small-text key-why">{c.scale.why}</span>
        </div>
        <div className="row gap wrap key-actions">
          <button type="button" className="btn small" onClick={() => p.onScale(c.scale, chordPcs(c.rootPc, c.typeId), id)} aria-label={`Ver ${symbol} no braço: escala e arpejo`}>
            Ver no braço
          </button>
          <Link className="btn small" to={`/imprimir?chord=${c.typeId}&root=${c.rootPc}`} aria-label={`Imprimir formas do ${symbol}`}>
            <Icon name="download" size={13} /> Acorde
          </Link>
          <Link className="btn small" to={`/imprimir?scale=${c.scale.scaleId}&root=${c.scale.rootPc}`} aria-label={`Imprimir shapes de ${scaleName(c.scale, pref, lang)}`}>
            <Icon name="download" size={13} /> Escala
          </Link>
        </div>
      </li>
    );
  };

  return (
    <section className="panel key-panel" aria-labelledby="key-title">
      <div className="row between wrap gap">
        <h3 id="key-title" aria-level={2}>
          Tom e recomendações
        </h3>
        {p.canSave && (
          <button type="button" className="btn small" onClick={p.onSave}>
            Salvar este tom na música
          </button>
        )}
      </div>

      <p style={{ margin: '4px 0' }}>
        <span className="tag key">Tom: {keyName(p.keyPc, p.minor, pref, lang)}</span>{' '}
        <span className="muted small-text">
          {p.source === 'salvo' ? 'informado por você' : p.source === 'escolhido' ? 'escolhido por você agora' : p.source === 'primeiro acorde' ? 'pelo primeiro acorde (sem análise)' : `detectado pela ${p.source === 'áudio' ? 'análise do áudio' : 'cifra'}`}
          {conf && p.source !== 'salvo' && p.source !== 'escolhido' && ` · confiança ${conf}`}
        </span>
      </p>
      {p.result && p.source !== 'salvo' && p.source !== 'escolhido' && (
        <p className="muted small-text" style={{ margin: '2px 0 8px' }}>
          {p.result.reasons.join(' ')}
          {p.result.relativeAmbiguous && ` Também pode ser ${keyName(p.result.alternatives[0].keyPc, p.result.alternatives[0].minor, pref, lang)} (relativa: usa as mesmas notas).`}
        </p>
      )}

      {p.candidates.length > 1 && (
        <div className="row gap wrap" role="group" aria-label="Escolher outro tom">
          <span className="muted small-text">Outras possibilidades:</span>
          {p.candidates.map((c) => {
            const on = c.keyPc === p.keyPc && c.minor === p.minor;
            return (
              <button key={`${c.keyPc}${c.minor}`} type="button" className={`chip small${on ? ' active' : ''}`} aria-pressed={on} onClick={() => p.onPick(c.keyPc, c.minor)}>
                {keyName(c.keyPc, c.minor, pref, lang)} <span className="muted small-text">· {c.tag}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="row gap wrap" style={{ margin: '8px 0' }}>
        {p.audio.available && (
          <button type="button" className="btn small" disabled={p.audio.busy} onClick={p.audio.onAnalyze}>
            {p.audio.busy ? 'Analisando o áudio…' : 'Detectar o tom pelo áudio'}
          </button>
        )}
        {p.audio.message && (
          <span className="small-text" role="status">
            {p.audio.message}
          </span>
        )}
      </div>
      {!p.audio.available && p.hasStream && !p.hasChart && <p className="muted small-text">O site não consegue "ouvir" vídeos do YouTube nem faixas do Spotify. Adicione a cifra (em Editar) ou envie o arquivo de áudio para detectar o tom automaticamente.</p>}
      {!p.hasChart && !p.hasStream && !p.audio.available && <p className="muted small-text">Adicione a cifra (em Editar) ou um arquivo de áudio para detectar o tom automaticamente.</p>}

      <h4 aria-level={3} style={{ margin: '12px 0 6px' }}>Escalas do tom</h4>
      <ul className="key-scales">
        {p.advice.scales.map((s) => (
          <li key={`${s.scaleId}-${s.rootPc}`}>
            <button type="button" className="chip small" onClick={() => p.onScale(s)}>
              {scaleName(s, pref, lang)}
            </button>
            <span className="muted small-text"> {s.why}</span>
          </li>
        ))}
      </ul>

      {p.advice.chords.length > 0 && (
        <>
          <h4 aria-level={3} style={{ margin: '12px 0 6px' }}>Arpejos e escalas por acorde</h4>
          <ul className="key-chords">{p.advice.chords.map(row)}</ul>
        </>
      )}
    </section>
  );
}
