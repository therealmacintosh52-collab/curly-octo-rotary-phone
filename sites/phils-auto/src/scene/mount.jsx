/**
 * The only module that imports React or Three.js.
 *
 * Reached exclusively by a dynamic import from the tier check in the page,
 * so a phone that will never run the scene never downloads the renderer —
 * or React.
 */
import { createRoot } from "react-dom/client";
import Hero3D from "./Hero3D.jsx";

export function mount(host, tier) {
  createRoot(host).render(<Hero3D tier={tier} />);
}
