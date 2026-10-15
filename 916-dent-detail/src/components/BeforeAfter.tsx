'use client';
import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

/*
  Drag/keyboard before-after slider.
  role="slider" on the handle; ←/→ ±5, PageUp/PageDown ±10, Home/End. Pointer drag anywhere on the image.
  touch-action: pan-y keeps vertical page scrolling working on phones.
*/
export function BeforeAfter({ label, before, after }: { label: string; before: ReactNode; after: ReactNode }) {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const fromClientX = useCallback((x: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.round(Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100))));
  }, []);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    fromClientX(e.clientX);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => dragging.current && fromClientX(e.clientX);
  const onUp = () => { dragging.current = false; };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -10, PageUp: 10 }[e.key];
    if (step !== undefined) { e.preventDefault(); setPos((p) => Math.min(100, Math.max(0, p + step))); }
    else if (e.key === 'Home') { e.preventDefault(); setPos(0); }
    else if (e.key === 'End') { e.preventDefault(); setPos(100); }
  };

  return (
    <div
      ref={box}
      className="relative aspect-[4/3] select-none overflow-hidden rounded-[20px] border border-line bg-graphite"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className="absolute inset-0">{after}</div>
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>{before}</div>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-onyx/80 px-3 py-1 text-xs font-semibold tracking-wide">Before</span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-gold px-3 py-1 text-xs font-semibold tracking-wide text-onyx">After</span>
      <div className="pointer-events-none absolute inset-y-0 w-px bg-gold-light/90" style={{ left: `${pos}%` }} />
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label}: before and after comparison`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pos}
        aria-valuetext={`${pos}% before shown`}
        aria-orientation="horizontal"
        onKeyDown={onKey}
        className="absolute top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-gold-light bg-onyx/85 text-gold-light shadow-lg backdrop-blur"
        style={{ left: `${pos}%` }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6" /></svg>
      </div>
    </div>
  );
}
