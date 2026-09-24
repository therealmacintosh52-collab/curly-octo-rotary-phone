# Concept — Phil's Auto and Fleet Repair

**Status: waiting on your approval before any site code is written.**

---

## Assumptions I made instead of asking

The brief has three blocking questions allowed. I am using none of them, because every gap is
answerable from the material already in this repo. Here is what I filled in, so you can correct
any of it in one line:

| Brief field | Filled in as | Where it came from |
| --- | --- | --- |
| Name | Phil's Auto and Fleet Repair | — |
| What it does | Auto, diesel and fleet repair that diagnoses before it replaces parts | The shop's own reviews |
| Location | Lodi, CA + Stockton, Galt, Acampo, Woodbridge, Lockeford, Victor, Thornton, Clements, Elk Grove | Existing site |
| Primary CTA | **Call.** Quote form second. | An emergency-intent business: a broken car is a phone call, not a form fill |
| NAP + hours | (209) 647-4953 · phil@philsautofleet.com · 103 E Elm St, Lodi, CA 95240 · Mon–Sat 8:00–5:00 | Photographed sign + GBP |
| Brand feel | Dark, cinematic, industrial | Their building is corrugated steel and the interior shots are low-light |
| Colors / fonts | Proposed below, indigo sampled from their real logo | — |
| Real proof | 4.4★ / 83 ratings, 4 verbatim reviews, 8 photographs, one 16s walk-in video | Already in the repo |
| 3D assets | **None — built procedurally.** No GLB anywhere. | See below; this is a feature |
| Competitors | Not supplied, and not reachable from this machine | Outbound net is GitHub + npm only |
| Reference sites | Same — cannot browse awwwards.com or godly.website from here | Same |

**Stack: Astro 7 + React 19 islands**, not Next.js. Both were offered. Astro wins here for one
decisive reason: it ships **zero JavaScript by default**, so the "inner pages do NOT load
Three.js" and "≤ 90KB on inner pages" rules are the framework's default behaviour rather than
something I have to fight the framework to achieve. `client:only="react"` also gives exact
control over when the canvas mounts, which is the whole ballgame for LCP.

Versions I will pin: `astro@7.3.5`, `@astrojs/react@7.0.0`, `three@0.186.1`,
`@react-three/fiber@9.8.0`, `gsap`, `lenis`, `detect-gpu@5.0.70`.

---

## The 3D concept: (a), and specifically **"The Diagnosis"**

The brief offers three. Taking them in turn against *this* business:

- **(c) fluid/gradient shader + glass blobs** — beautiful, and it says nothing. Drop it on a
  fintech site and nobody could tell. An auto shop competing on honesty should not lead with the
  most interchangeable look in web design. **Rejected.**
- **(b) 50k–200k particle field forming a shape** — impressive, but the "shape" read is weak at
  phone size, and a point cloud of a wrench is a picture of a wrench. It costs the most GPU for
  the least meaning. **Rejected.**
- **(a) a hero object with studio lighting, idle rotation, scroll choreography** — right form,
  but the obvious version (spin the logo) is a screensaver.

So: **(a), with the object chosen to argue the business's actual case.**

### The idea

A **procedurally built inline-six engine** floats in the hero. As you scroll it **explodes into
its parts**. Then every part **desaturates to cold steel except one ignition coil, which stays
lit in amber** — the colour of a dashboard warning light — and the camera pushes in on it.

That is not decoration. It is the shop's sales argument, rendered:

> A trouble code tells you a circuit misfired. It does not tell you which part failed. Finding
> that is the work, and it is the reason people drive to Lodi from three towns over.

Every review this shop has says a version of this. *"Put more effort in than any other shop I
have been to."* *"Kept having the service advance track light come on randomly."* The hero is
that sentence as an object you can turn with your mouse.

**No GLB file.** The engine is built from primitives in code — a block, six bores, a crank, six
coils, a manifold. This is not a compromise: it means zero model download, exact control of every
part's material for the desaturation pass, and no 2MB budget line at all. It also means the shop
can never hand me a model of the wrong engine.

### Why it beats the reference brief's own instincts

The brief says "particle field", "fluid shader", "glass shapes" because those are what Awwwards
rewards. What Awwwards actually rewards is *a site where the technique and the subject are the
same idea*. A glass blob on a diesel shop is a costume. An engine that tells you which coil
failed is the shop's argument, and it is the thing a local business owner sends to his friends.

---

## Scroll storyboard

Four beats. Sections 1–3 hold the canvas; section 4 hands the page back to ordinary HTML.

### Beat 1 — Hero · `0 → 100vh` · not pinned

- Engine **assembled**, dead centre, slow idle rotation (~0.08 rad/s), tilting to the mouse with
  a lagged spring so it feels weighted rather than glued to the cursor.
