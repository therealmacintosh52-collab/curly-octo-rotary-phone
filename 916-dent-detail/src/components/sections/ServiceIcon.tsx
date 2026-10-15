import type { Service } from '@/content/home';

const paths: Record<Service['icon'], string> = {
  dent: 'M3 15c4 0 5-5 9-5s5 5 9 5M7 19h10',
  hail: 'M6 9a6 6 0 0112 0M8 14v2M12 13v3M16 14v2M10 18v2M14 18v2',
  swirl: 'M12 12a2 2 0 102-2 4 4 0 10-4 4 6 6 0 106-6',
  shield: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM9 12l2 2 4-4',
  clay: 'M4 16c3-6 13-6 16 0M7 12l2-6h6l2 6',
  seat: 'M8 4h6l1 9H8zM7 13h10l1 7H6z',
};

export function ServiceIcon({ name }: { name: Service['icon'] }) {
  return (
    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-gold-deep/60 text-gold" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={paths[name]} />
      </svg>
    </span>
  );
}
