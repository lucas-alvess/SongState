import { describe, expect, it, vi } from 'vitest';
import { MIGRATIONS, SCHEMA_KEY, runMigrations, type KV, type Migration } from '../src/lib/migrations';

const memory = (init: Record<string, string> = {}): KV & { data: Map<string, string> } => {
  const data = new Map(Object.entries(init));
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('migrações', () => {
  it('em um navegador novo, aplica todas e grava a versão', () => {
    const s = memory();
    const v = runMigrations(s);
    expect(v).toBe(Math.max(...MIGRATIONS.map((m) => m.version)));
    expect(s.getItem(SCHEMA_KEY)).toBe(String(v));
  });

  it('é idempotente: não roda de novo o que já foi aplicado', () => {
    const run = vi.fn();
    const list: Migration[] = [{ version: 1, name: 'a', run }];
    const s = memory();
    runMigrations(s, list);
    runMigrations(s, list);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('roda em ordem de versão, mesmo que a lista esteja embaralhada', () => {
    const order: number[] = [];
    const list: Migration[] = [3, 1, 2].map((version) => ({ version, name: String(version), run: () => void order.push(version) }));
    runMigrations(memory(), list);
    expect(order).toEqual([1, 2, 3]);
  });

  it('se uma falha, para nela, mantém a versão anterior e preserva os dados', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    const list: Migration[] = [
      { version: 1, name: 'ok', run: (st) => st.setItem('x', '1') },
      { version: 2, name: 'quebra', run: () => { throw new Error('boom'); } },
      { version: 3, name: 'depois', run: after },
    ];
    const s = memory({ keep: 'meus dados' });
    expect(runMigrations(s, list)).toBe(1);
    expect(s.getItem(SCHEMA_KEY)).toBe('1');
    expect(s.getItem('keep')).toBe('meus dados');
    expect(after).not.toHaveBeenCalled();
  });

  it('versão salva inválida é tratada como zero', () => {
    const run = vi.fn();
    runMigrations(memory({ [SCHEMA_KEY]: 'lixo' }), [{ version: 1, name: 'a', run }]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('armazenamento indisponível não lança erro', () => {
    const broken: KV = {
      getItem: () => {
        throw new Error('negado');
      },
      setItem: () => {
        throw new Error('negado');
      },
    };
    expect(() => runMigrations(broken)).not.toThrow();
  });

  it('versões únicas na lista oficial', () => {
    const v = MIGRATIONS.map((m) => m.version);
    expect(new Set(v).size).toBe(v.length);
  });
});
