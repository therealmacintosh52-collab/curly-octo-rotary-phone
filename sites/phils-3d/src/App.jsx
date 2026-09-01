import React, { Suspense, lazy, useState } from "react";
import { useSmoothScroll } from "./hooks/useSmoothScroll.js";
import { useCanRender3D } from "./hooks/useCanRender3D.js";

const Hero3D = lazy(() => import("./scene/Hero3D.jsx"));

const PHONE = "(209) 647-4953";
const TEL = "+12096474953";

export default function App() {
  useSmoothScroll();
  const canRender3D = useCanRender3D();
  const [sceneSettled, setSceneSettled] = useState(false);

  return (
    <>
      <header className="bar">
        <span className="mark">Phil's Auto &amp; Fleet Repair</span>
        <span className="bar-meta">Lodi, California · Est. locally owned</span>
      </header>

      <section className="hero">
        {/* Poster paints immediately and stays until the scene has settled,
            so the LCP never waits on WebGL. */}
        <div
          className={"stage" + (sceneSettled ? " stage--live" : "")}
          aria-hidden="true"
        >
          {/* Poster is painted, not fetched: zero bytes over the wire, paints
              on first frame, and the LCP element stays the headline. Swap in a
              rendered still here if you want photographic depth. */}
          <svg className="poster" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
            <defs>
              <radialGradient id="bay" cx="68%" cy="38%" r="78%">
                <stop offset="0%" stopColor="#1b2029" />
                <stop offset="62%" stopColor="#0b0d13" />
                <stop offset="100%" stopColor="#07080c" />
              </radialGradient>
              <filter id="soft"><feGaussianBlur stdDeviation="26" /></filter>
            </defs>
            <rect width="1600" height="1000" fill="url(#bay)" />
            <g filter="url(#soft)" fill="#232935" opacity="0.9">
              <rect x="820" y="430" width="520" height="170" rx="14" />
              <rect x="856" y="352" width="450" height="70" rx="10" />
              <rect x="800" y="600" width="470" height="80" rx="12" />
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <rect key={i} x={862 + i * 74} y={276} width="46" height="64" rx="8" />
              ))}
            </g>
            <ellipse cx="1070" cy="700" rx="330" ry="34" fill="#05060a" opacity="0.85" filter="url(#soft)" />
          </svg>
          {canRender3D && (
            <div className="canvas-wrap">
              <Suspense fallback={null}>
                <Hero3D onReady={() => setSceneSettled(true)} />
              </Suspense>
            </div>
          )}
        </div>

        <div className="copy">
          <p className="eyebrow"><span className="rule" />Diagnostics · Diesel · Fleet</p>
          <h1>
            Most shops replace<br />
            all six.<br />
            <em>We find the one.</em>
          </h1>
          <p className="sub">
            Auto, diesel and fleet repair in Lodi. We test until we can point at the failed
            part — then you get the price before anything is touched.
          </p>
          <dl className="specs">
            <div><dt>Rated</dt><dd>4.4 / 5 · 83 Google reviews</dd></div>
            <div><dt>Open</dt><dd>Mon–Sat · 8:00–17:00</dd></div>
            <div><dt>Shop</dt><dd>103 E Elm St, Lodi CA</dd></div>
          </dl>
        </div>

        <span className="cyl-note" aria-hidden="true">CYL 4 · IGNITION COIL · FAULT ISOLATED</span>
      </section>

      {/* CTA is DOM, sticky, and never inside the canvas. */}
      <aside className="cta">
        <a className="cta-call" href={`tel:${TEL}`}>Call {PHONE}</a>
        <a className="cta-quote" href="#quote">Get a quote</a>
      </aside>
    </>
  );
}
