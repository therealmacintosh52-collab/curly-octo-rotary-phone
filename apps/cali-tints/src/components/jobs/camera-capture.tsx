"use client";

import { useEffect, useRef, useState } from "react";
import { CameraIcon, CheckIcon, FlashlightIcon, RotateCcwIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CAMERA_CONSTRAINTS, cameraErrorMessage, setTorch, torchSupported } from "@/lib/camera";

/**
 * In-app still camera: live preview → tap → JPEG. Used where the file input
 * cannot open the camera app (the Clover Flex WebView) and as a one-tap
 * shutter everywhere else. The stream lives only while the sheet is open.
 */
export function CameraCapture({ open, onOpenChange, title, onCapture }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; onCapture: (blob: Blob) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92dvh] gap-0 p-0">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <CameraIcon className="size-5 text-primary" /> {title}
          </SheetTitle>
          <SheetDescription>Frame the car, tap the shutter, then Use photo or Retake.</SheetDescription>
        </SheetHeader>
        {open && (
          <Viewfinder
            onUse={(blob) => {
              onCapture(blob);
              onOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Viewfinder({ onUse }: { onUse: (blob: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [torch, setTorchOn] = useState(false);
  const [canTorch, setCanTorch] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        const track = stream.getVideoTracks()[0] ?? null;
        trackRef.current = track;
        setCanTorch(torchSupported(track));
      } catch (err) {
        setError(cameraErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
    };
  }, []);

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  async function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    // Cap the long edge at 1600px: the same size the picker compresses to.
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) return setError("Could not read the picture from the camera.");
    setShot({ blob, url: URL.createObjectURL(blob) });
    navigator.vibrate?.(30);
  }

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    try {
      await setTorch(track, !torch);
      setTorchOn((t) => !t);
    } catch {
      setCanTorch(false);
    }
  }

  return (
    <div className="relative flex-1 overflow-hidden bg-black" data-testid="camera-capture">
      <video ref={videoRef} className={shot ? "hidden" : "size-full object-cover"} muted playsInline autoPlay />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {shot && <img src={shot.url} alt="Your photo" className="size-full object-contain" />}
      {error && <div className="absolute inset-x-4 top-4 rounded-lg border border-destructive/40 bg-background/95 p-3 text-sm">{error}</div>}
      <div className="pb-safe absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 p-4">
        {shot ? (
          <>
            <Button type="button" variant="secondary" size="lg" onClick={() => setShot(null)}>
              <RotateCcwIcon /> Retake
            </Button>
            <Button type="button" size="lg" className="glow-primary" onClick={() => onUse(shot.blob)}>
              <CheckIcon /> Use photo
            </Button>
          </>
        ) : (
          <>
            <Button type="button" size="lg" className="size-16 rounded-full p-0 glow-primary" aria-label="Take photo" onClick={snap} disabled={!!error}>
              <CameraIcon className="size-7" />
            </Button>
            {canTorch && (
              <Button type="button" size="icon" variant={torch ? "default" : "secondary"} onClick={toggleTorch} className="absolute right-4 bottom-6 rounded-full" aria-label="Toggle flashlight">
                <FlashlightIcon />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
