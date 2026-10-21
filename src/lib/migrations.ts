/**
 * Migrações dos dados salvos no navegador.
 *
 * A versão do esquema fica em `ss.schema`. Cada migração roda uma única vez, em ordem, e só
 * avança a versão se terminar sem erro. Quando mudar o formato de algum dado salvo, acrescente
 * uma migração nova ao final da lista (nunca altere uma antiga).
 */

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Migration {
  version: number;
  name: string;
  run(store: KV): void;
}

export const SCHEMA_KEY = 'ss.schema';

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'base: formato dos dados existentes até a v0.1',
    run() {
      /* nada a converter: os dados já estão no formato atual */
    },
  },
];

/** Roda as migrações pendentes. Devolve a versão final. Nunca lança erro. */
export function runMigrations(store: KV, migrations: Migration[] = MIGRATIONS): number {
  let current = 0;
  try {
    const raw = Number(store.getItem(SCHEMA_KEY));
    current = Number.isInteger(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0; // armazenamento indisponível
  }
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (m.version <= current) continue;
    try {
      m.run(store);
      store.setItem(SCHEMA_KEY, String(m.version));
      current = m.version;
    } catch (e) {
      console.error(`Migração ${m.version} (${m.name}) falhou`, e);
      break; // não pula etapas: tenta de novo na próxima abertura
    }
  }
  return current;
}
