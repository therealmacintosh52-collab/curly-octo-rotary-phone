"use client";

import { useEffect, useRef, useState } from "react";
import { CameraIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface PendingPhoto {
  id: string;
  kind: "before" | "after";
  blob: Blob;
  name: string;
}

/** Compress on-device: ~0.4 MB / 1600px JPEG is plenty for a damage record and uploads fast on weak signal. */
async function compress(file: File): Promise<Blob> {
  const { default: imageCompression } = await import("browser-image-compression");
  return imageCompression(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1600, useWebWorker: true, fileType: "image/jpeg", initialQuality: 0.82 });
}

export function PhotoPicker({ photos, onChange, disabled }: { photos: PendingPhoto[]; onChange: (p: PendingPhoto[]) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {(["before", "after"] as const).map((kind) => (
        <PhotoSlot key={kind} kind={kind} photos={photos.filter((p) => p.kind === kind)} onAdd={(p) => onChange([...photos, p])} onRemove={(id) => onChange(photos.filter((p) => p.id !== id))} disabled={disabled} />
      ))}
    </div>
  );
}

function PhotoSlot({
  kind,
  photos,
  onAdd,
  onRemove,
  disabled,
}: {
  kind: "before" | "after";
  photos: PendingPhoto[];
  onAdd: (p: PendingPhoto) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files).slice(0, 4)) {
        const blob = await compress(file);
        onAdd({ id: crypto.randomUUID(), kind, blob, name: file.name });
      }
    } catch {
      toast.error("Could not process that photo");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex h-14 items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60",
        )}
      >
        {busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : <CameraIcon className="size-4" />}
        {kind === "before" ? "Before" : "After"}
        {photos.length > 0 && <span className="rounded-full bg-primary/15 px-1.5 text-xs text-primary">{photos.length}</span>}
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((p) => (
            <Thumb key={p.id} photo={p} onRemove={() => onRemove(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({ photo, onRemove }: { photo: PendingPhoto; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(photo.blob);
    const t = setTimeout(() => setUrl(u), 0);
    return () => {
      clearTimeout(t);
      URL.revokeObjectURL(u);
    };
  }, [photo.blob]);
  return (
    <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" className="size-full object-cover" />}
      <button type="button" onClick={onRemove} aria-label="Remove photo" className="absolute top-0.5 right-0.5 rounded-full bg-black/70 p-0.5 text-white">
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}
