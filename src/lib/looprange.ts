/**
 * Loop A–B dos players (YouTube/Spotify) como funções puras.
 *
 * Estados: `off` (sem repetir), `on` (repetindo), `paused` (pausado: os pontos A–B ficam guardados e a música segue em frente).
 * `exitAtB`: "seguir adiante" — termina o ciclo atual e, ao chegar no B, deixa a música continuar (loop passa a `paused`).
 */
export type LoopMode = 'off' | 'on' | 'paused';

export interface LoopState {
  a: number | null;
  b: number | null;
  mode: LoopMode;
  exitAtB: boolean;
}

export const EMPTY_LOOP: LoopState = { a: null, b: null, mode: 'off', exitAtB: false };

export const loopValid = (s: LoopState) => s.a !== null && s.b !== null && s.b > s.a;

/** Marca o ponto A ou B na posição atual. Se os pontos deixarem de formar um trecho válido, o loop desliga. */
export function setPoint(s: LoopState, which: 'a' | 'b', pos: number): LoopState {
  const next: LoopState = { ...s, [which]: Math.max(0, pos), exitAtB: false };
  return loopValid(next) || next.mode === 'off' ? next : { ...next, mode: 'off' };
}

/** Liga (ou retoma) o loop. `jump` leva a música para o A; sem `jump`, só vai para o A se estiver fora do trecho. */
export function engage(s: LoopState, pos: number, jump: boolean): { state: LoopState; seekTo: number | null } {
  if (!loopValid(s)) return { state: s, seekTo: null };
  const outside = pos < (s.a as number) || pos >= (s.b as number);
  return { state: { ...s, mode: 'on', exitAtB: false }, seekTo: jump || outside ? (s.a as number) : null };
}

/** Pausa o loop: mantém A e B, e a música segue além do B. */
export const pauseLoop = (s: LoopState): LoopState => (s.mode === 'on' ? { ...s, mode: 'paused', exitAtB: false } : s);

/** Alterna "terminar este ciclo e seguir adiante" (só faz sentido com o loop repetindo). */
export const toggleExit = (s: LoopState): LoopState => (s.mode === 'on' ? { ...s, exitAtB: !s.exitAtB } : s);

/** Apaga A e B. */
export const clearLoop = (): LoopState => EMPTY_LOOP;

/** Chamado a cada atualização da posição: volta ao A quando passa do B (ou, com `exitAtB`, deixa seguir e pausa o loop). */
export function tick(s: LoopState, pos: number): { state: LoopState; seekTo: number | null } {
  if (s.mode !== 'on' || !loopValid(s) || pos < (s.b as number)) return { state: s, seekTo: null };
  if (s.exitAtB) return { state: { ...s, mode: 'paused', exitAtB: false }, seekTo: null };
  return { state: s, seekTo: s.a as number };
}
