/**
 * Biblioteca de loops e gravações.
 *
 * - Os metadados ficam em localStorage (`ss.loops`, uma lista pequena) e entram no backup como os demais dados.
 * - O áudio de cada camada fica no IndexedDB (store "files") como WAV de 16 bits, com ids `lp-…`.
 */
import { delFile, getFile, putFile } from './db';
import type { StyleId } from './jam';
import { chain, decodeWav, encodeWav, mixLayers, resample, type Layer } from './wav';

export const LOOPS_KEY = 'ss.loops';
export const MAX_LAYERS = 8;
export const MAX_LOOPS = 60;
export const MAX_LOOP_SECONDS = 60;
export const MAX_TAKE_SECONDS = 360;

export interface LoopLayer {
  id: string; // id do arquivo de áudio
  vol: number; // 0–1
  mute: boolean;
}

/** Slot da base em forma compacta: [fundamental, baixo, tipo, duração, compasso, rótulo]. */
export type SlotTuple = [number, number, string, number, number, string];

export interface TakeInfo {
  offset: number; // segundos entre o início da gravação e o início da música (contagem incluída)
  countIn: boolean;
  fromSlot: number; // acorde em que a base começou
  style: StyleId;
  bpm: number;
  vol: { drums: number; bass: number; chords: number };
  slots: SlotTuple[];
}

export interface LoopMeta {
  id: string;
  name: string;
  kind: 'loop' | 'take';
  bpm: number;
  beats: number; // batidas por compasso
  bars: number; // 0 = livre (sem compassos)
  sampleRate: number;
  samples: number; // tamanho de cada camada, em amostras
  layers: LoopLayer[];
  createdAt: number;
  updatedAt: number;
  songId?: string;
  take?: TakeInfo;
}

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const newLoopId = () => `l${rid()}`;
export const newLayerFileId = () => `lp-${rid()}`;

export const loopSeconds = (m: Pick<LoopMeta, 'samples' | 'sampleRate'>) => m.samples / m.sampleRate;
export const fmtDuration = (s: number) => (s < 60 ? `${s.toFixed(1).replace('.', ',')} s` : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);

// ---------- validação (dados vindos do armazenamento ou de um backup) ----------

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const FILE_ID = /^lp-[\w-]{1,40}$/;
const STYLES = ['rock', 'shuffle', 'ballad', 'funk'];

