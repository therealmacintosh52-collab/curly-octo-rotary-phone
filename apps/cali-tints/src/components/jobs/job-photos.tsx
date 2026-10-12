"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CameraIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { addPhotosAction, deletePhotoAction } from "@/app/(app)/jobs/actions";
import { useSession } from "@/components/app/session-provider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PhotoPicker, type PendingPhoto } from "./photo-picker";

export interface JobPhoto {
  id: string;
  kind: "photo" | "before" | "after";
  url: string | null;
  created_at: string;
}

/** The job's before/after photos: a grid, a lightbox, Add photos and Remove while the job is open. */
export function JobPhotos({ photos, jobId, canEdit }: { photos: JobPhoto[]; jobId: string; canEdit: boolean }) {
  const router = useRouter();
  const { demo } = useSession();
  const [open, setOpen] = useState<JobPhoto | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [busy, start] = useTransition();

  function save() {
    start(async () => {
      if (demo) {
        toast.success(`${pending.length} ${pending.length === 1 ? "photo" : "photos"} added`, { description: "Guest preview — nothing changed" });
        setAdding(false);
        setPending([]);
        return;
      }
      const form = new FormData();
      for (const p of pending) form.append("photo", new File([p.blob], p.name || "photo.jpg", { type: "image/jpeg" }));
      const r = await addPhotosAction(jobId, form);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${r.data} ${r.data === 1 ? "photo" : "photos"} added`);
      setAdding(false);
      setPending([]);
      router.refresh();
    });
  }

  return (
    <>
      {photos.length === 0 ? <p className="text-sm text-muted-foreground">No photos yet.</p> : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="job-photo-grid">
          {photos.map((p) => (
            <button key={p.id} type="button" onClick={() => setOpen(p)} aria-label="Open photo" className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.url && <img src={p.url} alt="Photo of the car" className="size-full object-cover transition-transform group-hover:scale-105" loading="lazy" />}
            </button>
          ))}
        </div>
      )}
      {canEdit && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setAdding(true)} data-testid="add-photos">
          <CameraIcon /> Add photos
        </Button>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {open?.url && <img src={open.url} alt="" className="max-h-[80vh] w-full rounded-lg object-contain" data-testid="lightbox-photo" />}
          {canEdit && open && (
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              className="absolute bottom-4 left-4"
              onClick={() =>
                start(async () => {
                  if (demo) {
                    toast.success("Photo removed", { description: "Guest preview — nothing changed" });
                    setOpen(null);
                    return;
                  }
                  const r = await deletePhotoAction(open.id, jobId);
                  if (!r.ok) toast.error(r.error);
                  else {
                    toast.success("Photo removed");
                    setOpen(null);
                    router.refresh();
                  }
                })
              }
            >
              <Trash2Icon /> Remove
            </Button>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={adding} onOpenChange={(o) => { if (!o) { setAdding(false); setPending([]); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add photos</DialogTitle>
            <DialogDescription>From the camera, up to eight. Optional.</DialogDescription>
          </DialogHeader>
          <PhotoPicker photos={pending} onChange={setPending} disabled={busy} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setAdding(false); setPending([]); }}>
              Cancel
            </Button>
            <Button disabled={busy || pending.length === 0} onClick={save}>
              {busy ? "Saving…" : `Save ${pending.length || ""} ${pending.length === 1 ? "photo" : "photos"}`.replace("  ", " ")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
