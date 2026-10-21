import { Component, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isPrefKey } from '../lib/backup';

interface State {
  failed: boolean;
}

/** Evita a tela branca: se uma página quebrar (ex.: preferência salva com formato inesperado), oferece uma saída. */
class Boundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('Erro na página', error);
  }
  private resetPrefs = () => {
    try {
      const drop: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && isPrefKey(k)) drop.push(k);
      }
      drop.forEach((k) => localStorage.removeItem(k)); // só preferências de tela: músicas, estudos e progresso ficam
    } catch {
      /* sem acesso ao armazenamento */
    }
    location.reload();
  };
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="panel" role="alert">
        <h2>Algo deu errado nesta página</h2>
        <p className="muted">Seus dados (músicas, estudos e progresso) não foram apagados. Às vezes isso acontece por uma preferência salva em formato antigo.</p>
        <div className="row gap wrap">
          <button type="button" className="btn primary" onClick={this.resetPrefs}>
            Redefinir preferências e recarregar
          </button>
          <button type="button" className="btn" onClick={() => location.reload()}>
            Só recarregar
          </button>
          <Link to="/dados" className="btn">
            Ir para Dados e backup
          </Link>
        </div>
      </section>
    );
  }
}

/** Uma barreira por rota: navegar para outra página tenta de novo. */
export function SafeRoutes({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <Boundary key={pathname}>{children}</Boundary>;
}