function sanitizeTake(d: unknown): TakeInfo | undefined {
  if (!isObj(d) || !Array.isArray(d.slots)) return undefined;
  const slots: SlotTuple[] = [];
  for (const s of d.slots.slice(0, 400)) {
    if (!Array.isArray(s) || s.length < 6 || typeof s[2] !== 'string' || !/^[\w#()♭♯+-]{0,20}$/.test(s[2])) continue;
    slots.push([Math.round(num(s[0], 0, 11, 0)), Math.round(num(s[1], 0, 11, 0)), s[2], Math.round(num(s[3], 1, 64, 16)), Math.round(num(s[4], 0, 1000, 0)), str(s[5], 24)]);
  }
  if (!slots.length) return undefined;
  const vol = isObj(d.vol) ? d.vol : {};
  return {
    offset: num(d.offset, 0, 30, 0),
    countIn: d.countIn === true,
    fromSlot: Math.round(num(d.fromSlot, 0, 399, 0)),
    style: STYLES.includes(d.style as string) ? (d.style as StyleId) : 'rock',
    bpm: Math.round(num(d.bpm, 30, 300, 100)),
    vol: { drums: num(vol.drums, 0, 1, 0.8), bass: num(vol.bass, 0, 1, 0.8), chords: num(vol.chords, 0, 1, 0.7) },
    slots,
  };
}

/** Reconstrói a lista de loops descartando o que for inválido. Com `fileIds`, só ficam camadas cujo áudio existe. */
export function sanitizeLoops(v: unknown, fileIds?: ReadonlySet<string>): LoopMeta[] {
  if (!Array.isArray(v)) return [];
  const out: LoopMeta[] = [];
  for (const d of v.slice(0, MAX_LOOPS)) {
    if (!isObj(d)) continue;
    const id = str(d.id, 24).replace(/[^\w-]/g, '');
    const kind = d.kind === 'take' ? 'take' : 'loop';
    const sampleRate = Math.round(num(d.sampleRate, 8000, 192000, 48000));
    const samples = Math.round(num(d.samples, 0, sampleRate * (kind === 'take' ? MAX_TAKE_SECONDS : MAX_LOOP_SECONDS), 0));
    const layers: LoopLayer[] = [];
    if (Array.isArray(d.layers)) {
      for (const l of d.layers.slice(0, MAX_LAYERS)) {
        if (!isObj(l) || typeof l.id !== 'string' || !FILE_ID.test(l.id)) continue;
        if (fileIds && !fileIds.has(l.id)) continue;
        layers.push({ id: l.id, vol: num(l.vol, 0, 1, 1), mute: l.mute === true });
      }
    }
    if (!id || !samples || !layers.length) continue;
    const meta: LoopMeta = {
      id,
      name: str(d.name, 80).trim() || 'Sem nome',
      kind,
      bpm: Math.round(num(d.bpm, 30, 300, 100) * 10) / 10,
      beats: Math.round(num(d.beats, 1, 12, 4)),
      bars: Math.round(num(d.bars, 0, 64, 0)),
      sampleRate,
      samples,
      layers,
      createdAt: num(d.createdAt, 0, 1e15, 0),
      updatedAt: num(d.updatedAt, 0, 1e15, 0),
    };
    const songId = str(d.songId, 40).replace(/[^\w-]/g, '');
    if (songId) meta.songId = songId;
    const take = kind === 'take' ? sanitizeTake(d.take) : undefined;
    if (take) meta.take = take;
    if (kind === 'take' && !take) continue; // gravação sem os dados da base não dá para ouvir junto: descarta
    if (!out.some((x) => x.id === id)) out.push(meta);
  }
  return out;
}

/** Ids dos arquivos de áudio usados pelos loops (para o backup e a limpeza). */
export function loopFileIds(loops: unknown): string[] {
  const ids = new Set<string>();
  for (const m of sanitizeLoops(loops)) for (const l of m.layers) ids.add(l.id);
  return [...ids];
}

// ---------- leitura e escrita do áudio ----------

export async function readLayers(meta: LoopMeta): Promise<Layer[]> {
  const out: Layer[] = [];
  for (const l of meta.layers) {
    const blob = await getFile(l.id);
    if (!blob) throw new Error('O áudio deste loop não foi encontrado neste aparelho.');
    const pcm = decodeWav(await blob.arrayBuffer());
    if (!pcm) throw new Error('O áudio deste loop está corrompido.');
    const samples = pcm.sampleRate === meta.sampleRate ? pcm.samples : resample(pcm.samples, pcm.sampleRate, meta.sampleRate);
    out.push({ samples, vol: l.vol, mute: l.mute });
  }
  return out;
}

/** Grava as camadas como arquivos novos e devolve os dados da biblioteca. Não altera nada já salvo. */
export async function writeLoop(base: Omit<LoopMeta, 'layers' | 'updatedAt' | 'createdAt' | 'samples'> & Partial<Pick<LoopMeta, 'createdAt'>>, layers: Layer[]): Promise<LoopMeta> {
  if (!layers.length) throw new Error('Nenhuma camada para salvar.');
  const samples = layers[0].samples.length;
  if (layers.some((l) => l.samples.length !== samples)) throw new Error('As camadas têm tamanhos diferentes.');
  const written: string[] = [];
  try {
    const out: LoopLayer[] = [];
    for (const l of layers) {
      const id = newLayerFileId();
      await putFile(id, encodeWav(l.samples, base.sampleRate));
      written.push(id);
      out.push({ id, vol: l.vol, mute: l.mute });
    }
    const now = Date.now();
    return { ...base, samples, layers: out, createdAt: base.createdAt ?? now, updatedAt: now };
  } catch (e) {
    await Promise.all(written.map((id) => delFile(id).catch(() => {}))); // não deixa arquivos órfãos se faltar espaço
    throw e;
  }
}

export async function deleteLoopFiles(meta: LoopMeta) {
  await Promise.all(meta.layers.map((l) => delFile(l.id).catch(() => {})));
}

export async function duplicateLoop(meta: LoopMeta, name: string): Promise<LoopMeta> {
  const layers = await readLayers(meta);
  const { layers: _l, samples: _s, updatedAt: _u, createdAt: _c, ...rest } = meta;
  void _l; void _s; void _u; void _c;
  return writeLoop({ ...rest, id: newLoopId(), name }, layers);
}

/** Mistura todas as camadas (com volume e mudo) em um único áudio. */
export async function mixdown(meta: LoopMeta): Promise<Float32Array> {
  return mixLayers(await readLayers(meta));
}

// ---------- juntar loops ----------

export const SAME_BPM_TOLERANCE = 0.5;

export function mergeProblem(metas: LoopMeta[]): string | null {
  if (metas.length < 2) return 'Escolha pelo menos 2 loops.';
  if (metas.some((m) => m.kind !== 'loop')) return 'Só loops podem ser juntados (não gravações sobre bases).';
  if (metas.some((m) => Math.abs(m.bpm - metas[0].bpm) > SAME_BPM_TOLERANCE)) return 'Os loops têm andamentos diferentes. Para juntar, todos precisam ter o mesmo BPM.';
  return null;
}

async function mixedAt(meta: LoopMeta, rate: number): Promise<Float32Array> {
  const mixed = await mixdown(meta);
  return meta.sampleRate === rate ? mixed : resample(mixed, meta.sampleRate, rate);
}

/** Soma os loops (tocam juntos). Os mais curtos se repetem até o tamanho do mais longo. */
export async function stackLoops(metas: LoopMeta[], name: string): Promise<LoopMeta> {
  const problem = mergeProblem(metas);
  if (problem) throw new Error(problem);
  const rate = metas[0].sampleRate;
  const parts = await Promise.all(metas.map((m) => mixedAt(m, rate)));
  const mixed = mixLayers(parts.map((samples) => ({ samples, vol: 1, mute: false })));
  const longest = metas.reduce((a, m) => (m.samples / m.sampleRate > a.samples / a.sampleRate ? m : a), metas[0]);
  return writeLoop({ id: newLoopId(), name, kind: 'loop', bpm: metas[0].bpm, beats: metas[0].beats, bars: longest.bars, sampleRate: rate }, [{ samples: mixed, vol: 1, mute: false }]);
}

/** Une os loops em sequência (um depois do outro), formando uma seção maior. */
export async function chainLoops(metas: LoopMeta[], name: string): Promise<LoopMeta> {
  const problem = mergeProblem(metas);
  if (problem) throw new Error(problem);
  const rate = metas[0].sampleRate;
  const parts = await Promise.all(metas.map((m) => mixedAt(m, rate)));
  const joined = chain(parts);
  if (joined.length > rate * MAX_LOOP_SECONDS) throw new Error(`O resultado passaria de ${MAX_LOOP_SECONDS} segundos.`);
  const bars = metas.every((m) => m.bars > 0) ? metas.reduce((a, m) => a + m.bars, 0) : 0;
  return writeLoop({ id: newLoopId(), name, kind: 'loop', bpm: metas[0].bpm, beats: metas[0].beats, bars, sampleRate: rate }, [{ samples: joined, vol: 1, mute: false }]);
}
