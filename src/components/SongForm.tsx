import { useState } from 'react';
import { Chips, Field } from './ui';
import { pcLabel } from '../lib/music';
import { delFile, putFile, uid, useSettings } from '../lib/storage';
import { parseLink, spotifySearch, youtubeSearch, type Song, type Source } from '../lib/songs';

export function SongForm({ initial, onSave, onClose }: { initial?: Song; onSave: (s: Song) => void; onClose: () => void }) {
  const { settings } = useSettings();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [artist, setArtist] = useState(initial?.artist ?? '');
  const [keyPc, setKeyPc] = useState<number>(initial?.keyPc ?? -1);
  const [minor, setMinor] = useState(initial?.minor ?? false);
  const [bpm, setBpm] = useState<string>(initial?.bpm ? String(initial.bpm) : '');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [existing, setExisting] = useState<Source[]>(initial?.sources ?? []);
  const [links, setLinks] = useState<string[]>(['']);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const q = `${title} ${artist}`.trim();

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
      id: initial?.id ?? uid(),
      title: title.trim(),
      artist: artist.trim(),
      keyPc: keyPc < 0 ? null : keyPc,
      minor,
      bpm: bpm ? Math.min(300, Math.max(20, +bpm)) : null,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      notes: notes.trim(),
      sources: [...existing, ...fromLinks, ...fromFiles],
      createdAt: initial?.createdAt ?? Date.now(),
    });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{initial ? 'Editar música' : 'Nova música'}</h2>
          <button type="button" className="btn icon" onClick={onClose}>✕</button>
        </div>
        <Field label="Título *"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Hotel California" autoFocus /></Field>
        <Field label="Artista"><input value={artist} onChange={(e) => setArtist(e.target.value)} /></Field>
        <Field label="Tonalidade">
          <Chips
            small
            value={keyPc}
            onChange={setKeyPc}
            options={[{ value: -1, label: '?' }, ...Array.from({ length: 12 }, (_, pc) => ({ value: pc, label: pcLabel(pc, settings.pref, settings.lang) }))]}
          />
          <Chips small value={minor ? 'm' : 'M'} onChange={(v) => setMinor(v === 'm')} options={[{ value: 'M', label: 'Maior' }, { value: 'm', label: 'Menor' }]} />
        </Field>
        <div className="row gap">
          <Field label="BPM"><input type="number" inputMode="numeric" value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="–" /></Field>
          <Field label="Tags (vírgula)"><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="blues, solo, lento" /></Field>
        </div>

        <Field label="Fontes de áudio">
          {existing.map((s) => (
            <div key={s.id} className="source-row">
              <span>{s.kind === 'spotify' ? '🟢' : s.kind === 'youtube' ? '🔴' : s.kind === 'file' ? '🎵' : '🔗'} {s.label}</span>
              <button type="button" className="btn small" onClick={() => setExisting(existing.filter((e) => e.id !== s.id))}>remover</button>
            </div>
          ))}
          {links.map((l, i) => (
            <input key={i} value={l} placeholder="Cole um link do Spotify ou YouTube" onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
          <div className="row gap wrap">
            <button type="button" className="btn small" onClick={() => setLinks([...links, ''])}>+ outro link</button>
            <label className="btn small file-btn">
              + arquivo de áudio
              <input type="file" accept="audio/*" multiple hidden onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])} />
            </label>
          </div>
          {files.map((f, i) => (
            <div key={i} className="source-row">
              <span>🎵 {f.name}</span>
              <button type="button" className="btn small" onClick={() => setFiles(files.filter((_, j) => j !== i))}>remover</button>
            </div>
          ))}
          {q && (
            <div className="row gap wrap search-links">
              <span className="muted">Procurar:</span>
              <a className="btn small" href={youtubeSearch(`${q} backing track`)} target="_blank" rel="noreferrer">YouTube · backing track ↗</a>
              <a className="btn small" href={spotifySearch(q)} target="_blank" rel="noreferrer">Spotify ↗</a>
            </div>
          )}
        </Field>
        <Field label="Anotações"><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Trechos, solo no minuto 2:10, capotraste, etc." /></Field>
        <button type="button" className="btn primary block" onClick={save} disabled={!title.trim() || saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </div>
  );
}
