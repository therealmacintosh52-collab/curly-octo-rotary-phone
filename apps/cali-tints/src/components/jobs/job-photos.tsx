"use client";

import { useState, useTransition } from "react";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deletePhotoAction } from "@/app/(app)/jobs/actions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Photo {
  id: string;
  kind: "before" | "after";
  url: string | null;
  created_at: string;
}

export function JobPhotos({ photos, jobId, canEdit }: { photos: Photo[]; jobId: string; canEdit: boolean }) {
  const [open, setOpen] = useState<Photo | null>(null);
  const [pending, start] = useTransition();

  if (photos.length === 0) return <p className="text-sm text-muted-foreground">No photos.</p>;

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((p) => (
          <button key={p.id} type="button" onClick={() => setOpen(p)} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.url && <img src={p.url} alt={`${p.kind} photo`} className="size-full object-cover transition-transform group-hover:scale-105" loading="lazy" />}
            <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">{p.kind}</span>
          </button>
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {open?.url && <img src={open.url} alt="" className="max-h-[80vh] w-full rounded-lg object-contain" />}
          {canEdit && open && (
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              className="absolute bottom-4 left-4"
              onClick={() =>
                start(async () => {
                  const r = await deletePhotoAction(open.id, jobId);
                  if (!r.ok) toast.error(r.error);
                  else {
                    toast.success("Photo removed");
                    setOpen(null);
                  }
                })
              }
            >
              <Trash2Icon /> Remove
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
