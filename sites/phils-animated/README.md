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


## Shooting the walk-in video

This is the version where scroll drives a real video of walking into the shop. The player is
already built — it needs footage.

**Shooting it (a phone is fine):**
- One continuous take, no cuts. Start at the sidewalk or the parking spot, walk up, through the
  door, and end on the counter or a bay with a vehicle up on the lift.
- Landscape, held steady at chest height, walking slowly. 15–25 seconds.
- Daylight, and wipe the lens first — phone lenses are always smeared.
- Watch what's in frame: customer faces and readable plates are worth avoiding.

**Encoding it — this part matters.** Scrubbing is only smooth if every frame is a keyframe:

```bash
ffmpeg -i IMG_1234.mov \
  -vf "scale=1280:-2,fps=30" -an \
  -c:v libx264 -crf 26 -g 1 -pix_fmt yuv420p -movflags +faststart \
  public/media/walkthrough.mp4

# poster (first frame), shown before the video decodes
ffmpeg -i public/media/walkthrough.mp4 -frames:v 1 public/media/walkthrough-poster.jpg
```

`-g 1` makes every frame a keyframe so the browser can jump anywhere instantly. It inflates the
file, which is why the clip stays short and 1280px wide — aim for under 8 MB. `-an` drops the
audio; nobody wants sound firing on scroll.

Then in `build.py`:

```python
"walkthrough_video": "/media/walkthrough.mp4",
"walkthrough_poster": "/media/walkthrough-poster.jpg",
```

**How the player behaves:** scroll position maps to the playhead, and the playhead chases its
target rather than snapping, so a fast scroll doesn't ask the decoder for forty seeks a second.
Verified: 0% → 0s, 50% → half the duration, 100% → the last frame, clamped at both ends. If the
file fails to load the stage keeps the captions and the vignette instead of going black. Under
reduced motion the section unpins, the captions stack, and the video gets normal controls.

**Priority:** video, then Street View, then the address panel. Supply whichever you have.
