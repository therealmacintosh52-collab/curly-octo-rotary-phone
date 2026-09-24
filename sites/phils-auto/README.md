# Phil's Auto and Fleet Repair — site

Astro 7 + React 19 islands. Static output, no server.

## Assumptions

Filled in from material already in this repo rather than spending the brief's
three questions on them. Correct any line and I will rebuild against it.

- **Primary CTA is the phone**, not the form. A broken car is a phone call.
- **Stack is Astro, not Next.** Zero JS by default makes the inner-page budget
  the framework's behaviour instead of something to fight it for.
- **No GLB.** The hero engine is built from primitives in code, so there is no
  model to download and every part keeps its own material for the
  desaturation pass.
- **Every fact is sourced.** Phone, "tires at our cost", Interstate Batteries,
  Mastercraft, ASC membership — all read off photographs of the building.
  Rating and hours from the Google Business Profile. Reviews quoted verbatim.
  Nothing about certifications, warranties or years in business is claimed,
  because nothing supports it yet.
- **Competitors and reference sites were not reviewed.** Outbound network here
  reaches GitHub and npm only.

## Run

```bash
npm install
npm run dev          # localhost:4321
npm run build        # → dist/
npm run preview      # serve dist/
```

## Check

```bash
npm run check:budget # JS budget, measured by reachability from the HTML
npm run lh           # Lighthouse, mobile emulation, against the preview
npm run shots        # hero at 0/50/100% scroll, desktop + mobile → shots/
npm run poster       # re-render the hero poster from the live scene
```

`CHROME_PATH=/path/to/chrome` makes the browser scripts use a browser the
machine already has instead of downloading one.

## The hero

`?scene=force` on the home page runs the WebGL scene regardless of device
tier. It exists because the poster and screenshot scripts have to see the
scene on machines whose only GPU is software. A normal visit never reaches it.

Reading order if you need to change the hero:

| File | What it holds |
| --- | --- |
| `src/components/HeroCanvas.astro` | The tier gate. The only path to the renderer, and the reason a low-end phone never downloads one. |
| `src/scene/mount.jsx` | The only module importing React or Three. |
| `src/scene/Hero3D.jsx` | Canvas, lights, the three parallax layers, camera rig. |
| `src/scene/Engine.jsx` | The engine itself: every part, the axis it flies out along, and the material lerp that leaves one coil lit. |

Swapping the engine for a real model: drop a Draco-compressed GLB in
`public/models/`, load it in `Hero3D.jsx`, and give each named part the same
`out` vector and material treatment `Engine.jsx` applies. Keep the `coilTarget`
ref updated or the camera will not know where to push in.

## Measured, not claimed

See `design/concept.md` for the full picture. The short version, on mobile
emulation with 4× CPU throttling:

| Path | Perf | A11y | BP | SEO | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` — what real visitors get here | 100 | 100 | 100 | 100 | 1.5s | 0 | 0ms |
| `/?scene=force` — WebGL forced on | 60 | 100 | 100 | 100 | 1.4s | 0 | 162s |

That 162s TBT is **software rendering, not the site**: this machine has no GPU,
so WebGL falls back to SwiftShader on the CPU, underneath Lighthouse's own 4×
throttle. It is a floor, not a forecast. The number that matters is the first
row, because device tiering means a phone that would struggle never loads the
scene at all — verified by watching what the page actually requests:

| | JS files fetched |
| --- | --- |
| Normal visit on a low tier | 5 — no React, no Three.js |
| Tier 2+ | 8 — React and Three arrive after LCP |

JS budget, measured by following what the HTML actually pulls: **1.8 KB
critical**, 313 KB deferred behind a dynamic import.
