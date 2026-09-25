# Concept — Phil's Auto & Fleet Repair v2

## Assumptions (no 3D assets, no references supplied)

- The brief's placeholders are filled from the existing site: Phil's Auto & Fleet Repair, Lodi CA, primary CTA **call**, secondary **free quote**. NAP, hours, services, guides and the four real reviews (Yelp ×3, MapQuest ×1) come from `sites/phils-auto-fleet-repair/build.py`.
- No GLB supplied, so every 3D element is built procedurally. The logo is an 80 px raster badge and cannot be extruded; the procedural object echoes its gear motif instead.
- No competitor or reference URLs supplied. The bar I'm building to: the shop should look more credible than any dealership site in San Joaquin County and more alive than any independent shop's template site, without a single stock photo.
- Brand feel: **dark, cinematic, industrial**. Chrome and brushed steel under studio light, indigo from the logo as the only saturated colour, gold only for star ratings.
- Stack: Astro 5 with React islands. Home is the only page that loads Three.js. Deploy target Netlify (v1 already has a `netlify.toml`). Form keeps the existing FormSubmit endpoint plus a honeypot, since Netlify Forms only works once the site is actually on Netlify.
- v2 lives in `sites/phils-auto-v2/` beside v1. v1 stays deployable and untouched.
- The bay-door video from v1 is kept and used inside the 3D scene (see beat 3).

## 3D concept: (a) a procedural brand object

**A three-gear assembly in chrome and brushed steel, lit like a product shot.** A large ring gear, a mid gear and a small pinion, meshed and turning at correct ratios, floating in a dark studio. It is the shop's badge logo made physical, and gears are the one automotive object that reads instantly at any size and looks expensive when lit well.

Why not (b) particles: a point cloud forming a truck silhouette is a well-worn move and reads "tech startup", not "the shop that fixes your F-250". Why not (c) fluid gradient: beautiful but anonymous; nothing about it says auto repair. The gear assembly is specific to this business, works as a still (poster for low-tier devices) and gives the scroll story something mechanical to do: mesh, separate, reassemble.

Materials: `MeshStandardMaterial` with metalness 1, roughness 0.18 (chrome teeth) and 0.42 (brushed faces, anisotropy faked with a procedural normal map), a small HDR studio environment (drei `Environment` preset "studio", 256px), one key spot with soft shadows via `AccumulativeShadows`, indigo rim light from behind. Idle: gears turn slowly at their ratios, whole assembly drifts 2° on a sine, mouse tilts the assembly ±6°.

Depth layers (parallax at different rates on mouse and scroll):

1. Backdrop: a shader plane with domain-warped noise in ink and deep indigo, 4% film grain. Barely moves.
2. Far dust: 1,500 instanced points, soft-focus, drifting up. Moves at 0.3× the mouse.
3. The gear assembly. Moves at 1×.
4. Near flecks and two light streaks, out of focus, moving at 1.8×. Blurred by a cheap depth-of-field on tier 3 only.

Text sits on top in the DOM: H1, one-line value prop, Call + Get a free quote, and the 4.4-star / 83-review trust line. All real HTML, all readable before any JavaScript runs.

## Scroll storyboard

The first three beats are a pinned story: the hero section is 300 vh tall, the canvas and the headline column stay fixed, and GSAP ScrollTrigger scrubs a single 0 → 1 progress value into the R3F scene. Text panels cross-fade at the thirds. Lenis smooths the wheel.

| Scroll | Scene | DOM text | Purpose |
|---|---|---|---|
| 0% | Gears meshed, turning, centred right of the headline column. Camera at rest. | H1 "Honest auto, diesel & fleet repair in Lodi, California". Value prop. Call / Get a free quote. Trust line. | Keyword, offer, action, proof, all above the fold. |
| 0 → 33% | The assembly separates into an exploded view: gears slide apart along their axes, the ring gear tilts to show its teeth, camera pulls back and orbits 30°. | Panel 2: "We test before we replace parts." Three short lines: diagnosis first, plain-language quote, you approve every repair. | The differentiator, shown as the thing coming apart to be inspected. |
| 33 → 66% | Camera flies through the gap between the parted gears. Behind them a panel resolves: the bay-door video from v1 as a `VideoTexture` on a curved plane, muted, looping, slightly dimmed, with the gears now framing it. | Panel 3: "One shop for every vehicle you run." Auto · Diesel · Fleet, with three links to the service pages. | Brings the real shop into the scene. Fleet buyers see their trucks; consumers see a real place. |
| 66 → 100% | Gears close back up and lock, camera settles front-on, the assembly shrinks toward the top-right and hands off to the page. Video panel fades. | Panel 4: "You get the diagnosis, the price and the reasoning up front, then you decide." Call button again. | The promise, then release into normal scrolling. |
| after | Canvas unpins and stays as a dimmed backdrop for the stat band, then unmounts once it is 1.5 screens off. | Stat band, services grid, why-us table, lift photo, reviews, FAQ, quote form, CTA band. | The rest of the page is a normal, fast document. |

