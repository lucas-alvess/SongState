import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Chips, PageHeader } from '../components/ui';
import { CHORD_GROUPS, CHORD_TYPES, chordNotes } from '../lib/chords';
import { CIRCLE_ORDER, signatureOf } from '../lib/harmony';
import { INTERVAL_NAMES, INTERVAL_TOKENS, SCALES, SCALE_GROUPS, buildScale, noteLabel, pcLabel } from '../lib/music';
import { GLOSSARY } from '../lib/reference';
import { useSettings } from '../lib/storage';

type Tab = 'glossario' | 'escalas' | 'intervalos' | 'acordes' | 'armaduras';

export function Reference() {
  const { settings } = useSettings();
  const { lang } = settings;
  const [tab, setTab] = useState<Tab>('glossario');
  const [q, setQ] = useState('');
  const gloss = useMemo(() => GLOSSARY.filter((g) => `${g.term} ${g.def}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.term.localeCompare(b.term, 'pt-BR')), [q]);

  return (
    <>
      <Link to="/estudos" className="back">
        <Icon name="back" size={16} /> Estudos
      </Link>
      <PageHeader eyebrow="Consulta rápida" title="Referência" sub="Glossário e tabelas para consultar durante o estudo. As tabelas são geradas pelos mesmos dados do site, então sempre batem com o braço e com os acordes." />

      <div className="ref-tabs">
        <Chips
          small
          value={tab}
          onChange={setTab}
          options={[
            { value: 'glossario', label: 'Glossário' },
            { value: 'escalas', label: 'Escalas' },
            { value: 'intervalos', label: 'Intervalos' },
            { value: 'acordes', label: 'Acordes' },
            { value: 'armaduras', label: 'Armaduras de clave' },
          ]}
        />
      </div>

      {tab === 'glossario' && (
        <>
          <input className="search" placeholder="Buscar termo…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
          <div className="glossary">
            {gloss.map((g) => (
              <div key={g.term} className="gloss-item">
                <b>{g.term}</b>
                <p>{g.def}</p>
              </div>
            ))}
            {!gloss.length && <p className="muted">Nenhum termo encontrado.</p>}
          </div>
        </>
      )}

      {tab === 'escalas' && (
        <section className="panel">
          <p className="muted small-text">Fórmulas em graus e as notas de cada escala a partir do Dó.</p>
          {SCALE_GROUPS.map((g) => (
            <div key={g}>
              <h3 className="section-title" style={{ marginTop: 18 }}>
                {g}
              </h3>
              <div className="table-scroll">
                <table className="field-table ref-table">
                  <thead>
                    <tr>
                      <th>Escala</th>
                      <th>Fórmula</th>
                      <th>Notas em Dó</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SCALES.filter((s) => s.group === g).map((s) => (
                      <tr key={s.id}>
                        <td className="deg">
                          <b>{s.name}</b>
                        </td>
                        <td>{s.formula.join(' ')}</td>
                        <td>{buildScale(s, 0, 'sharp').notes.map((n) => noteLabel(n.spelled, lang)).join(' · ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'intervalos' && (
        <section className="panel">
          <p className="muted small-text">Distância em semitons (casas) e o intervalo a partir do Dó.</p>
          <div className="table-scroll">
            <table className="field-table ref-table">
              <thead>
                <tr>
                  <th>Semitons</th>
                  <th>Intervalo</th>
                  <th>Grau</th>
                  <th>A partir do Dó</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 13 }, (_, i) => (
                  <tr key={i}>
                    <td className="deg">
                      <b>{i}</b>
                    </td>
                    <td>{i === 12 ? 'Oitava' : INTERVAL_NAMES[i]}</td>
                    <td>{i === 12 ? '8' : INTERVAL_TOKENS[i]}</td>
                    <td>{pcLabel(i % 12, i > 5 && i < 12 ? 'sharp' : 'flat', lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'acordes' && (
        <section className="panel">
          <p className="muted small-text">Fórmulas dos tipos de acorde do dicionário e as notas de cada um a partir do Dó.</p>
          {CHORD_GROUPS.map((g) => (
            <div key={g}>
              <h3 className="section-title" style={{ marginTop: 18 }}>
                {g}
              </h3>
              <div className="table-scroll">
                <table className="field-table ref-table">
                  <thead>
                    <tr>
                      <th>Cifra</th>
                      <th>Nome</th>
                      <th>Fórmula</th>
                      <th>Notas em Dó</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CHORD_TYPES.filter((t) => t.group === g).map((t) => (
                      <tr key={t.id}>
                        <td className="deg">
                          <b>C{t.symbol}</b>
                        </td>
                        <td style={{ whiteSpace: 'normal' }}>{t.name}</td>
                        <td>{t.tokens.join(' ')}</td>
                        <td>{chordNotes(0, t, 'sharp').map((n) => noteLabel(n.spelled, lang)).join(' · ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="small-text">
            <Link to="/acordes">Abra o dicionário de acordes</Link> para ver as digitações no braço.
          </p>
        </section>
      )}

      {tab === 'armaduras' && (
        <section className="panel">
          <p className="muted small-text">Armadura de clave de cada tonalidade maior (na ordem do círculo das quintas) e a sua relativa menor.</p>
          <div className="table-scroll">
            <table className="field-table ref-table">
              <thead>
                <tr>
                  <th>Maior</th>
                  <th>Relativa menor</th>
                  <th>Acidentes</th>
                  <th>Quais</th>
                </tr>
              </thead>
              <tbody>
                {CIRCLE_ORDER.map((pc) => {
                  const sig = signatureOf(pc);
                  const pref = sig.count < 0 ? 'flat' : 'sharp';
                  const names = sig.letters.map((l) => (lang === 'latin' ? { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' }[l] : l) + sig.kind).join(' ');
                  return (
                    <tr key={pc}>
                      <td className="deg">
                        <b>{pc === 6 ? `${pcLabel(pc, 'sharp', lang)} / ${pcLabel(pc, 'flat', lang)}` : pcLabel(pc, pref, lang)}</b>
                      </td>
                      <td>{pcLabel((pc + 9) % 12, pref, lang)}m</td>
                      <td>{sig.count ? `${Math.abs(sig.count)}${sig.kind}` : 'nenhum'}</td>
                      <td>{names || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small-text">Fá♯ e Sol♭ são a mesma tonalidade (enarmônicas): uma tem 6 sustenidos, a outra 6 bemóis.</p>
        </section>
      )}
    </>
  );
}
