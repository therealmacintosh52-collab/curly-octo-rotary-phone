'use client';
// Customer signature: canvas drawn with pointer events (finger or stylus), exported as PNG and stored as an image.
import { useCallback, useEffect, useRef, useState } from 'react';

export function SignaturePad({ onSave, disabled }: { onSave: (dataUrl: string) => Promise<string | null>; disabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const fit = useCallback(() => {
    const c = ref.current; if (!c) return;
    const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, r.width, r.height);
  }, []);
  useEffect(() => { fit(); }, [fit]);

  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: React.PointerEvent) => { if (disabled) return; ref.current!.setPointerCapture(e.pointerId); drawing.current = true; last.current = pos(e); };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext('2d')!; const p = pos(e); const l = last.current ?? p;
    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last.current = p; setEmpty(false);
  };
  const up = () => { drawing.current = false; last.current = null; };
  const clear = () => { fit(); setEmpty(true); setMsg(''); };
  const save = async () => {
    setBusy(true); setMsg('');
    const err = await onSave(ref.current!.toDataURL('image/png'));
    setBusy(false); setMsg(err ?? 'Signature saved.');
  };

  return (
    <div className="space-y-3">
      <canvas
        ref={ref} role="img" aria-label="Signature area. Draw with a finger or stylus. Signing is optional."
        className="h-40 w-full rounded-xl border border-line bg-white" style={{ touchAction: 'none' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
      />
      <div className="flex gap-2">
        <button type="button" className="adm-btn adm-btn-line flex-1" onClick={clear} disabled={empty || busy}>Clear</button>
        <button type="button" className="adm-btn adm-btn-gold flex-1" onClick={save} disabled={empty || busy || disabled}>{busy ? 'Saving…' : 'Save signature'}</button>
      </div>
      {msg && <p role="status" className="text-sm text-[#b9bcc3]">{msg}</p>}
    </div>
  );
}
