"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { CameraIcon, ImageIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { hasNativeFileCapture } from "@/lib/camera";

// The in-app camera (getUserMedia) loads only when it is first opened.
const CameraCapture = dynamic(() => import("./camera-capture").then((m) => m.CameraCapture), { ssr: false });

export interface PendingPhoto {
  /** Device-side id; also the photo's client_id on the server so a retried upload never duplicates it. */
  id: string;
  kind: "before" | "after";
  blob: Blob;
  name: string;
}

export const MAX_PHOTOS_PER_KIND = 4;

/** Compress on-device: ~0.4 MB / 1600px JPEG is plenty for a damage record and uploads fast on weak signal. */
export async function compressPhoto(file: Blob): Promise<Blob> {
  const { default: imageCompression } = await import("browser-image-compression");
  const asFile = file instanceof File ? file : new File([file], "photo.jpg", { type: file.type || "image/jpeg" });
  return imageCompression(asFile, { maxSizeMB: 0.4, maxWidthOrHeight: 1600, useWebWorker: true, fileType: "image/jpeg", initialQuality: 0.82 });
}

/**
 * Before / After photos for a job. Each slot opens the camera (the device's
 * camera app through the file input, or the in-app camera where the file
 * input cannot: the Clover Flex) and keeps up to four compressed JPEGs.
 */
export function PhotoPicker({ photos, onChange, disabled }: { photos: PendingPhoto[]; onChange: (p: PendingPhoto[]) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2.5" data-testid="photo-picker">
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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMounted, setCameraMounted] = useState(false);
  const [nativeCapture, setNativeCapture] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setNativeCapture(hasNativeFileCapture()), 0);
    return () => clearTimeout(t);
  }, []);
  const full = photos.length >= MAX_PHOTOS_PER_KIND;
  const label = kind === "before" ? "Before" : "After";

  async function addBlob(blob: Blob, name: string) {
    setBusy(true);
    try {
      onAdd({ id: crypto.randomUUID(), kind, blob: await compressPhoto(blob), name });
    } catch {
      toast.error("Could not process that photo");
    } finally {
      setBusy(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files).slice(0, MAX_PHOTOS_PER_KIND - photos.length)) await addBlob(file, file.name);
    if (inputRef.current) inputRef.current.value = "";
  }

  function openCamera() {
    if (nativeCapture) inputRef.current?.click();
    else {
      setCameraMounted(true);
      setCameraOpen(true);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={disabled || busy || full}
          onClick={openCamera}
          aria-label={`${label} photo`}
          data-testid={`photo-${kind}`}
          className={cn(
            "flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60",
          )}
        >
          {busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : <CameraIcon className="size-4" />}
          {label}
          {photos.length > 0 && <span className="rounded-full bg-primary/15 px-1.5 text-xs text-primary">{photos.length}</span>}
        </button>
        {!nativeCapture && (
          <button
            type="button"
            disabled={disabled || busy || full}
            onClick={() => inputRef.current?.click()}
            aria-label={kind === "before" ? "Choose a before photo from files" : "Choose an after photo from files"}
            title="Choose a file"
            className="flex h-14 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60"
          >
            <ImageIcon className="size-4" />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" aria-label={`${label} photo file`} onChange={(e) => onFiles(e.target.files)} />
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto" data-testid={`photo-${kind}-thumbs`}>
          {photos.map((p) => (
            <Thumb key={p.id} photo={p} onRemove={() => onRemove(p.id)} />
          ))}
        </div>
      )}
      {cameraMounted && <CameraCapture open={cameraOpen} onOpenChange={setCameraOpen} title={`${label} photo`} onCapture={(blob) => void addBlob(blob, `${kind}.jpg`)} />}
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
