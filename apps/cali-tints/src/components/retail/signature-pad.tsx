"use client";

import { useEffect, useRef, useState } from "react";
import { EraserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A finger-or-mouse signature on a canvas. Pointer events cover touch, pen
 * and mouse; `touch-action: none` stops the page from scrolling under the
 * finger on iOS. The PNG is produced on demand (transparent background,
 * device-pixel sharp) and never leaves the page until the caller uploads it.
 */
export function SignaturePad({ onChange, height = 160, label = "Sign here" }: { onChange: (hasInk: boolean) => void; height?: number; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const hasInkRef = useRef(false);

  // Size the bitmap to the element at device resolution, once the layout settles.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width === w && canvas.height === h) return;
      // Resizing clears the bitmap; keep what was drawn.
      const keep = hasInkRef.current ? canvas.toDataURL("image/png") : null;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "#111111";
      if (keep) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = keep;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx || !last.current) return;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = "#111111";
    ctx.fill();
    mark();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    e.preventDefault();
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }

  function up(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    last.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
  }

  function mark() {
    if (hasInkRef.current) return;
    hasInkRef.current = true;
    setHasInk(true);
    onChange(true);
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    hasInkRef.current = false;
    setHasInk(false);
    onChange(false);
  }

  return (
    <div className="grid gap-2" data-testid="signature-pad">
      <div className="relative overflow-hidden rounded-xl border border-border bg-white" style={{ height }}>
        <canvas
          ref={canvasRef}
          aria-label={label}
          role="img"
          className="block size-full cursor-crosshair"
          style={{ touchAction: "none" }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
        />
        {!hasInk && <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm text-neutral-400">{label}</span>}
        <span className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-dashed border-neutral-300" />
      </div>
      <div className="flex items-center justify-between text-caption text-subtle">
        <span>Use your finger or the mouse.</span>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!hasInk} data-testid="signature-clear">
          <EraserIcon /> Clear
        </Button>
      </div>
    </div>
  );
}

/** The drawn signature as a PNG blob, or null when the pad is blank. */
export async function signatureBlob(pad: HTMLElement | null): Promise<Blob | null> {
  const canvas = pad?.querySelector("canvas");
  if (!canvas) return null;
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
