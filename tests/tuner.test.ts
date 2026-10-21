import { describe, expect, it } from 'vitest';
import { explainMicError, micSupported } from '../src/lib/mic';
import { TUNINGS } from '../src/lib/music';
import { DEFAULT_TUNER, normalizeTuner } from '../src/lib/tuner';

describe('preferências do afinador', () => {
  it('padrão quando não há nada salvo ou o valor é lixo', () => {
    for (const raw of [undefined, null, 5, 'x', [], {}]) expect(normalizeTuner(raw)).toEqual(DEFAULT_TUNER);
  });

  it('limita o lá de referência a 430–450 Hz e arredonda', () => {
    expect(normalizeTuner({ a4: 1000 }).a4).toBe(450);
    expect(normalizeTuner({ a4: 10 }).a4).toBe(430);
    expect(normalizeTuner({ a4: 441.6 }).a4).toBe(442);
    expect(normalizeTuner({ a4: NaN }).a4).toBe(440);
    expect(normalizeTuner({ a4: '442' }).a4).toBe(440);
  });

  it('aceita só modos e afinações que existem', () => {
    expect(normalizeTuner({ mode: 'chromatic' }).mode).toBe('chromatic');
    expect(normalizeTuner({ mode: 'outro' }).mode).toBe('strings');
    expect(normalizeTuner({ tuningId: TUNINGS[2].id }).tuningId).toBe(TUNINGS[2].id);
    expect(normalizeTuner({ tuningId: 'nao-existe' }).tuningId).toBe('standard');
  });
});

describe('microfone', () => {
  it('mensagens claras para cada tipo de erro', () => {
    expect(explainMicError({ name: 'NotAllowedError' })).toMatch(/negado/);
    expect(explainMicError({ name: 'SecurityError' })).toMatch(/negado/);
    expect(explainMicError({ name: 'NotFoundError' })).toMatch(/Nenhum microfone/);
    expect(explainMicError({ name: 'NotReadableError' })).toMatch(/outro aplicativo/);
    expect(explainMicError({ name: 'OverconstrainedError' })).toMatch(/não está mais disponível/);
    expect(explainMicError(new Error('x'))).toMatch(/Não foi possível/);
    expect(explainMicError(null)).toMatch(/Não foi possível/);
    expect(explainMicError(undefined)).toMatch(/Não foi possível/);
  });

  it('sem navigator.mediaDevices (ambiente de teste) o suporte é falso, sem lançar erro', () => {
    expect(micSupported()).toBe(false);
  });
});