- **Three depth layers**, which is what makes it read as space and not a video:
  1. **Far** — a full-screen plane running a domain-warped noise shader in near-black indigo.
     Moves 0.15× with pointer. Very low contrast; you register it as atmosphere.
  2. **Mid** — the engine. 1.0×.
  3. **Near** — ~400 dust motes on an instanced mesh, drifting, slightly out of focus, moving
     1.6×. Shop air in a light shaft.
- **The H1 is real HTML on top of the canvas.** Not in the canvas, not a texture. The canvas is
  `aria-hidden="true"` and every word is in the DOM.
- Above the fold: H1, one-line value prop, **call button**, and one trust signal (4.4★ / 83).

### Beat 2 — "A code is not a diagnosis" · pinned, scrubbed

- The engine **explodes**: each part travels out along its own axis, coils rising, manifold
  lifting away, crank sliding forward. Rotation continues underneath so it never sits still.
- Camera pulls back slightly and drops ~8° so you look *into* the assembly.
- Pinned text swaps on scrub, two lines, staggered by character:
  *"Your scanner says cylinder 3 misfired."* → *"It does not say why."*

### Beat 3 — "Finding the one that failed" · pinned, scrubbed

- Every part **desaturates** — materials lerp toward brushed steel, roughness up, saturation to
  near zero.
- **Coil 3 stays amber** and begins a slow pulse. Bloom is keyed to this one object, rising from
  0 as the desaturation completes, so the glow reads as *found it* rather than as a filter over
  the whole frame.
- Camera pushes in until the coil fills the middle third.
- DOM label fades in beside it — real text, selectable: **"Cylinder 3 · ignition coil"** and
  underneath, *"Replaced. The other five stayed in the car."*
- This is the conversion beat. The CTA under it is the phone number.

### Beat 4 — the shop itself · canvas released

The canvas unmounts its render loop and the page becomes ordinary fast HTML:

1. **The walk-in.** The shop's own 16-second video, scroll-scrubbed — already built, already
   remuxed for streaming, already falling back to stills. It carries straight over. Abstract 3D
   earns attention; this is what cashes it, because it is the actual building.
2. Services grid — ten cards, hover distortion (see below).
3. Proof — the four real reviews, verbatim.
4. Sticky mobile CTA bar appears once the hero is out of view.

---

## The other interaction work

| Brief item | How, and what it costs |
| --- | --- |
| **Image shader distortion on hover** | One *shared* 256×256 WebGL canvas that renders the hovered card's image with an RGB-shift + ripple, positioned over the card. One canvas, not ten. Desktop + tier ≥ 2 only; everywhere else the card gets a CSS clip-path/scale reveal that looks deliberate rather than degraded. |
| **Custom cursor** | Blend-mode `difference` dot, expands over links, shows a label over cards. `pointer-events: none`, decorative only. **Native focus rings stay untouched** — the cursor is drawn beside the real focus state, never instead of it. Off on touch, off under reduced motion. |
| **Magnetic buttons** | Transform-only, spring-damped, ≤ 8px pull. CSS transforms, no layout thrash. |
| **Split-text reveals** | Chars for the H1, words elsewhere. Split at build time into `<span>`s with `aria-label` on the parent, so a screen reader reads one sentence, not 47 letters. |
| **Marquee rows** | The service list and the badge row (Interstate Batteries, Mastercraft, ASC — all real, all photographed on their building). CSS animation, no JS. |
| **Page transitions** | **Astro View Transitions**, which the brief explicitly allows as an alternative to a WebGL wipe. Chosen deliberately: a WebGL wipe would force Three.js onto every inner page and blow the 90KB budget for a 400ms effect. |
| **Post-processing** | Bloom (keyed to the coil, subtle), vignette, film grain. Chromatic aberration **only** during the transition, never idle. All of it off below tier 2. |

---

## Colour and type

### Palette

Sampled from their real logo, not invented. The indigo is the logo's own blue.

| Token | Hex | Use |
| --- | --- | --- |
| `--ink` | `#07071A` | Page ground. Near-black, blue-cast. |
| `--surface` | `#101028` | Cards, raised panels. |
| `--line` | `#242455` | Hairlines, dividers. |
| `--brand` | `#3B2CE8` | The logo's indigo. Primary actions. |
| `--brand-bright` | `#6A5BFF` | Hover, focus, the gradient's light end. |
| `--brand-deep` | `#2418CC` | Gradient dark end, pressed states. |
| `--signal` | `#F5A623` | **The warning-light amber.** The failed coil, and review stars. Used nowhere else — its scarcity is what makes the hero land. |
| `--text` | `#E8EDF6` | Body on dark. |
| `--muted` | `#94A4BD` | Secondary text. AA on `--ink`. |
| `--concrete` | `#F4F4F2` | The light sections. Shop-floor grey, not white. |

The discipline that makes this work: **amber appears exactly twice on the site** — on the failed
coil, and on the review stars. Both mean "this is the thing to look at". Everywhere else is
indigo on near-black.

