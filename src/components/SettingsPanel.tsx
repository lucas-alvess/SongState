import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { Chips, Field, Toggle } from './ui';
import { InstallApp } from './InstallApp';
import { Integrations } from './Integrations';
import { TUNINGS } from '../lib/music';
import { useSettings } from '../lib/storage';
import { useSheet } from '../lib/useSheet';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, update } = useSettings();
  const ref = useSheet<HTMLDivElement>(onClose);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label="Configurações" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Configurações</h2>
          <button type="button" className="btn icon" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <Field label="Nomes das notas">
          <Chips
            value={settings.lang}
            onChange={(lang) => update({ lang })}
            options={[
              { value: 'letters', label: 'C D E F G A B' },
              { value: 'latin', label: 'Dó Ré Mi Fá Sol Lá Si' },
            ]}
          />
        </Field>
        <Field label="Acidentes">
          <Chips
            value={settings.pref}
            onChange={(pref) => update({ pref })}
            options={[
              { value: 'sharp', label: 'Sustenidos ♯' },
              { value: 'flat', label: 'Bemóis ♭' },
            ]}
          />
        </Field>
        <Field label="Afinação">
          <select value={settings.tuningId} onChange={(e) => update({ tuningId: e.target.value })}>
            {TUNINGS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Orientação do braço">
          <Chips
            value={settings.orientation}
            onChange={(orientation) => update({ orientation })}
            options={[
              { value: 'auto', label: 'Automática' },
              { value: 'h', label: 'Horizontal' },
              { value: 'v', label: 'Vertical' },
            ]}
          />
        </Field>
        <Toggle label="Modo canhoto" checked={settings.leftHanded} onChange={(leftHanded) => update({ leftHanded })} />
        <h3 className="section-title">Aplicativo</h3>
        <InstallApp />
        <h3 className="section-title">Spotify e YouTube</h3>
        <Integrations />
        <h3 className="section-title">Ferramentas</h3>
        <Link to="/afinador" className="btn" onClick={onClose}>
          <Icon name="ear" size={16} /> Afinador
        </Link>
        <h3 className="section-title">Seus dados</h3>
        <Link to="/dados" className="btn" onClick={onClose}>
          <Icon name="download" size={16} /> Backup e armazenamento
        </Link>
        <p className="muted small-text">Tudo é salvo neste navegador. Músicas e arquivos de áudio não saem do seu dispositivo.</p>
      </div>
    </div>
  );
}
