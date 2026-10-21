import { useMemo, useState } from 'react';
import { Chips, Field } from './ui';
import { Icon } from './Icon';
import { parseChart } from '../lib/chords';
import { STYLES, type StyleId } from '../lib/jam';
import { pcLabel } from '../lib/music';
import { delFile, putFile, uid, useSettings } from '../lib/storage';
import { parseLink, type Song, type Source } from '../lib/songs';

const EXAMPLE = '[Verso]\n| Am | C | G | F |\n| Am | C | E7 | E7 |';

export function SongForm({ initial, onSave, onClose }: { initial?: Song; onSave: (s: Song) => void; onClose: () => void }) {
  const { settings } = useSettings();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [artist, setArtist] = useState(initial?.artist ?? '');
  const [keyPc, setKeyPc] = useState<number>(initial?.keyPc ?? -1);
  const [minor, setMinor] = useState(initial?.minor ?? false);
  const [bpm, setBpm] = useState<string>(initial?.bpm ? String(initial.bpm) : '');
  const [style, setStyle] = useState<StyleId>(initial?.style ?? 'rock');
  const [chart, setChart] = useState(initial?.chart ?? '');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [existing, setExisting] = useState<Source[]>(initial?.sources ?? []);
  const [links, setLinks] = useState<string[]>(['']);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => parseChart(chart, settings.pref), [chart, settings.pref]);

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    const removed = (initial?.sources ?? []).filter((s) => s.kind === 'file' && !existing.some((e) => e.id === s.id));
    await Promise.all(removed.map((s) => delFile(s.fileId!).catch(() => {})));
    const fromLinks = links.map((l) => parseLink(l, uid())).filter((s): s is Source => !!s);
    const fromFiles: Source[] = [];
    for (const f of files) {
      const fileId = uid();
      await putFile(fileId, f);
      fromFiles.push({ id: uid(), kind: 'file', label: f.name, fileId });
    }
    onSave({
      id: initial?.id && !initial.builtin ? initial.id : uid(),
      title: title.trim(),
      artist: artist.trim(),
      keyPc: keyPc < 0 ? null : keyPc,
      minor,
      bpm: bpm ? Math.min(300, Math.max(20, +bpm)) : null,
      style,
      chart: chart.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      notes: notes.trim(),
      sources: [...existing, ...fromLinks, ...fromFiles],
      createdAt: initial && !initial.builtin ? initial.createdAt : Date.now(),
    });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet wide" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{initial && !initial.builtin ? 'Editar música' : initial ? 'Copiar para minha biblioteca' : 'Nova música'}</h2>
          <button type="button" className="btn icon" onClick={onClose} aria-label="Fechar">
            <Icon name="x" />
          </button>
        </div>

        <div className="row gap wrap">
          <Field label="Título *">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Minha música" autoFocus />
          </Field>
          <Field label="Artista">
            <input value={artist} onChange={(e) => setArtist(e.target.value)} />
          </Field>
        </div>

        <Field label="Cifra — o site toca esta sequência para você">
          <textarea className="mono" rows={6} value={chart} onChange={(e) => setChart(e.target.value)} placeholder={EXAMPLE} spellCheck={false} />
          <div className="chart-help">
            <span className="muted small-text">
              Separe os compassos com <b>|</b>. Dois acordes no mesmo compasso dividem o tempo (<code>| C G |</code>). Use <code>%</code> para repetir, <code>[Verso]</code> ou <code>#</code> para comentários. Aceita Am7, F#m7b5, Cmaj7, D/F#, Bb7#9, Gsus4…
            </span>
            {!chart && (
              <button type="button" className="btn small" onClick={() => setChart(EXAMPLE)}>
                Inserir exemplo
              </button>
            )}
          </div>
          {chart && (
            <div className="chart-preview">
              <span className="muted small-text">
                {parsed.bars} compassos · {parsed.slots.length} acordes
              </span>
              <div className="chips small">
                {parsed.slots.slice(0, 40).map((s, i) => (
                  <span key={i} className="tag key">
                    {s.label}
                  </span>
                ))}
                {parsed.slots.length > 40 && <span className="tag">+{parsed.slots.length - 40}</span>}
              </div>
              {parsed.unknown.length > 0 && <div className="form-warn">Não reconhecidos: {parsed.unknown.join(' ')}</div>}
            </div>
          )}
        </Field>

        <div className="row gap wrap">
          <Field label="BPM">
            <input type="number" inputMode="numeric" value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="90" />
          </Field>
          <Field label="Estilo da base">
            <select value={style} onChange={(e) => setStyle(e.target.value as StyleId)}>
              {STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Tonalidade (para sugerir escalas)">
          <Chips
            small
            value={keyPc}
            onChange={setKeyPc}
            options={[{ value: -1, label: '?' }, ...Array.from({ length: 12 }, (_, pc) => ({ value: pc, label: pcLabel(pc, settings.pref, settings.lang) }))]}
          />
          <Chips small value={minor ? 'm' : 'M'} onChange={(v) => setMinor(v === 'm')} options={[{ value: 'M', label: 'Maior' }, { value: 'm', label: 'Menor' }]} />
        </Field>
        <Field label="Tags (vírgula)">
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="blues, solo, lento" />
        </Field>

        <details className="panel soft" open={existing.length > 0 || undefined}>
          <summary>Áudio próprio (opcional)</summary>
          <p className="muted small-text">Envie um arquivo seu (mp3, wav…) para tocar com controle de velocidade e loop A–B. Fica salvo só neste navegador. Links do Spotify/YouTube também podem ser embutidos na página.</p>
          {existing.map((s) => (
            <div key={s.id} className="source-row">
              <span>
                <Icon name={s.kind === 'file' ? 'music' : 'headphones'} size={16} /> {s.label}
              </span>
              <button type="button" className="btn small" onClick={() => setExisting(existing.filter((e) => e.id !== s.id))}>
                remover
              </button>
            </div>
          ))}
          {links.map((l, i) => (
            <input key={i} value={l} placeholder="Link do Spotify ou YouTube (será embutido)" onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
          <div className="row gap wrap">
            <button type="button" className="btn small" onClick={() => setLinks([...links, ''])}>
              + outro link
            </button>
            <label className="btn small file-btn">
              <Icon name="upload" size={15} /> arquivo de áudio
              <input type="file" accept="audio/*" multiple hidden onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])} />
            </label>
          </div>
          {files.map((f, i) => (
            <div key={i} className="source-row">
              <span>
                <Icon name="music" size={16} /> {f.name}
              </span>
              <button type="button" className="btn small" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                remover
              </button>
            </div>
          ))}
        </details>

        <Field label="Anotações">
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Trechos, capotraste, ideias de solo…" />
        </Field>
        <button type="button" className="btn primary block" onClick={save} disabled={!title.trim() || saving}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
