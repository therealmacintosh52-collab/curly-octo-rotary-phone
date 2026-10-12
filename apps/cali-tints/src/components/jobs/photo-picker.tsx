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
  kind: "photo" | "before" | "after";
  blob: Blob;
  name: string;
}

export const MAX_PHOTOS = 8;

/** Compress on-device: ~0.4 MB / 1600px JPEG is plenty for a damage record and uploads fast on weak signal. */
export async function compressPhoto(file: Blob): Promise<Blob> {
  const { default: imageCompression } = await import("browser-image-compression");
  const asFile = file instanceof File ? file : new File([file], "photo.jpg", { type: file.type || "image/jpeg" });
  return imageCompression(asFile, { maxSizeMB: 0.4, maxWidthOrHeight: 1600, useWebWorker: true, fileType: "image/jpeg", initialQuality: 0.82 });
}

/**
 * Optional photos of the car. One button opens the camera (the device's
 * camera app through the file input, or the in-app camera where the file
 * input cannot: the Clover Flex) and keeps up to eight compressed JPEGs.
 */
export function PhotoPicker({ photos, onChange, disabled }: { photos: PendingPhoto[]; onChange: (p: PendingPhoto[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMounted, setCameraMounted] = useState(false);
  const [nativeCapture, setNativeCapture] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setNativeCapture(hasNativeFileCapture()), 0);
    return () => clearTimeout(t);
  }, []);
  const full = photos.length >= MAX_PHOTOS;

  async function addBlob(blob: Blob, name: string) {
    setBusy(true);
    try {
      onChange([...photos, { id: crypto.randomUUID(), kind: "photo", blob: await compressPhoto(blob), name }]);
    } catch {
      toast.error("Could not process that photo");
    } finally {
      setBusy(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const next = [...photos];
      for (const file of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) next.push({ id: crypto.randomUUID(), kind: "photo", blob: await compressPhoto(file), name: file.name });
      onChange(next);
    } catch {
      toast.error("Could not process that photo");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function openCamera() {
    if (nativeCapture) inputRef.current?.click();
    else {
      setCameraMounted(true);
      setCameraOpen(true);
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="photo-picker">
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={disabled || busy || full}
          onClick={openCamera}
          data-testid="photo-add"
          className={cn(
            "flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60",
          )}
        >
          {busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : <CameraIcon className="size-4" />}
          {photos.length === 0 ? "Take a photo" : "Add a photo"}
          {photos.length > 0 && <span className="rounded-full bg-primary/15 px-1.5 text-xs text-primary">{photos.length}</span>}
        </button>
        {!nativeCapture && (
          <button
            type="button"
            disabled={disabled || busy || full}
            onClick={() => inputRef.current?.click()}
            aria-label="Choose photos from files"
            title="Choose from files"
            className="flex h-14 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60"
          >
            <ImageIcon className="size-4" />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" aria-label="Photo file" onChange={(e) => onFiles(e.target.files)} />
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto" data-testid="photo-thumbs">
          {photos.map((p) => (
            <Thumb key={p.id} photo={p} onRemove={() => onChange(photos.filter((x) => x.id !== p.id))} />
          ))}
        </div>
      )}
      {cameraMounted && <CameraCapture open={cameraOpen} onOpenChange={setCameraOpen} title="Photo of the car" onCapture={(blob) => void addBlob(blob, "photo.jpg")} />}
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
