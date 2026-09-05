# Phil's Auto — animated build

Same 25-page site as `../phils-auto-fleet-repair`, plus a motion layer. Two builds come out of
this one folder:

```bash
python3 build.py                 # animated
python3 build.py --walkthrough   # animated + Street View arrival sequence on the home page
python3 build.py --relative      # relative links, for a subfolder or a zip
```

## What the motion layer does

`assets/css/motion.css` + `assets/js/motion.js`, both additive — delete them and the site is
exactly the original, fully styled and fully working.

- Hero headline rises line by line out of masks; rating, copy, buttons and form follow on a stagger
- Sections, cards, reviews and steps reveal on scroll, staggered by position so a grid lands as one
  wave rather than eight separate slides
- The 4.4 and the review count animate up when the stat band comes into view
- Scroll progress rail across the top; the mobile call bar slides in past the fold
- Hero glow drifts on a 22s loop; photo frames push in slightly on hover

Everything is inside `@media (prefers-reduced-motion: no-preference)`. Under reduced motion nothing
animates and nothing is hidden.

**Fail-open guarantee.** Reveal-on-scroll is the classic way to ship an invisible page. Anything
that hasn't been revealed by the observer gets swept visible on scroll, on resize, and 2.5s after
load regardless. An animation layer must never be the reason someone can't read the page.

## The arrival sequence (`--walkthrough`)

A 320vh section at the top of the home page: the Street View panorama of the shop is pinned while
four captions cross-fade — arriving, pulling in, what happens first, then you decide — with a slow
push toward the building. At the end the panorama becomes draggable.

**To supply the panorama:** Google Maps → the shop → Street View → the ⋮ menu →
*Share or embed image* → **Embed** → copy only the `src="..."` value → paste it into
`SITE["streetview_embed"]` in `build.py`. No API key, no billing account.

Until that's filled in, the stage shows the address with a Get directions button — a deliberate
panel, not a broken embed.

Captions live in `ARRIVAL_STEPS` in `build.py`.
