import { useState } from 'react';
import { Field } from './ui';
import { Icon } from './Icon';
import { logoutSpotify, loginSpotify, redirectUri, spotifyCheck, useSpotifyConnected, isMobileBrowser, type SpotifyCheck } from '../lib/spotify';
import { BUILT_IN, useIntegrations } from '../lib/storage';
import { explainYoutubeError, youtubeSearch } from '../lib/youtube';

export function Integrations() {
  const [cfg, setCfg] = useIntegrations();
  const connected = useSpotifyConnected();
  const [copied, setCopied] = useState(false);
  const [check, setCheck] = useState<SpotifyCheck | 'running' | null>(null);
  const [test, setTest] = useState<{ state: 'idle' | 'testing' | 'ok' | 'error'; msg?: string }>({ state: 'idle' });

  const testKey = async () => {
    setTest({ state: 'testing' });
    try {
      await youtubeSearch('guitar backing track', cfg.youtubeKey, 1);
      setTest({ state: 'ok' });
    } catch (e) {
      setTest({ state: 'error', msg: explainYoutubeError((e as Error).message, window.location.origin) });
    }
  };
  const ytBuiltIn = !!BUILT_IN.youtubeKey;
  const spBuiltIn = !!BUILT_IN.spotifyClientId;
  const uri = redirectUri();
  const badHost = window.location.hostname === 'localhost';

  return (
    <div className="integrations">
      <section className="panel soft">
        <h3>
          <span className="dock-prov youtube">YouTube</span> Busca de vídeos
        </h3>
        {ytBuiltIn ? (
          <p className="muted small-text">A busca de vídeos já está pronta para uso em Backing → Buscar e ouvir. Para tocar um vídeo, também dá para colar o link.</p>
        ) : (
          <p className="muted small-text">
            Tocar um vídeo não exige configuração (cole o link). Para <b>buscar</b> dentro do site, informe uma chave gratuita da YouTube Data API v3 — cota diária de cerca de 100 buscas.
          </p>
        )}
        {!ytBuiltIn && (<>
        <Field label="Chave de API">
          <input
            type="password"
            autoComplete="off"
            value={cfg.youtubeKey}
            onChange={(e) => {
              setCfg({ ...cfg, youtubeKey: e.target.value.trim() });
              setTest({ state: 'idle' });
            }}
            placeholder="AIza…"
          />
        </Field>
        <div className="row gap wrap key-test">
          <button type="button" className="btn small" disabled={!cfg.youtubeKey || test.state === 'testing'} onClick={testKey}>
            {test.state === 'testing' ? 'Testando…' : 'Testar chave'}
          </button>
          {cfg.youtubeKey && test.state === 'idle' && <span className="muted small-text">Chave salva neste navegador.</span>}
          {test.state === 'ok' && (
            <span className="tag live">
              <Icon name="check" size={12} /> Chave funcionando
            </span>
          )}
        </div>
        {test.state === 'error' && <div className="form-warn">{test.msg}</div>}
        <details>
          <summary>Como obter a chave</summary>
          <ol className="steps-list">
            <li>
              Acesse <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">console.cloud.google.com</a> e crie um projeto.
            </li>
            <li>
              Em <b>APIs e serviços → Biblioteca</b>, ative a <b>YouTube Data API v3</b>.
            </li>
            <li>
              Em <b>Credenciais → Criar credenciais → Chave de API</b>.
            </li>
            <li>
              <b>Restrinja a chave</b> (importante, pois ela fica visível no navegador): abra a chave e, em <b>Restrições de aplicativo</b>, escolha <b>Sites (referenciadores HTTP)</b> e adicione <code>{window.location.origin}/*</code>. Em <b>Restrições de API</b>, escolha <b>Restringir chave</b> e marque só a <b>YouTube Data API v3</b>.
            </li>
            <li>Cole a chave acima. Ela fica salva só neste navegador.</li>
          </ol>
        </details>
        </>)}
      </section>

      <section className="panel soft">
        <h3>
          <span className="dock-prov spotify">Spotify</span> Busca e player completo
        </h3>
        <p className="muted small-text">
          Toca as faixas completas dentro do site (exige conta <b>Premium</b> e navegador de computador). Em celular, o Spotify só permite o player embutido.{spBuiltIn ? ' É só conectar a sua conta.' : ''}
        </p>
        {badHost && (
          <div className="form-warn">
            O Spotify não aceita "localhost". Abra o site por <code>http://127.0.0.1:{window.location.port || '80'}</code> para conectar.
          </div>
        )}
        {isMobileBrowser() && <div className="form-warn">Neste dispositivo o player completo do Spotify não está disponível.</div>}
        {!spBuiltIn && (<>
        <Field label="Client ID">
          <input value={cfg.spotifyClientId} onChange={(e) => setCfg({ ...cfg, spotifyClientId: e.target.value.trim() })} placeholder="32 caracteres do painel de desenvolvedor" />
        </Field>
        <Field label="Redirect URI (registre exatamente este endereço no app)">
          <div className="copy-row">
            <code>{uri}</code>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                navigator.clipboard?.writeText(uri);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </Field>
        </>)}
        <div className="row gap wrap">
          {connected ? (
            <>
              <span className="tag live">
                <Icon name="check" size={12} /> Conectado
              </span>
              <button
                type="button"
                className="btn small"
                disabled={check === 'running'}
                onClick={() => {
                  setCheck('running');
                  spotifyCheck().then(setCheck, (e) => setCheck({ ok: false, steps: [{ label: 'Teste', ok: false, detail: (e as Error).message }] }));
                }}
              >
                {check === 'running' ? 'Testando…' : 'Testar conexão'}
              </button>
              <button type="button" className="btn small" onClick={() => (setCheck(null), logoutSpotify())}>
                Desconectar
              </button>
            </>
          ) : (
            <button type="button" className="btn primary" disabled={!cfg.spotifyClientId} onClick={() => loginSpotify(cfg.spotifyClientId)}>
              Conectar ao Spotify
            </button>
          )}
        </div>
        {check && check !== 'running' && (
          <ul className="check-list" role="status">
            {check.steps.map((st) => (
              <li key={st.label} className={st.ok ? 'ok-text' : 'warn-text'}>
                <b>{st.ok ? '✓' : '✗'} {st.label}</b>
                {st.detail ? <span className="muted"> — {st.detail}</span> : null}
              </li>
            ))}
            <li>{check.ok ? 'Tudo certo: o player completo deve funcionar.' : 'Corrija os itens com ✗ e teste de novo.'}</li>
          </ul>
        )}
        {!spBuiltIn && (
        <details>
          <summary>Como obter o Client ID</summary>
          <ol className="steps-list">
            <li>
              Entre em <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">developer.spotify.com/dashboard</a> com sua conta e clique em <b>Create app</b>.
            </li>
            <li>
              Em <b>Redirect URIs</b>, adicione o endereço acima. Marque as APIs <b>Web API</b> e <b>Web Playback SDK</b>.
            </li>
            <li>
              Abra o app → <b>Settings</b> e copie o <b>Client ID</b> (não precisa do Client Secret).
            </li>
            <li>
              Em <b>User Management</b>, adicione o e-mail da sua conta (apps em modo de desenvolvimento só funcionam para contas cadastradas).
            </li>
            <li>Cole o Client ID aqui e clique em <b>Conectar ao Spotify</b>.</li>
          </ol>
        </details>
        )}
      </section>
    </div>
  );
}
