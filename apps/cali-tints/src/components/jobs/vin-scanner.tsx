"use client";

import { useEffect, useRef, useState } from "react";
import { FlashlightIcon, ScanLineIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { extractVin } from "@/lib/vin";
import { scanWithClover, stopCloverScan, useCloverBridge } from "@/lib/native/clover";
import { CAMERA_CONSTRAINTS, cameraErrorMessage, setTorch, torchSupported as torchOk } from "@/lib/camera";

/**
 * Camera VIN scanner (ZXing). Reads the Code 39 / Code 128 barcodes on door
 * jambs and windshields plus the QR / DataMatrix / PDF417 labels some cars
 * carry. The heavy decoder is loaded only when the sheet opens, and the
 * camera view is mounted fresh on every open so its state starts clean.
 */
export function VinScanner({ open, onOpenChange, onDetected }: { open: boolean; onOpenChange: (o: boolean) => void; onDetected: (vin: string) => void }) {
  const clover = useCloverBridge();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={clover ? "gap-0 p-0" : "h-[92dvh] gap-0 p-0"}>
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <ScanLineIcon className="size-5 text-primary" /> Scan VIN
          </SheetTitle>
          <SheetDescription>{clover ? "The Clover scanner opens on top. Aim at the door-jamb sticker or the windshield plate barcode." : "Point at the door-jamb sticker or the windshield plate barcode. Hold steady."}</SheetDescription>
        </SheetHeader>
        {open && clover && (
          <CloverScan
            onDetected={(vin) => {
              onDetected(vin);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
        {open && !clover && (
          <CameraView
            onDetected={(vin) => {
              onDetected(vin);
              onOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Inside the Clover app: the device's own scanner does the reading; this panel shows progress and retries. */
function CloverScan({ onDetected, onCancel }: { onDetected: (vin: string) => void; onCancel: () => void }) {
  const [state, setState] = useState<{ kind: "scanning" } | { kind: "error"; message: string }>({ kind: "scanning" });
  const [attempt, setAttempt] = useState(0);
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let alive = true;
    scanWithClover()
      .then((text) => {
        if (!alive) return;
        const vin = extractVin(text);
        if (vin) {
          navigator.vibrate?.(60);
          onDetectedRef.current(vin);
        } else setState({ kind: "error", message: `That barcode is not a VIN (${text.slice(0, 24)}). Try the sticker on the door jamb.` });
      })
      .catch((err: Error & { code?: string }) => {
        if (!alive) return;
        setState({ kind: "error", message: err.code === "cancelled" ? "Scan cancelled." : err.message });
      });
    return () => {
      alive = false;
      stopCloverScan();
    };
  }, [attempt]);

  return (
    <div className="flex flex-col items-center gap-4 px-6 pb-8 pt-4 text-center" data-testid="clover-scan">
      {state.kind === "scanning" ? (
        <>
          <ScanLineIcon className="size-10 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">Scanning with the Clover…</p>
        </>
      ) : (
        <>
          <p className="text-sm">{state.message}</p>
          <Button
            type="button"
            onClick={() => {
              setState({ kind: "scanning" });
              setAttempt((a) => a + 1);
            }}
          >
            Scan again
          </Button>
        </>
      )}
      <Button type="button" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function CameraView({ onDetected }: { onDetected: (vin: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const lastHitRef = useRef<{ vin: string; count: number }>({ vin: "", count: 0 });
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;

    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_128,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.PDF_417,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 400 });
        if (cancelled || !videoRef.current) return;

        const controls = await reader.decodeFromConstraints(
          CAMERA_CONSTRAINTS,
          videoRef.current,
          (result) => {
            if (!result) return;
            const vin = extractVin(result.getText());
            if (!vin) return;
            // Require the same VIN twice in a row to filter misreads on 1D codes.
            const last = lastHitRef.current;
            const count = last.vin === vin ? last.count + 1 : 1;
            lastHitRef.current = { vin, count };
            if (count >= 2) {
              if (navigator.vibrate) navigator.vibrate(60);
              onDetectedRef.current(vin);
            }
          },
        );
        stop = () => controls.stop();

        // Torch support (Android Chrome). iOS Safari does not expose it.
        const stream = videoRef.current.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks()[0] ?? null;
        trackRef.current = track;
        if (torchOk(track)) setTorchSupported(true);
      } catch (err) {
        setError(cameraErrorMessage(err));
      }
    })();

    return () => {
      cancelled = true;
      stop?.();
      trackRef.current = null;
    };
  }, []);

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    try {
      await setTorch(track, !torchOn);
      setTorchOn((t) => !t);
    } catch {
      setTorchSupported(false);
    }
  }

  return (
    <div className="relative flex-1 overflow-hidden bg-black">
      <video ref={videoRef} className="size-full object-cover" muted playsInline autoPlay />
      {/* Reticle */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-28 w-[88%] rounded-xl border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
          <div className="absolute inset-x-[8%] top-1/2 h-px animate-pulse bg-primary/70" />
        </div>
      </div>
      {error && <div className="absolute inset-x-4 top-4 rounded-lg border border-destructive/40 bg-background/95 p-3 text-sm">{error}</div>}
      {torchSupported && (
        <Button
          type="button"
          size="icon"
          variant={torchOn ? "default" : "secondary"}
          onClick={toggleTorch}
          className="absolute right-4 bottom-4 rounded-full"
          aria-label="Toggle flashlight"
        >
          <FlashlightIcon />
        </Button>
      )}
    </div>
  );
}
