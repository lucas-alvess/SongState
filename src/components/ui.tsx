import type { ReactNode } from 'react';
import { SCALES, SCALE_GROUPS, pcLabel } from '../lib/music';
import { useSettings } from '../lib/storage';

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  small,
}: {
  options: { value: T; label: ReactNode }[];
  value: T | null;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <div className={`chips${small ? ' small' : ''}`}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" className={`chip${o.value === value ? ' active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" />
      <span>{label}</span>
    </label>
  );
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

export function ScaleSelect({ value, onChange, ids }: { value: string; onChange: (id: string) => void; ids?: string[] }) {
  const list = ids ? SCALES.filter((s) => ids.includes(s.id)) : SCALES;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {SCALE_GROUPS.map((g) => {
        const items = list.filter((s) => s.group === g);
        return items.length ? (
          <optgroup key={g} label={g}>
            {items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
    </select>
  );
}

export function RootChips({ value, onChange }: { value: number; onChange: (pc: number) => void }) {
  const { settings } = useSettings();
  return (
    <Chips
      small
      value={value}
      onChange={onChange}
      options={Array.from({ length: 12 }, (_, pc) => ({ value: pc, label: pcLabel(pc, settings.pref, settings.lang) }))}
    />
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children}
    </header>
  );
}
