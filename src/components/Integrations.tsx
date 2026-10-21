import { useState } from 'react';
import { Field } from './ui';
import { Icon } from './Icon';
import { logoutSpotify, loginSpotify, redirectUri, useSpotifyConnected, isMobileBrowser } from '../lib/spotify';
import { useIntegrations } from '../lib/storage';

export function Integrations() {
  const [cfg, setCfg] = useIntegrations();
  const connected = useSpotifyConnected();
  const [copied, setCopied] = useState(false);
  const uri = redirectUri();
  const badHost = window.location.hostname === 'localhost';

  return (
    <div className="integrations">
      <section className="panel soft">
        <h3>
          <span className="dock-prov youtube">YouTube</span> Busca de vídeos
        </h3>
        <p className="muted small-text">
          Tocar um vídeo não exige configuração (cole o link). Para <b>buscar</b> dentro do site, informe uma chave gratuita da YouTube Data API v3 — cota diária de cerca de 100 buscas.
        </p>
        <Field label="Chave de API">
          <input type="password" autoComplete="off" value={cfg.youtubeKey} onChange={(e) => setCfg({ ...cfg, youtubeKey: e.target.value.trim() })} placeholder="AIza…" />
        </Field>
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
              Em <b>Credenciais → Criar credenciais → Chave de API</b>. Se quiser, restrinja a chave ao endereço do seu site.
            </li>
            <li>Cole a chave acima. Ela fica salva só neste navegador.</li>
          </ol>
        </details>
      </section>

      <section className="panel soft">
        <h3>
          <span className="dock-prov spotify">Spotify</span> Busca e player completo
        </h3>
        <p className="muted small-text">
          Toca as faixas completas dentro do site (exige conta <b>Premium</b> e navegador de computador). Em celular, o Spotify só permite o player embutido.
        </p>
        {badHost && (
          <div className="form-warn">
            O Spotify não aceita "localhost". Abra o site por <code>http://127.0.0.1:{window.location.port || '80'}</code> para conectar.
          </div>
        )}
        {isMobileBrowser() && <div className="form-warn">Neste dispositivo o player completo do Spotify não está disponível.</div>}
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
        <div className="row gap wrap">
          {connected ? (
            <>
              <span className="tag live">
                <Icon name="check" size={12} /> Conectado
              </span>
              <button type="button" className="btn small" onClick={logoutSpotify}>
                Desconectar
              </button>
            </>
          ) : (
            <button type="button" className="btn primary" disabled={!cfg.spotifyClientId} onClick={() => loginSpotify(cfg.spotifyClientId)}>
              Conectar ao Spotify
            </button>
          )}
        </div>
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
      </section>
    </div>
  );
}
