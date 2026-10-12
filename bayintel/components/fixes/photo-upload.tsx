"use client";
import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { publicMediaUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";

export interface UploadedMedia {
  storage_path: string;
  caption: string | null;
}

/** Uploads photos straight from the phone camera into the given bucket under the user's folder. */
export function PhotoUpload({ bucket, value, onChange, max = 8 }: { bucket: "fix-media" | "ro-media"; value: UploadedMedia[]; onChange: (v: UploadedMedia[]) => void; max?: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sign in required");
      setBusy(false);
      return;
    }
    const next = [...value];
    for (const file of Array.from(files).slice(0, max - value.length)) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is over 10 MB`);
        continue;
      }
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
      if (error) {
        setError(error.message);
        continue;
      }
      next.push({ storage_path: path, caption: null });
    }
    onChange(next);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      {value.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((m) => (
            <li key={m.storage_path} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
              {bucket === "fix-media" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={publicMediaUrl(bucket, m.storage_path)} alt={m.caption ?? "Fix photo"} className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-xs text-muted-foreground">Photo</div>
              )}
              <button
                type="button"
                aria-label="Remove photo"
                className="absolute right-1 top-1 rounded-full bg-black/70 p-1.5 text-white"
                onClick={() => onChange(value.filter((x) => x.storage_path !== m.storage_path))}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" className="w-full" disabled={busy || value.length >= max} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="animate-spin" /> : <Camera />} {value.length ? "Add more photos" : "Add photos"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
