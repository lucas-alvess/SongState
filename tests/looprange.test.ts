import { describe, expect, it } from 'vitest';
import { EMPTY_LOOP, clearLoop, engage, loopValid, pauseLoop, setPoint, tick, toggleExit, type LoopState } from '../src/lib/looprange';

const ab = (a = 10, b = 20, mode: LoopState['mode'] = 'off'): LoopState => ({ a, b, mode, exitAtB: false });

describe('loop A–B', () => {
  it('só é válido com A e B e B depois de A', () => {
    expect(loopValid(EMPTY_LOOP)).toBe(false);
    expect(loopValid(ab(10, 10))).toBe(false);
    expect(loopValid(ab(20, 10))).toBe(false);
    expect(loopValid(ab(10, 20))).toBe(true);
  });

  it('marcar pontos guarda a posição; ficar inválido desliga o loop', () => {
    let s = setPoint(EMPTY_LOOP, 'a', 12);
    s = setPoint(s, 'b', 30);
    expect(s).toMatchObject({ a: 12, b: 30, mode: 'off' });
    const on = engage(s, 15, true).state;
    expect(setPoint(on, 'b', 11).mode).toBe('off'); // B antes do A
    expect(setPoint(on, 'b', 25).mode).toBe('on'); // ajuste válido mantém ligado
    expect(setPoint(EMPTY_LOOP, 'a', -5).a).toBe(0);
  });

  it('ligar vai ao A; retomar só volta ao A se estiver fora do trecho', () => {
    expect(engage(ab(), 14, true)).toMatchObject({ seekTo: 10, state: { mode: 'on' } });
    expect(engage(ab(10, 20, 'paused'), 14, false).seekTo).toBeNull();
    expect(engage(ab(10, 20, 'paused'), 25, false).seekTo).toBe(10);
    expect(engage(ab(10, 20, 'paused'), 5, false).seekTo).toBe(10);
    expect(engage(EMPTY_LOOP, 5, true)).toEqual({ state: EMPTY_LOOP, seekTo: null });
  });

  it('repete ao passar do B e não mexe antes dele', () => {
    const s = ab(10, 20, 'on');
    expect(tick(s, 19.9).seekTo).toBeNull();
    expect(tick(s, 20).seekTo).toBe(10);
    expect(tick(s, 21.2).seekTo).toBe(10);
  });

  it('pausado ou desligado não repete; a música segue', () => {
    expect(tick(ab(10, 20, 'paused'), 30).seekTo).toBeNull();
    expect(tick(ab(10, 20, 'off'), 30).seekTo).toBeNull();
  });

  it('pausar mantém A e B para retomar depois', () => {
    const p = pauseLoop(ab(10, 20, 'on'));
    expect(p).toMatchObject({ a: 10, b: 20, mode: 'paused' });
    expect(pauseLoop(ab(10, 20, 'off')).mode).toBe('off');
  });

  it('"seguir adiante" termina o ciclo atual e pausa o loop no B, sem voltar', () => {
    let s = toggleExit(ab(10, 20, 'on'));
    expect(s.exitAtB).toBe(true);
    expect(tick(s, 15)).toEqual({ state: s, seekTo: null });
    const r = tick(s, 20.3);
    expect(r.seekTo).toBeNull();
    expect(r.state).toMatchObject({ mode: 'paused', exitAtB: false, a: 10, b: 20 });
    s = toggleExit(toggleExit(ab(10, 20, 'on'))); // cancelar
    expect(tick(s, 21).seekTo).toBe(10);
    expect(toggleExit(ab(10, 20, 'paused')).exitAtB).toBe(false);
  });

  it('marcar ponto ou retomar cancela o "seguir adiante" pendente', () => {
    const pending = toggleExit(ab(10, 20, 'on'));
    expect(setPoint(pending, 'b', 25).exitAtB).toBe(false);
    expect(engage(pending, 15, false).state.exitAtB).toBe(false);
  });

  it('limpar zera tudo', () => {
    expect(clearLoop()).toEqual(EMPTY_LOOP);
  });
});
