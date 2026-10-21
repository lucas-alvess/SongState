import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { PageHeader, Toggle } from '../components/ui';
import { BackupError, LAST_BACKUP_KEY, MAX_BACKUP_BYTES, applyBackup, createBackup, parseBackup, referencedFileIds, wipeAll, type ImportMode, type Summary } from '../lib/backup';
import { getFile, requestPersistence } from '../lib/db';
import { notifyStorage } from '../lib/storage';

const fmtBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);
const describe = (s: Summary) =>
  [s.songs && `${s.songs} música(s)`, s.studies && `${s.studies} estudo(s) próprio(s)`, s.lessonsDone && `${s.lessonsDone} lição(ões) concluída(s)`, s.exercises && `${s.exercises} exercício(s) com histórico`, s.reviewItems && `${s.reviewItems} item(ns) do Treino`, s.studyDays && `${s.studyDays} dia(s) de estudo`, s.files && `${s.files} arquivo(s) de áudio`].filter(Boolean).join(', ') || 'nenhum dado';

interface Info {
  usage?: number;
  quota?: number;
  persisted?: boolean;
  audioBytes: number;
  audioCount: number;
}

function useStorageInfo() {
  const [info, setInfo] = useState<Info>({ audioBytes: 0, audioCount: 0 });
  const refresh = useCallback(async () => {
    const next: Info = { audioBytes: 0, audioCount: 0 };
    try {
      const est = await navigator.storage?.estimate?.();
      next.usage = est?.usage;
      next.quota = est?.quota;
      next.persisted = await navigator.storage?.persisted?.();
    } catch {
      /* navegador sem a API */
    }
    for (const id of referencedFileIds(localStorage)) {
      const blob = await getFile(id).catch(() => undefined);
      if (blob) {
        next.audioBytes += blob.size;
        next.audioCount++;
      }
    }
    setInfo(next);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { info, refresh };
}

export function Data() {
  const { info, refresh } = useStorageInfo();
  const [withFiles, setWithFiles] = useState(false);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const last = Number(localStorage.getItem(LAST_BACKUP_KEY)) || 0;

  const doExport = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { blob, counts } = await createBackup(localStorage, { files: withFiles });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `songstate-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      try {
        localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
      } catch {
        /* sem espaço para a data: o backup em si já foi gerado */
      }
      setMsg({ ok: true, text: `Backup gerado (${fmtBytes(blob.size)}): ${describe(counts)}. Guarde o arquivo em um lugar seguro, como seu Drive ou e-mail.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Não foi possível gerar o backup.' });
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file?: File) => {
    if (!file) return;
    setMsg(null);
    if (file.size > MAX_BACKUP_BYTES) {
      setMsg({ ok: false, text: 'Arquivo grande demais para ser um backup do SongState.' });
      return;
    }
    setBusy(true);
    try {
      const backup = parseBackup(await file.text());
      if (mode === 'replace' && !confirm('Substituir apaga as músicas, estudos e o progresso atuais e usa os do arquivo. Quer continuar?')) return;
      const { written, summary } = await applyBackup(backup, mode, localStorage);
      notifyStorage(written);
      setMsg({ ok: true, text: `Backup ${mode === 'merge' ? 'mesclado' : 'restaurado'}: ${describe(summary)}.` });
      void refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof BackupError ? e.message : 'Não foi possível ler o arquivo.' });
    } finally {
      setBusy(false);
      if (importRef.current) importRef.current.value = '';
    }
  };

  const doWipe = async () => {
    if (!confirm('Apagar TODOS os dados deste navegador (músicas, progresso, configurações, chaves e arquivos)? Isso não pode ser desfeito. Faça um backup antes.')) return;
    setBusy(true);
    try {
      await wipeAll(localStorage);
      location.reload();
    } catch {
      setMsg({ ok: false, text: 'Não foi possível apagar tudo.' });
      setBusy(false);
    }
  };

  const protect = async () => {
    const ok = await requestPersistence();
    setMsg(ok ? { ok: true, text: 'Pronto: o navegador não vai apagar os dados do site quando faltar espaço.' } : { ok: false, text: 'O navegador não concedeu a proteção. Instalar o app (menu do navegador) e usá-lo com frequência costuma ajudar.' });
    void refresh();
  };

  const pct = info.usage && info.quota ? Math.max(1, Math.round((info.usage / info.quota) * 100)) : 0;
  const stale = last > 0 && Date.now() - last > 30 * 86400000;

  return (
    <>
      <Link to="/" className="back">
        <Icon name="back" size={16} /> Início
      </Link>
      <PageHeader eyebrow="Seus dados" title="Dados e backup" sub="Tudo o que você faz no SongState fica salvo neste navegador. Faça um backup para não perder o progresso se limpar os dados do site ou trocar de aparelho." />

      <section className="panel">
        <h3 aria-level={2} className="section-title">Backup</h3>
        <p className="muted small-text">
          {last ? `Último backup: ${new Date(last).toLocaleDateString('pt-BR')}.` : 'Você ainda não fez nenhum backup.'} {stale && <b className="warn-text">Faz mais de 30 dias: vale gerar um novo.</b>}
        </p>
        <p className="muted small-text">O arquivo inclui músicas, estudos próprios, lições concluídas, histórico dos exercícios e preferências. As chaves do Spotify e do YouTube nunca entram no arquivo.</p>
        {info.audioCount > 0 && <Toggle label={`Incluir os ${info.audioCount} arquivo(s) de áudio (${fmtBytes(info.audioBytes)}). O backup fica bem maior.`} checked={withFiles} onChange={setWithFiles} />}
        <div className="row gap wrap" style={{ marginTop: 12 }}>
          <button type="button" className="btn primary" onClick={doExport} disabled={busy}>
            <Icon name="download" size={16} /> Baixar backup
          </button>
        </div>
      </section>

      <section className="panel">
        <h3 aria-level={2} className="section-title">Restaurar de um backup</h3>
        <div className="radio-col" role="radiogroup" aria-label="Modo de restauração">
          <label className="radio">
            <input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
            <span>
              <b>Mesclar</b> (recomendado): junta o backup com o que você já tem e não sobrescreve nada.
            </span>
          </label>
          <label className="radio">
            <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
            <span>
              <b>Substituir</b>: deixa os dados exatamente como no arquivo.
            </span>
          </label>
        </div>
        <div className="row gap wrap" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => importRef.current?.click()} disabled={busy}>
            <Icon name="upload" size={16} /> Escolher arquivo de backup
          </button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => void doImport(e.target.files?.[0])} aria-label="Arquivo de backup" />
        </div>
        {msg && (
          <p className={msg.ok ? 'notice ok' : 'notice err'} role="status">
            {msg.text}
          </p>
        )}
      </section>

      <section className="panel">
        <h3 aria-level={2} className="section-title">Armazenamento</h3>
        {info.quota ? (
          <>
            <div className="meter" role="img" aria-label={`${pct}% do espaço usado`}>
              <span style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <p className="muted small-text">
              {fmtBytes(info.usage ?? 0)} usados de cerca de {fmtBytes(info.quota)} disponíveis neste navegador.
            </p>
          </>
        ) : (
          <p className="muted small-text">Este navegador não informa o uso de espaço.</p>
        )}
        <p className="small-text">
          Proteção contra limpeza automática:{' '}
          {info.persisted ? (
            <b className="ok-text">ativa</b>
          ) : (
            <>
              <b className="warn-text">não ativa</b>. O navegador pode apagar os dados do site se faltar espaço no aparelho.{' '}
              <button type="button" className="btn small" onClick={protect}>
                Proteger meus dados
              </button>
            </>
          )}
        </p>
      </section>

      <section className="panel">
        <h3 aria-level={2} className="section-title">Apagar tudo</h3>
        <p className="muted small-text">Remove deste navegador todos os dados do SongState, inclusive as chaves do Spotify e do YouTube. Útil em um computador compartilhado.</p>
        <button type="button" className="btn danger" onClick={doWipe} disabled={busy}>
          Apagar todos os dados
        </button>
      </section>
    </>
  );
}
