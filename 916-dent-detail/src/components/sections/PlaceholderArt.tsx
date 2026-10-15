/* Placeholder visuals for the before/after sliders. Pure SVG, no image requests.
   Every panel is stamped [REPLACE WITH REAL JOB PHOTOS] — these are illustrations, not results. */

type Variant = 'dent' | 'swirl' | 'interior';

const reflections = (bend: boolean, id: string) =>
  [0, 1, 2, 3, 4].map((i) => {
    const y = 70 + i * 48;
    // a dent bends the reflection lines around the impact point (x≈205, y≈170)
    const d = bend && Math.abs(y - 170) < 110
      ? `M-10 ${y} C 120 ${y - 6}, 160 ${y + (y < 170 ? -26 : 26)}, 205 ${y + (y < 170 ? 18 : -18)} S 290 ${y - 4}, 420 ${y + 6}`
      : `M-10 ${y} C 120 ${y - 8}, 260 ${y + 8}, 420 ${y - 4}`;
    return <path key={i} d={d} stroke={`url(#refl-${id})`} strokeWidth={i === 2 ? 5 : 3} fill="none" opacity={0.75 - i * 0.08} />;
  });

export function PanelArt({ variant, state }: { variant: Variant; state: 'before' | 'after' }) {
  const before = state === 'before';
  const uid = `${variant}-${state}`;
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`refl-${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor="#3b5b9a" stopOpacity="0" />
          <stop offset="0.5" stopColor={before ? '#6f86b8' : '#a9c4ff'} />
          <stop offset="1" stopColor="#3b5b9a" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`bg-${uid}`} cx="40%" cy="35%" r="80%">
          <stop offset="0" stopColor={variant === 'interior' ? (before ? '#2a2723' : '#3a3229') : before ? '#121a2c' : '#16244a'} />
          <stop offset="1" stopColor="#07080b" />
        </radialGradient>
        <radialGradient id={`shade-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#000" stopOpacity="0.75" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#bg-${uid})`} />
      {variant === 'dent' && (
        <>
          {reflections(before, uid)}
          {before && <ellipse cx="205" cy="170" rx="70" ry="48" fill={`url(#shade-${uid})`} />}
        </>
      )}
      {variant === 'swirl' && (
        <>
          {reflections(false, uid)}
          {before &&
            [18, 30, 44, 60, 78, 98].map((r, i) => (
              <circle key={r} cx={150 + (i % 2) * 90} cy="150" r={r} fill="none" stroke="#9fb0d6" strokeOpacity="0.22" strokeWidth="1" strokeDasharray="6 5" />
            ))}
          {!before && <path d="M40 60 L360 30" stroke="#dce7ff" strokeOpacity="0.6" strokeWidth="2" />}
        </>
      )}
      {variant === 'interior' && (
        <>
          <rect x="70" y="70" width="140" height="180" rx="28" fill={before ? '#3a352f' : '#4a3d2e'} />
          <rect x="220" y="110" width="120" height="140" rx="24" fill={before ? '#35302b' : '#46392b'} />
          {before && [[110, 120], [150, 190], [260, 160], [290, 220], [120, 220]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="9" fill="#1d1a16" opacity="0.8" />)}
          {!before && <path d="M80 90 Q140 80 200 92" stroke="#e8cb7a" strokeOpacity="0.35" strokeWidth="3" fill="none" />}
        </>
      )}
      <g>
        <rect x="56" y="262" width="288" height="24" rx="6" fill="#0b0b0c" fillOpacity="0.8" />
        <text x="200" y="279" textAnchor="middle" fill="#e8cb7a" fontSize="11" fontFamily="ui-sans-serif, system-ui, sans-serif" fontWeight="600" letterSpacing="0.5">
          [REPLACE WITH REAL JOB PHOTOS]
        </text>
      </g>
    </svg>
  );
}
