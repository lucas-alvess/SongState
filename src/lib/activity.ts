/**
 * Medidor de tempo de estudo ativo.
 *
 * Só conta o tempo em que a aba está visível E houve interação recente (toque, tecla, rolagem).
 * Deixar o site aberto e sair do computador não conta. Na seção Backing o limite de inatividade é maior,
 * porque tocar junto com uma base quase não exige mexer na tela.
 */
import { useEffect } from 'react';
import { addActive } from './srs';
import { useDays } from './storage';

export const TICK_MS = 5000;
export const FLUSH_MS = 15000;
export const IDLE_MS = 90 * 1000;
export const IDLE_BACKING_MS = 10 * 60 * 1000;

export type Section = 'braco' | 'estudos' | 'exercicios' | 'acordes' | 'campos' | 'backing' | 'outros';
export const SECTION_LABEL: Record<Section, string> = { braco: 'Braço', estudos: 'Estudos', exercicios: 'Exercícios e treino', acordes: 'Acordes', campos: 'Campos harmônicos', backing: 'Backing', outros: 'Outros' };

/** Seção do app a partir do hash da URL (ex.: "#/treino" → exercicios). */
export function sectionOf(hash: string): Section {
  const first = hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  switch (first) {
    case '':
      return 'braco';
    case 'estudos':
    case 'referencia':
      return 'estudos';
    case 'exercicios':
    case 'treino':
      return 'exercicios';
    case 'acordes':
    case 'campos':
    case 'backing':
      return first;
    default:
      return 'outros';
  }
}

export class ActivityMeter {
  private lastInteraction: number;
  private lastTick: number;
  constructor(now: number) {
    this.lastInteraction = now;
    this.lastTick = now;
  }
  interact(now: number) {
    this.lastInteraction = now;
  }
  /** Chamado periodicamente. Devolve os ms ativos desde a última chamada (0 se inativo ou aba oculta). */
  tick(now: number, visible: boolean, section: Section): number {
    const dt = Math.min(Math.max(0, now - this.lastTick), TICK_MS * 3); // suspensão do computador não vira horas
    this.lastTick = now;
    if (!visible) return 0;
    const limit = section === 'backing' ? IDLE_BACKING_MS : IDLE_MS;
    if (now - this.lastInteraction > limit) return 0;
    return dt;
  }
}

/** Liga o medidor ao app inteiro. Use uma única vez, no componente raiz. */
export function useActivityTracker() {
  const [, setDays] = useDays();
  useEffect(() => {
    const meter = new ActivityMeter(Date.now());
    const pending = new Map<Section, number>();
    let lastFlush = Date.now();

    const flush = () => {
      lastFlush = Date.now();
      if (!pending.size) return;
      const items = [...pending];
      pending.clear();
      const now = Date.now();
      setDays((d) => items.reduce((acc, [section, ms]) => addActive(acc, now, section, ms), d));
    };
    const tick = () => {
      const now = Date.now();
      const ms = meter.tick(now, document.visibilityState === 'visible', sectionOf(location.hash));
      if (ms > 0) {
        const s = sectionOf(location.hash);
        pending.set(s, (pending.get(s) ?? 0) + ms);
      }
      if (now - lastFlush >= FLUSH_MS) flush();
    };
    const touch = () => meter.interact(Date.now());
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        tick();
        flush();
      } else touch();
    };

    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    const id = window.setInterval(tick, TICK_MS);
    return () => {
      clearInterval(id);
      tick();
      flush();
      events.forEach((e) => window.removeEventListener(e, touch, { capture: true }));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [setDays]);
}
