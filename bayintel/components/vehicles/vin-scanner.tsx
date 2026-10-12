"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { normalizeVin } from "@/lib/utils";
import { isValidVinFormat } from "@/lib/vin";

/**
 * Camera scanner for the VIN barcode (Code 39 / Code 128 on the door-jamb label,
 * QR or Data Matrix on newer labels). Calls onVin once a 17-char VIN is read.
 */
export function VinScanner({ onVin, onClose }: { onVin: (vin: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRead, setLastRead] = useState<string | null>(null);

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let done = false;
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_128,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.PDF_417,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const back = devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[devices.length - 1];
        controls = await reader.decodeFromVideoDevice(back?.deviceId, videoRef.current!, (result) => {
          if (!result || done) return;
          const text = result.getText();
          setLastRead(text);
          // Some Code 39 VIN labels prefix an "I" start character.
          const candidates = [text, text.replace(/^I/, "")].map(normalizeVin);
          const vin = candidates.find(isValidVinFormat);
          if (vin) {
            done = true;
            controls?.stop();
            onVin(vin);
          }
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Camera unavailable. Type the VIN instead.");
      }
    })();
    return () => controls?.stop();
  }, [onVin]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-x-6 top-1/2 h-16 -translate-y-1/2 rounded-md border-2 border-primary/80" aria-hidden />
      </div>
      <p className="text-sm text-muted-foreground">
        Aim at the barcode on the driver door jamb label or the windshield plate. Hold steady 6–10 inches away.
      </p>
      {lastRead && <p className="truncate font-mono text-xs text-muted-foreground">Read: {lastRead}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button type="button" onClick={onClose} className="tap w-full rounded-lg border border-border text-sm">
        Cancel
      </button>
    </div>
  );
}