Reduced motion: no pin, no scrub, no cursor effects. Gears idle-rotate only; the four text panels stack as normal sections.

## Interactions

- Custom cursor: a 12 px ring in `mix-blend-mode: difference`, grows to 48 px over links, shows "Call", "Quote" or "View" as a label over cards. Native cursor stays visible for the form. Disabled on touch devices and under reduced motion. Focus rings are untouched.
- Magnetic buttons on the two hero CTAs and the header CTA (pull radius 80 px).
- Headline split into words, staggered reveal on load (after the poster paints, never blocking LCP).
- Service cards: image with a GLSL ripple distortion on hover (RGB shift 2 px), clip-path + scale reveal on scroll.
- One marquee row of service names between the stat band and the services grid.
- Page transitions: Astro View Transitions with a short indigo wipe; no WebGL wipe, since inner pages do not load Three.js.
- Post-processing on tier ≥ 2: bloom (threshold 0.9, intensity 0.35), vignette 0.25, film grain. Chromatic aberration only during the wipe.

## Performance plan (the part that keeps this from being a slow 3D site)

- LCP is the H1 plus a 40 KB AVIF poster of the scene at 0%. The canvas mounts after `requestIdleCallback` following the load event and cross-fades over 600 ms.
- `detect-gpu` at mount: tier 0–1 gets poster plus CSS-only gear rotation (an SVG gear), no WebGL. Tier 2 gets the scene without post-processing and 600 dust points. Tier 3 gets everything. The chosen tier is logged to the console.
- `frameloop="demand"` outside the pinned story; the loop pauses when the canvas is offscreen or the tab is hidden.
- DPR capped at 1.5. Geometry is procedural (no GLB to download). Environment map 256 px. Video texture is the existing 2.2 MB MP4, loaded only when the story reaches 25%.
- Budget: home ≤ 250 KB gzipped JS (Three ~150 KB, R3F + drei subset ~50 KB, GSAP + Lenis ~30 KB, app ~15 KB). Inner pages ≤ 90 KB (GSAP + Lenis + Motion micro-interactions only). Verified with the Astro build report before the perf pass milestone.

## Colour and type system

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0a0a1f` | page background on the home hero, footer |
| `--ink-2` | `#14143a` | panels, cards on dark |
| `--paper` | `#ffffff` | inner pages, content sections |
| `--paper-2` | `#f6f6fb` | alternate sections |
| `--accent` | `#3b2ce8` | primary CTA gradient start |
| `--accent-dk` | `#2418cc` | sampled from the badge logo; links on white |
| `--accent-lt` | `#8b7dff` | eyebrows, rim light, cursor ring on dark |
| `--chrome` | `#d9dbe6` | 3D chrome tint, dividers on dark |
| `--star` | `#f5a623` | star ratings only |
| `--ok` | `#0f7a4a` | form success |

Type: **Space Grotesk Variable** for display (H1–H3, eyebrows, buttons; tight tracking, weight 500–700) and **Inter Variable** for body and UI. Both self-hosted as woff2 subsets (Latin + Latin-1 for the Spanish page), `font-display: swap`, size-adjusted fallbacks to hold CLS under 0.05. Scale: H1 `clamp(2.6rem, 1.4rem + 4.2vw, 5.2rem)`, body 17 px / 1.6.

## Pages and what carries 3D

| Page | 3D | Notes |
|---|---|---|
| Home | Full scene | Only page that loads Three.js. |
| Services index, 12 service pages | None | Shader-free CSS hover on cards, GSAP reveals only. |
| About, Reviews, Contact, Service areas, Spanish | None | Contact has the map embed lazy-loaded on scroll. |
| Advice (4 existing + 2 new posts) | None | Article schema, table of contents, links to money pages. |
| 404, thank-you | None | `noindex`. |

## Approval needed before code

1. Concept (a), the gear assembly, with the bay-door video used inside beat 3.
2. Astro + React islands rather than Next.js (inner pages ship no React at all).
3. Space Grotesk + Inter as the type pair.

Say "go" or change any of the three.
