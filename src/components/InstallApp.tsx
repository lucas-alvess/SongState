import { Icon } from './Icon';
import { useInstall } from '../lib/pwa';

/** Seção dos Ajustes: instalar o site como aplicativo. */
export function InstallApp() {
  const { installed, canPrompt, ios, install } = useInstall();

  return (
    <section className="panel soft install-card">
      <h3>Instalar como aplicativo</h3>
      {installed ? (
        <span className="tag live">
          <Icon name="check" size={12} /> Você já está usando o app instalado
        </span>
      ) : canPrompt ? (
        <>
          <p className="muted small-text">Abre em janela própria, com ícone na tela inicial ou na área de trabalho, e funciona mesmo sem internet (exceto busca e reprodução do YouTube/Spotify).</p>
          <button type="button" className="btn primary" onClick={install}>
            <Icon name="upload" size={16} /> Instalar SongState
          </button>
        </>
      ) : ios ? (
        <ol className="steps-list">
          <li>
            No Safari, toque em <b>Compartilhar</b> (o quadrado com a seta para cima).
          </li>
          <li>
            Escolha <b>Adicionar à Tela de Início</b>.
          </li>
          <li>
            Toque em <b>Adicionar</b>. O ícone do SongState aparece na tela inicial.
          </li>
        </ol>
      ) : (
        <p className="muted small-text">
          No <b>Chrome ou Edge</b>: clique no ícone de instalar na barra de endereço (ou menu ⋮ → <b>Instalar SongState</b> / <b>Salvar e compartilhar → Instalar página como app</b>). No <b>Chrome do Android</b>: menu ⋮ → <b>Instalar app</b>. No <b>Safari (iPhone/iPad)</b>: Compartilhar → <b>Adicionar à Tela de Início</b>.
        </p>
      )}
    </section>
  );
}
