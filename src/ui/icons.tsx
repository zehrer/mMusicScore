/** Small line icons (20 px, current color) for the toggle buttons. */

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg className="icon" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

/** Lyrics: a microphone. */
export const LyricsIcon = () => (
  <Svg>
    <rect x="7" y="2.5" width="6" height="10" rx="3" />
    <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5M7 17.5h6" />
  </Svg>
);

/** Note names: a note with a letter above it. */
export const NamesIcon = () => (
  <Svg>
    <path d="M2.5 9 5 2.5 7.5 9M3.4 6.8h3.2" />
    <ellipse cx="11.5" cy="15.5" rx="2.6" ry="2" fill="currentColor" stroke="none" transform="rotate(-20 11.5 15.5)" />
    <path d="M13.9 14.8V5.5l3.6 1.6" />
  </Svg>
);

/** Piano: a small keyboard. */
export const PianoIcon = () => (
  <Svg>
    <rect x="2" y="4" width="16" height="12" rx="1.5" />
    <path d="M6 4v12M10 4v12M14 4v12" strokeWidth="1.2" />
    <path d="M6 4v6.5M10 4v6.5M14 4v6.5" strokeWidth="3.2" strokeLinecap="butt" />
  </Svg>
);
