import { useCallback, useMemo, useState } from 'react';
import { BackingPlayer, type PlayerState } from './BackingPlayer';
import { DEFAULT_BOARD, ScaleBoard, type BoardState } from './ScaleBoard';
import { Chips, Field, Toggle } from './ui';
import { PROGRESSIONS, progById, progressionTimeline } from '../lib/jam';
import { pcLabel } from '../lib/music';
import { useLocalStorage, useSettings } from '../lib/storage';

interface JamState {
  progId: string;
  keyPc: number;
  overlay: boolean;
}

const DEFAULT_JAM: JamState = { progId: 'blues-minor', keyPc: 9, overlay: true };

export function JamPanel() {
  const { settings } = useSettings();
  const [st, setSt] = useLocalStorage<JamState>('ss.jam', DEFAULT_JAM);
  const prog = progById(st.progId);
  const [board, setBoardRaw] = useState<BoardState>({ ...DEFAULT_BOARD, root: st.keyPc, scaleId: prog.scales[0], fretMax: 15, label: 'note' });
  const [player, setPlayer] = useState<PlayerState>({ slot: null, shift: 0 });

  const slots = useMemo(() => progressionTimeline(prog, st.keyPc, settings.pref), [prog, st.keyPc, settings.pref]);
  const boardRoot = (st.keyPc + player.shift + 120) % 12;

  const setBoard = useCallback(
    (p: Partial<BoardState>) => {
      if (p.root !== undefined) setSt((s) => ({ ...s, keyPc: (p.root! - player.shift + 120) % 12 }));
      setBoardRaw((b) => ({ ...b, ...p }));
    },
    [setSt, player.shift],
  );

  return (
    <div className="jam">
      <section className="panel">
        <Field label="Progressão">
          <select
            value={st.progId}
            onChange={(e) => {
              setSt((s) => ({ ...s, progId: e.target.value }));
              setBoardRaw((b) => ({ ...b, scaleId: progById(e.target.value).scales[0], pos: null }));
            }}
          >
            {PROGRESSIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.desc}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Tom (${prog.minor ? 'menor' : 'maior'})`}>
          <Chips small value={st.keyPc} onChange={(keyPc) => setSt((s) => ({ ...s, keyPc }))} options={Array.from({ length: 12 }, (_, pc) => ({ value: pc, label: pcLabel(pc, settings.pref, settings.lang) }))} />
        </Field>
      </section>

      <BackingPlayer slots={slots} defaultBpm={prog.bpm} defaultStyle={prog.style} pref={settings.pref} resetKey={prog.id} onState={setPlayer} />

      <section>
        <h3 className="section-title">Escalas para solar</h3>
        <Toggle label="Mostrar as notas do acorde atual no braço (âmbar)" checked={st.overlay} onChange={(overlay) => setSt((s) => ({ ...s, overlay }))} />
        <ScaleBoard state={{ ...board, root: boardRoot }} setState={setBoard} chordPcs={st.overlay && player.slot ? player.slot.pcs : undefined} scaleIds={prog.scales} advanced={false} />
      </section>
    </div>
  );
}
