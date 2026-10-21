import { useState } from 'react';
import { Icon } from './Icon';
import { Toggle } from './ui';
import { connect, disconnect, setAudio, setClientId, syncNow, useSync, type SyncView } from '../lib/sync';

const when = (t: number) => {
  if (!t) return 'ainda não sincronizou';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'agora há pouco';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return new Date(t).toLocaleDateString('pt-BR');
};

export function statusText(v: SyncView): string {
  switch (v.status) {
    case 'connecting':
      return 'Abrindo o login do Google…';
    case 'syncing':
      return 'Sincronizando…';
    case 'login-needed':
      return 'Conta ligada, mas é preciso reconectar para enviar (o login vale por cerca de 1 hora). Seus dados continuam salvos aqui.';
    case 'offline':
      return `Sem internet. Tudo continua funcionando e será enviado quando voltar. Última sincronização: ${when(v.lastSync)}.`;
    case 'error':
      return v.error || 'A sincronização falhou.';
    case 'idle':
      return `${v.pending ? 'Alterações aguardando envio. ' : 'Tudo sincronizado. '}Última sincronização: ${when(v.lastSync)}.`;
    default:
      return '';
  }
}

/** Atalho no topo: só aparece quando há conta ligada e algo precisa de atenção (ou está enviando). */
export function SyncChip() {
  const v = useSync();
  if (!v.linked || v.status === 'off') return null;
  const needs = v.status === 'login-needed';
  const label = needs ? 'Reconectar a sincronização com o Google' : statusText(v);
  if (!needs && v.status !== 'error' && v.status !== 'offline') return null;
  return (
    <button type="button" className={`streak-chip pending sync-chip`} aria-label={label} title={label} onClick={() => (needs ? void connect() : void syncNow())}>
      <Icon name="cloud" size={16} />
      {needs ? <span className="sync-chip-text">Reconectar</span> : null}
    </button>
  );
}

export function SyncPanel() {
  const v = useSync();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(v.clientId);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel soft sync-panel">
      {!v.linked ? (
        <>
          <p className="small-text" style={{ margin: '0 0 10px' }}>
            Entre com o Google para guardar seus dados na sua conta (numa pasta oculta do seu Drive, que só o SongState enxerga) e usá-los em outros aparelhos. <b>Continua tudo funcionando sem internet</b>: os dados ficam no aparelho e são enviados quando der.
          </p>
          {v.configured ? (
            <button type="button" className="btn primary" disabled={busy || v.status === 'connecting'} onClick={() => act(connect)}>
              <Icon name="cloud" size={16} /> Entrar com o Google
            </button>
          ) : (
            <p className="notice err">Falta configurar o login do Google (Client ID). Veja o passo a passo no README, seção "Login Google e sincronização".</p>
          )}
        </>
      ) : (
        <>
          <p style={{ margin: '0 0 6px' }}>
            Conta: <b>{v.email}</b>
          </p>
          <p className="small-text" role="status" style={{ margin: '0 0 10px' }}>
            {statusText(v)}
          </p>
          {v.skipped > 0 && <p className="notice err">{v.skipped} arquivo(s) de áudio são grandes demais (mais de 150 MB) e não foram enviados.</p>}
          <div className="row gap wrap">
            {v.status === 'login-needed' ? (
              <button type="button" className="btn primary small" disabled={busy} onClick={() => act(connect)}>
                Reconectar
              </button>
            ) : (
              <button type="button" className="btn small" disabled={busy || v.status === 'syncing'} onClick={() => act(syncNow)}>
                Sincronizar agora
              </button>
            )}
            <button type="button" className="btn small" disabled={busy} onClick={() => act(() => disconnect(false))}>
              Desconectar
            </button>
            <button
              type="button"
              className="btn small danger"
              disabled={busy}
              onClick={() => {
                if (confirm('Desconectar e apagar os dados DESTE aparelho? Eles continuam na sua conta do Google e voltam quando você entrar de novo.')) void act(() => disconnect(true));
              }}
            >
              Desconectar e apagar daqui
            </button>
          </div>
          <Toggle label="Sincronizar também os áudios e os loops (usa mais internet e espaço do Drive)" checked={v.audio} onChange={setAudio} />
        </>
      )}
      {v.error && v.status !== 'error' && (
        <p className="notice err" role="alert">
          {v.error}
        </p>
      )}
      {!v.usingBuiltInId && !v.linked && (
        <details className="sync-advanced">
          <summary>Configuração avançada</summary>
          <label className="small-text" htmlFor="sync-client-id">
            Client ID do Google (público, não é segredo)
          </label>
          <input id="sync-client-id" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => setClientId(draft)} placeholder="1234-abc.apps.googleusercontent.com" autoComplete="off" spellCheck={false} />
        </details>
      )}
    </section>
  );
}
