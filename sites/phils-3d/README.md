# Phil's Auto — "The Diagnosis" (3D hero)

Art direction 1: an inline-six ignition system explodes apart on load, then everything greys out
except the one coil that actually failed. The 3D *is* the sales argument — most shops replace all
six, this shop finds the one.

```bash
npm install
npm run dev      # http://localhost:5173
```

## What's here (hero only — Step 2 of the process)

| File | Role |
|---|---|
| `src/App.jsx` | DOM shell: headline, spec list, sticky CTA (never inside the canvas) |
| `src/scene/Hero3D.jsx` | Canvas, lightformer studio environment, ContactShadows, postprocessing, camera rig |
| `src/scene/EngineAssembly.jsx` | The assembly + explode/isolate timeline. GLB-ready |
| `src/hooks/useCanRender3D.js` | Capability gate — reduced motion, small screens, low-end, no WebGL |
| `src/hooks/useSmoothScroll.js` | Lenis driving the GSAP ticker so ScrollTrigger stays in sync |

## Swapping in a real model

The assembly is procedural so nothing is blocked on an asset. Drop a Draco-compressed GLB at
`/models/engine.glb` (target <2MB), name the six coil meshes `coil_1`…`coil_6`, and switch
`EngineAssembly` to `useGLTF` — the timeline is written against named parts, not primitives.

## Lighting

The studio is built from `<Lightformer>` rects rather than a fetched HDRI: art-directed, no CDN
dependency, no extra megabytes. Swap for `<Environment files="/hdr/bay.hdr" />` if you want a real
captured space.

## Measured so far

- Main bundle 273 KB (96 KB gzip). Hero3D chunk 1.11 MB (337 KB gzip), lazy-loaded after the page
  has painted and only when the device qualifies.
- Poster is painted SVG, not a fetched image — zero bytes, paints on first frame, and the LCP
  element stays the headline.
