// The question bank's subject illustrations: SATMAKON's own, drawn here.
// An open book with a pen for Reading and Writing; a compass over a
// triangle for Math. Decorative (aria-hidden), white and translucent so
// they sit on either card's gradient.

export function BookArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 160" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ba-page" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fde7f6" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="ba-pen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a1a6c" />
          <stop offset="1" stopColor="#d24fb7" />
        </linearGradient>
      </defs>
      <ellipse cx="112" cy="148" rx="86" ry="8" fill="#000" opacity="0.12" />
      {/* the open book, tilted */}
      <g transform="rotate(-8 110 90)">
        <path d="M30 40 Q70 28 108 42 L108 140 Q70 126 30 138 Z" fill="url(#ba-page)" />
        <path d="M186 40 Q148 28 110 42 L110 140 Q148 126 186 138 Z" fill="url(#ba-page)" />
        <path d="M108 42 L110 42 L110 140 L108 140 Z" fill="#c13ea4" opacity="0.5" />
        {/* lines of writing */}
        {[58, 72, 86, 100, 114].map((y, i) => (
          <path key={y} d={`M42 ${y} q10 -5 20 0 t20 0 t${i % 2 ? 14 : 20} 0`} fill="none" stroke="#c13ea4" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
        ))}
        {[58, 72, 86].map((y) => (
          <path key={y} d={`M124 ${y} h46`} stroke="#c13ea4" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
        ))}
      </g>
      {/* the pen */}
      <g transform="rotate(38 168 70)">
        <rect x="156" y="8" width="18" height="92" rx="9" fill="url(#ba-pen)" />
        <rect x="156" y="20" width="18" height="10" fill="#fff" opacity="0.35" />
        <path d="M156 100 L165 124 L174 100 Z" fill="#f9d3ec" />
        <path d="M162 116 L165 124 L168 116 Z" fill="#5b1150" />
      </g>
      <circle cx="44" cy="22" r="4" fill="#fff" opacity="0.7" />
      <circle cx="200" cy="120" r="3" fill="#fff" opacity="0.6" />
    </svg>
  );
}

export function CompassArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 160" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ca-tri" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#bfe3ff" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="ca-arm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b4fb3" />
          <stop offset="1" stopColor="#2f8df0" />
        </linearGradient>
      </defs>
      <ellipse cx="110" cy="148" rx="88" ry="8" fill="#000" opacity="0.12" />
      {/* a set square */}
      <path d="M40 140 L180 140 L180 40 Z" fill="url(#ca-tri)" />
      <path d="M78 128 L164 128 L164 66 Z" fill="#1f6fe0" opacity="0.25" />
      {[60, 80, 100, 120, 140, 160].map((x) => (
        <path key={x} d={`M${x} 140 v-8`} stroke="#1f6fe0" strokeOpacity="0.6" strokeWidth="2.5" strokeLinecap="round" />
      ))}
      {/* the arc the compass drew */}
      <path d="M60 110 A62 62 0 0 1 170 74" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" opacity="0.9" />
      {/* the compass */}
      <g transform="rotate(-14 112 40)">
        <circle cx="112" cy="22" r="9" fill="#fff" />
        <circle cx="112" cy="22" r="4" fill="#0b4fb3" />
        <path d="M108 28 L82 118 L88 120 L113 32 Z" fill="url(#ca-arm)" />
        <path d="M116 28 L146 116 L140 118 L111 32 Z" fill="url(#ca-arm)" />
        <path d="M82 118 L84 132 L88 120 Z" fill="#e8f3ff" />
        <path d="M146 116 L146 128 L140 118 Z" fill="#ffd166" />
      </g>
      {/* a sparkle */}
      <path d="M190 22 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" fill="#fff" opacity="0.95" />
      <circle cx="30" cy="40" r="3.5" fill="#fff" opacity="0.6" />
    </svg>
  );
}
