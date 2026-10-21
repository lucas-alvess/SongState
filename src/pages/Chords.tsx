import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChordDiagram } from '../components/ChordDiagram';
import { Fretboard, type Marker } from '../components/Fretboard';
import { Icon } from '../components/Icon';
import { Chips, Field, PageHeader, RootChips, Toggle } from '../components/ui';
import {
  CHORD_GROUPS,
  CHORD_TYPES,
  chordFullName,
  chordNotes,
  chordSymbol,
  chordTypeById,
  detectChords,
  findVoicings,
  type ChordMatch,
} from '../lib/chords';
import { INTERVAL_NAMES, mod12, pcAt, pcLabel, tuningById } from '../lib/music';
import { strum } from '../lib/audio';
import { useLocalStorage, useSettings, useVertical } from '../lib/storage';

const OPEN_C = [-1, 3, 2, 0, 1, 0];

export function Chords() {
  const { settings } = useSettings();
  const vertical = useVertical();
  const tuning = tuningById(settings.tuningId).midi;
  const N = tuning.length;
  const { pref, lang } = settings;

  const [sel, setSel] = useState<number[]>(() => (N === 6 ? OPEN_C : Array(N).fill(-1)));
  const [alt, setAlt] = useState(0);
  const [prefs, setPrefs] = useLocalStorage<{ fretMax: number; labels: 'note' | 'degree'; sound: boolean }>('ss.chords', { fretMax: 12, labels: 'note', sound: true });
  const [dictRoot, setDictRoot] = useState(0);
  const [dictType, setDictType] = useState('maj');
  const [group, setGroup] = useState(CHORD_GROUPS[0]);
  const dictRef = useRef<HTMLDivElement>(null);
  const [params, setParams] = useSearchParams();

  // links de estudos: #/acordes?root=0&type=maj7
  useEffect(() => {
    const t = params.get('type');
    if (!t) return;
    const type = CHORD_TYPES.find((c) => c.id === t);
    if (type) {
      setDictRoot(+(params.get('root') ?? 0));
      setDictType(type.id);
      setGroup(type.group);
    }
    setParams({}, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    setSel((s) => (s.length === N ? s : N === 6 ? OPEN_C : Array(N).fill(-1)));
  }, [N]);
  useEffect(() => setAlt(0), [sel]);

  const played = sel.map((f, s) => (f >= 0 ? s : -1)).filter((s) => s >= 0);
  const pcs = played.map((s) => pcAt(tuning, s, sel[s]));
  const bassPc = pcs[0];
  const matches = useMemo(() => (pcs.length >= 2 ? detectChords(pcs, bassPc) : []), [pcs.join(','), bassPc]); // eslint-disable-line react-hooks/exhaustive-deps
  const main: ChordMatch | undefined = matches[Math.min(alt, matches.length - 1)];
  const notes = main ? chordNotes(main.rootPc, main.type, pref) : [];
  const tokenByPc = new Map(notes.map((n) => [n.pc, n.token]));
  const uniquePcs = [...new Set(pcs)];

  const toggle = useCallback(
    (s: number, f: number) => {
      const next = sel.map((x, i) => (i === s ? (x === f ? -1 : f) : x));
      setSel(next);
      if (prefs.sound && next[s] === f) strum([tuning[s] + f], 0);
    },
    [sel, prefs.sound, tuning],
  );

  const markers: Marker[] = [];
  for (let s = 0; s < N; s++)
    for (let f = 0; f <= prefs.fretMax; f++) {
      const pc = pcAt(tuning, s, f);
      if (sel[s] === f) {
        const isRoot = main && pc === main.rootPc;
        const label = prefs.labels === 'degree' && tokenByPc.has(pc) ? tokenByPc.get(pc) : pcLabel(pc, pref, lang);
        markers.push({ string: s, fret: f, kind: isRoot ? 'root' : 'chord', label });
      } else markers.push({ string: s, fret: f, kind: 'ghost', label: pcLabel(pc, pref, lang) });
    }

  const play = () => strum(played.map((s) => tuning[s] + sel[s]));

  // dicionário
  const dType = chordTypeById(dictType);
  const voicings = useMemo(() => findVoicings(dictRoot, dType, tuning, 8), [dictRoot, dType, tuning]);
  const dNotes = chordNotes(dictRoot, dType, pref);

  const load = (frets: number[]) => {
    setSel(frets);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (prefs.sound) strum(frets.map((f, s) => (f >= 0 ? tuning[s] + f : -1)).filter((m) => m >= 0));
  };

  const showInDictionary = (m: ChordMatch) => {
    setDictRoot(m.rootPc);
    setDictType(m.type.id);
    setGroup(m.type.group);
    dictRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <PageHeader eyebrow="Dicionário" title="Acordes" sub="Toque nas casas para montar um acorde (uma nota por corda). O site descobre o nome. Ou procure um acorde no dicionário abaixo." />

      <section className="panel chord-result">
        {pcs.length === 0 && <div className="muted">Toque nas casas do braço para formar um acorde.</div>}
        {pcs.length === 1 && (
          <>
            <div className="cr-symbol">{pcLabel(pcs[0], pref, 'letters')}</div>
            <div className="cr-name">Nota {pcLabel(pcs[0], pref, 'latin')} — adicione mais notas para formar um acorde</div>
          </>
        )}
        {pcs.length >= 2 && !main && (
          <>
            <div className="cr-symbol dim">?</div>
            <div className="cr-name">
              {uniquePcs.length === 2
                ? `Intervalo de ${INTERVAL_NAMES[mod12(uniquePcs[1] - uniquePcs[0])].toLowerCase()} entre ${pcLabel(uniquePcs[0], pref, lang)} e ${pcLabel(uniquePcs[1], pref, lang)}`
                : 'Combinação sem nome na lista de acordes comuns'}
            </div>
            <div className="cr-notes">
              {uniquePcs.map((pc) => (
                <span key={pc} className="tag">
                  {pcLabel(pc, pref, lang)}
                </span>
              ))}
            </div>
          </>
        )}
        {main && (
          <>
            <div className="cr-symbol">{chordSymbol(main.rootPc, main.type, main.bassPc, pref)}</div>
            <div className="cr-name">
              {chordFullName(main.rootPc, main.type, main.bassPc, pref)}
              {main.omit5 && <span className="muted"> · sem a quinta</span>}
            </div>
            <div className="cr-notes">
              {notes.map((n) => (
                <span key={n.token} className={`cr-note${uniquePcs.includes(n.pc) ? ' on' : ''}`}>
                  <b>{pcLabel(n.pc, pref, lang)}</b>
                  <small>{n.token}</small>
                </span>
              ))}
            </div>
            {matches.length > 1 && (
              <div className="cr-alt">
                <span className="muted small-text">Também pode ser:</span>
                <div className="chips small">
                  {matches.map((m, i) =>
                    i === alt ? null : (
                      <button key={i} type="button" className="chip" onClick={() => setAlt(i)} title={chordFullName(m.rootPc, m.type, m.bassPc, pref)}>
                        {chordSymbol(m.rootPc, m.type, m.bassPc, pref)}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <div className="row gap wrap cr-actions">
          <button type="button" className="btn primary" onClick={play} disabled={!played.length}>
            <Icon name="volume" size={18} /> Tocar
          </button>
          <button type="button" className="btn" onClick={() => setSel(Array(N).fill(-1))} disabled={!played.length}>
            Limpar
          </button>
          {main && (
            <button type="button" className="btn" onClick={() => showInDictionary(main)}>
              Ver variações <Icon name="arrow" size={16} />
            </button>
          )}
        </div>
      </section>

      <div className="board-wrap">
        <div className="board-scroll">
          <Fretboard tuning={tuning} fretMax={prefs.fretMax} vertical={vertical} leftHanded={settings.leftHanded} markers={markers} onCell={toggle} />
        </div>
      </div>
      <div className="panel soft board-opts">
        <Field label="Casas">
          <Chips small value={prefs.fretMax} onChange={(fretMax) => setPrefs({ ...prefs, fretMax })} options={[5, 7, 12, 15, 22].map((n) => ({ value: n, label: n }))} />
        </Field>
        <Field label="Rótulo da nota selecionada">
          <Chips small value={prefs.labels} onChange={(labels) => setPrefs({ ...prefs, labels })} options={[{ value: 'note', label: 'Nota' }, { value: 'degree', label: 'Grau no acorde' }]} />
        </Field>
        <Toggle label="Som ao tocar nas casas" checked={prefs.sound} onChange={(sound) => setPrefs({ ...prefs, sound })} />
      </div>

      <div ref={dictRef} className="dict-anchor" />
      <h2 className="section-title">Dicionário de acordes</h2>
      <section className="panel">
        <Field label="Nota fundamental">
          <RootChips value={dictRoot} onChange={setDictRoot} />
        </Field>
        <Field label="Tipo">
          <Chips small value={group} onChange={(g) => { setGroup(g); setDictType(CHORD_TYPES.find((t) => t.group === g)!.id); }} options={CHORD_GROUPS.map((g) => ({ value: g, label: g }))} />
          <Chips small value={dictType} onChange={setDictType} options={CHORD_TYPES.filter((t) => t.group === group).map((t) => ({ value: t.id, label: t.symbol || 'maior' }))} />
        </Field>
        <div className="dict-head">
          <div className="cr-symbol sm">{chordSymbol(dictRoot, dType, dictRoot, pref)}</div>
          <div>
            <div className="cr-name">{chordFullName(dictRoot, dType, dictRoot, pref)}</div>
            <div className="cr-notes">
              {dNotes.map((n) => (
                <span key={n.token} className="cr-note on">
                  <b>{pcLabel(n.pc, pref, lang)}</b>
                  <small>{n.token}</small>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {voicings.length === 0 ? (
        <p className="muted">Não encontrei digitações confortáveis para este acorde na afinação atual.</p>
      ) : (
        <>
          <p className="muted small-text">Toque em uma digitação para vê-la no braço e ouvir. Pontos rosa são a tônica; “x” corda não tocada; “o” corda solta.</p>
          <div className="diagram-grid">
            {voicings.map((v, i) => (
              <ChordDiagram key={i} frets={v.frets} tuning={tuning} rootPc={dictRoot} active={v.frets.join() === sel.join()} onClick={() => load(v.frets)} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
