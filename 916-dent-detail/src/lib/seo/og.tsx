import { ImageResponse } from 'next/og';
import { site } from '@/config/site';

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = 'image/png';

/** Branded 1200x630 card: onyx, one gold hairline, title in ivory. No photos, no claims. */
export function renderOg({ eyebrow, title, footer }: { eyebrow: string; title: string; footer?: string }) {
  const size = title.length > 60 ? 54 : 64;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#0B0B0C', padding: '64px 72px', color: '#F3EEE3', fontFamily: 'sans-serif', backgroundImage: 'radial-gradient(ellipse at 20% 0%, rgba(201,162,74,0.22), rgba(11,11,12,0) 60%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, border: '3px solid #C9A24A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8CB7A', fontSize: 28, fontWeight: 700 }}>916</div>
          <div style={{ fontSize: 28, letterSpacing: 6, color: '#C9A24A', textTransform: 'uppercase' }}>{eyebrow}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: 120, height: 4, background: '#C9A24A', marginBottom: 32 }} />
          <div style={{ fontSize: size, lineHeight: 1.12, fontWeight: 700, maxWidth: 1000 }}>{title}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, color: '#8C8F96' }}>
          <div>{site.name}</div>
          <div>{footer ?? 'Mobile service across Greater Sacramento'}</div>
        </div>
      </div>
    ),
    { ...ogSize },
  );
}
