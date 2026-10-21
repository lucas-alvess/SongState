import type { ReactNode } from 'react';

const PATHS: Record<string, ReactNode> = {
  fretboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M8 6v12M13 6v12M18 6v12M2.5 10h19M2.5 14h19" />
    </>
  ),
  book: <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" />
    </>
  ),
  chord: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="1.5" />
      <path d="M9.5 3v18M14.5 3v18M4.5 9h15M4.5 15h15" />
      <circle cx="9.5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="14.5" cy="18" r="1.6" fill="currentColor" />
    </>
  ),
  wheel: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v5.8M12 15.2V21M3 12h5.8M15.2 12H21M5.6 5.6l4.1 4.1M14.3 14.3l4.1 4.1M18.4 5.6l-4.1 4.1M9.7 14.3l-4.1 4.1" />
    </>
  ),
  headphones: (
    <>
      <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
      <rect x="3" y="14" width="4" height="7" rx="1.5" />
      <rect x="17" y="14" width="4" height="7" rx="1.5" />
    </>
  ),
  sliders: <path d="M4 7h9M17 7h3M4 17h3M11 17h9M13 4v6M7 14v6" />,
  play: <path d="M7 4.5v15l12-7.5z" fill="currentColor" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  music: (
    <>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  volume: <path d="M4 9.5v5h4l5 4v-13l-5 4zM16.5 9a4 4 0 0 1 0 6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  ear: <path d="M7 10a5 5 0 0 1 10 0c0 3-3 3.5-3 6a3 3 0 0 1-5.5 1.5M10 10a2 2 0 0 1 4 0" />,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/** Gradientes compartilhados pelos braços (referenciados no CSS via url(#id)). */
export function GlobalDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="g-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#241833" />
          <stop offset="0.5" stopColor="#1a1126" />
          <stop offset="1" stopColor="#120b1c" />
        </linearGradient>
        <linearGradient id="g-string" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f2ff" />
          <stop offset="1" stopColor="#8f8fb8" />
        </linearGradient>
        <radialGradient id="g-root" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ff8cc6" />
          <stop offset="1" stopColor="#d6246e" />
        </radialGradient>
        <radialGradient id="g-scale" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#8aa4ff" />
          <stop offset="1" stopColor="#4b5ee0" />
        </radialGradient>
        <radialGradient id="g-chord" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffd86b" />
          <stop offset="1" stopColor="#e08a06" />
        </radialGradient>
        <radialGradient id="g-ok" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#059669" />
        </radialGradient>
        <radialGradient id="g-bad" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fda4af" />
          <stop offset="1" stopColor="#e11d48" />
        </radialGradient>
      </defs>
    </svg>
  );
}
