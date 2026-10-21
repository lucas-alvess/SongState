/** Gravações feitas por cima de uma base: montar a base de novo e tocar as duas juntas, alinhadas. */
import { getCtx } from './audio';
import { Jam, makeSlot, type Slot } from './jam';
import type { SlotTuple, TakeInfo } from './loops';

export const slotsToTuples = (slots: Slot[]): SlotTuple[] => slots.map((s) => [s.rootPc, s.bassPc, s.typeId, s.len, s.bar, s.label]);
export const tuplesToSlots = (t: SlotTuple[]): Slot[] => t.map(([r, b, typeId, len, bar, label]) => makeSlot(r, b, typeId, len, bar, label));

export interface TakePlayback {
  stop: () => void;
  ended: Promise<void>;
}

/**
 * Toca a gravação. Com `withBase`, a base é montada de novo com os mesmos ajustes e a gravação entra
 * exatamente no ponto em que foi tocada (o início da música coincide com `take.offset` segundos de gravação).
 */
export function playTake(samples: Float32Array, sampleRate: number, take: TakeInfo, withBase: boolean): TakePlayback {
  const c = getCtx();
  const buffer = c.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.value = 0.95;
  src.connect(gain).connect(c.destination);

  let jam: Jam | null = null;
  let when = c.currentTime + 0.05;
  let skip = 0;
  if (withBase) {
    jam = new Jam({ timeline: tuplesToSlots(take.slots), bpm: take.bpm, style: take.style, vol: take.vol }, () => {});
    jam.start(take.countIn, take.fromSlot);
    const musicStart = jam.musicStartTime ?? c.currentTime + 0.12;
    const aligned = musicStart - take.offset; // instante em que o 1º quadro da gravação deve soar
    when = Math.max(c.currentTime + 0.005, aligned);
    skip = when - aligned; // se já passou, começa um pouco adiante na gravação
  }
  let finish: () => void = () => {};
  const ended = new Promise<void>((resolve) => (finish = resolve));
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    jam?.stop();
    try {
      src.stop();
    } catch {
      /* já parou */
    }
    src.disconnect();
    gain.disconnect();
    finish();
  };
  src.onended = end;
  src.start(when, Math.min(skip, Math.max(0, buffer.duration - 0.001)));
  return { stop: end, ended };
}