### Type

**Archivo Variable**, self-hosted, one `woff2`, subset to Latin + Latin-Extended (Spanish needs
the accents for `/es/`). One family covering everything, via its weight (100–900) and width
(62–125) axes — an industrial grotesque that can go tight and heavy for the hero without a second
file.

- Hero H1: width 88, weight 800, `clamp(2.6rem, 7vw, 5.4rem)`, tracking −0.03em.
- Section H2: width 100, weight 700, fluid.
- Body: width 100, weight 400, 1.65 line-height, max 68ch.
- Phone numbers and hours: `font-variant-numeric: tabular-nums`.

`font-display: swap`, preloaded, so the H1 paints in the fallback stack immediately and never
holds up LCP.

---

## Performance plan

The brief is right that a slow 3D site is worse than no 3D site, so here is the mechanism, not
the promise.

- **The canvas mounts after LCP.** The hero ships a **static poster** that paints instantly, and
  the live canvas cross-fades in behind the text once `requestIdleCallback` fires after the LCP
  element paints. I can generate that poster honestly: WebGL renders in this container (verified
  — SwiftShader, WebGL 2.0, shaders compile and `readPixels` returns real shaded pixels), so the
  poster will be a **screenshot of the actual scene**, not a mock-up of it.
- **Device tiering** with `detect-gpu`. Tier 0–1: poster + CSS animation, no WebGL at all, no
  Three.js downloaded. Tier 2+: full scene. Chosen tier logged to console as the brief asks.
- `frameloop="demand"`, plus a render loop paused on `IntersectionObserver` (canvas offscreen)
  and on `visibilitychange` (tab hidden).
- DPR capped at 1.5. Particle count scales by tier. Post-processing off below tier 2.
- `prefers-reduced-motion`: no scrub, no cursor effects, idle rotation only.
- Inner pages import no Three.js. Astro makes this the default rather than a discipline.

### The budget number I will not pretend about

The brief sets **≤ 250KB gzipped on the home page** and notes Three.js is ~150KB of it. Three +
R3F + the postprocessing chain + GSAP + Lenis lands above that. The earlier prototype in this
repo measured **337KB gzipped** for its hero chunk.

I intend to get under it, by: dropping `@react-three/postprocessing` for a hand-rolled composer
with only the three passes actually used; using a procedural environment instead of `drei`'s
`Environment` (which drags in an HDR loader and an HDR file); and importing `three` by submodule
so Vite can tree-shake it.

**What I will report is the measured gzip size, whatever it turns out to be** — and if the full
scene cannot fit under 250KB without gutting it, I will say so and give you the number and the
trade, rather than quietly shipping 340KB or quietly deleting the concept. The honest framing I
would argue for: 250KB for everything needed to *read and use* the page, with the WebGL island as
a separately-loaded chunk that only tier 2+ devices ever fetch, after LCP.

### What I can and cannot measure here

| | |
| --- | --- |
| **Lighthouse** | ✅ Runs. Verified: the current site scores perf 72 / a11y 95 / BP 100 / SEO 100 on mobile emulation, LCP 8.7s. Real numbers, not estimates. |
| **Hero screenshots at 0 / 50 / 100% scroll** | ✅ Possible. WebGL renders and screenshots capture it. |
| **The caveat on both** | This container has **no GPU** — WebGL runs on SwiftShader, in software. A WebGL page will score **worse here than on a real phone**, sometimes much worse. I will label every number with the machine it came from and never present a container score as a device score. |
| **Competitor and reference-site review** | ❌ Cannot browse. If you want the vibe matched to specific sites, paste the URLs or screenshots. |

---

## What carries over, and what gets rebuilt

Not starting from zero. What already exists and is genuinely good:

**Carries over:** the 16-second walk-in video and its faststart remux; the scroll-scrub player
with its four fallback paths; the eight shop photographs; the four verbatim reviews; the service
taxonomy and its long-form copy; all JSON-LD; the Spanish page; the redirect and headers files.

**Gets rebuilt:** every template (Python generator → Astro), the entire visual system, all
interaction, the hero.

**Gets deleted:** nothing, until you have seen the new one standing up.

---

## What I need from you

The brief says stop here, so I am stopping here. To start building I need:

1. **Go / no-go on "The Diagnosis"** — the exploding engine that isolates one failed coil. If
   you would rather have (b) the particle field or (c) the shader-and-glass look, say so now;
   after the hero is built it is a rewrite, not a tweak.
2. **Anything wrong in the assumptions table** at the top.
3. *(Optional)* Two or three reference URLs or screenshots for the vibe. I cannot reach
   awwwards.com from this machine, but I can work from images you paste.

On approval, the order is: hero + home → stop, with real screenshots at 0/50/100% scroll on
desktop and mobile → remaining pages → perf pass → SEO audit. Commit at each milestone.
