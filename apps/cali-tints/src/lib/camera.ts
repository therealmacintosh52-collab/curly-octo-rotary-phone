/** Camera helpers shared by the VIN scanner and the photo capture. */

/** The rear camera, sharp enough for a barcode or a damage record. */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  audio: false,
};

/** A short, honest message for the usual getUserMedia failures. */
export function cameraErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera access was blocked. Allow the camera for this site and try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera found on this device.";
  if (name === "NotReadableError") return "The camera is in use by another app.";
  return "Could not start the camera.";
}

/** True when the video track can turn the flashlight on (Android Chrome and WebViews; not iOS Safari). */
export function torchSupported(track: MediaStreamTrack | null): boolean {
  const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
  return !!caps?.torch;
}

export async function setTorch(track: MediaStreamTrack, on: boolean): Promise<void> {
  await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
}

/** Does this browser let `<input type="file" capture>` open the camera app? WebViews without a file chooser (the Clover Flex) do not. */
export function hasNativeFileCapture(): boolean {
  if (typeof window === "undefined") return true;
  if ((window as Window & { CaliClover?: unknown }).CaliClover) return false;
  return typeof HTMLInputElement !== "undefined" && "capture" in document.createElement("input");
}
