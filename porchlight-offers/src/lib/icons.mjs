/**
 * Inline SVG icon set — stroke-based, 24×24, inherits currentColor.
 *
 * Inline rather than a sprite or an icon font: no extra request, no FOUC, and
 * they can be recoloured per section. Keep every path on a 24×24 grid with a
 * 1.7 stroke so the set stays visually consistent.
 */
const P = {
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  phone:
    '<path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  cash:
    '<rect x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  home: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5v11h13v-11"/><path d="M10 20.5v-5h4v5"/>',
  hammer:
    '<path d="M14.5 6.5 18 3l3 3-3.5 3.5"/><path d="m13 8 3 3"/><path d="m14.5 9.5-8 8a2.1 2.1 0 0 1-3-3l8-8Z"/><path d="M9.5 4.5 15 10"/>',
  key: '<circle cx="8" cy="8" r="4.5"/><path d="m11.2 11.2 8.3 8.3M16 16l2-2M18.5 18.5l1.5-1.5"/>',
  shield: '<path d="M12 3.5 5 6v6c0 4.2 3 7.3 7 8.5 4-1.2 7-4.3 7-8.5V6Z"/><path d="m9 12 2 2 4-4"/>',
  doc: '<path d="M6 3.5h7l5 5v12a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20.5v-15A2 2 0 0 1 6 3.5Z"/><path d="M13 3.5v5h5M8.5 13h7M8.5 16.5h5"/>',
  users:
    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c2 .8 3.3 2.5 3.6 5.2"/>',
  scales:
    '<path d="M12 3.5v17M6 20.5h12M4 8.5h16M8 8.5 5 15h6ZM16 8.5 13 15h6Z"/>',
  truck:
    '<path d="M2.5 6.5h11v10h-11z"/><path d="M13.5 10h4l3 3v3.5h-7z"/><circle cx="7" cy="18.5" r="1.8"/><circle cx="17" cy="18.5" r="1.8"/>',
  alert:
    '<path d="M12 4 2.8 20h18.4Z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  boarded:
    '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5v11h13v-11"/><path d="m7 12 10 6M17 12 7 18"/>',
  pin: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  star: '<path d="m12 3.8 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9Z"/>',
  arrow: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
  spark: '<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.5l-1.8-5.8L4.5 10.8 10.2 9Z"/><path d="M19 3.5v3M20.5 5h-3"/>',
  handshake:
    '<path d="M2.5 12.5 6 9l3.5 1.5L13 8l4.5 4.5"/><path d="m8.5 15 2.5 2.5 2-2 2 2 2-2"/><path d="M21.5 11.5 18 8M2.5 12.5 6 16"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2"/>',
  chart:
    '<path d="M3.5 20.5h17"/><path d="M6.5 17V11M11 17V5.5M15.5 17v-8M20 17v-4"/>',
  wallet:
    '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16.5 14.5h1.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>',
};

export const icon = (name, cls = 'icon') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || P.spark}</svg>`;

/** Which icon fronts each situation page. */
export const situationIcon = {
  'inherited-house': 'doc',
  foreclosure: 'alert',
  'house-needs-repairs': 'hammer',
  'tired-landlord': 'key',
  divorce: 'scales',
  relocating: 'truck',
  downsizing: 'sun',
  'vacant-house': 'boarded',
};

export const iconNames = Object.keys(P);
