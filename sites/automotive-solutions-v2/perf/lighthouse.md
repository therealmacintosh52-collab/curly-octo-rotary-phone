# Lighthouse — mobile

Run with `node scripts/lh.mjs` against the built `dist/`, throttled mobile
(390×844, 4× CPU slowdown, simulated slow 4G — Lighthouse defaults).

Target from the blueprint: performance ≥ 90, accessibility / best-practices /
SEO = 100, CLS = 0.

| Page | URL | Perf | A11y | Best prac. | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| Home | `/` | **98** | **100** | **100** | **100** | 2.1 s | 0 | 110 ms |
| Service | `/services/brake-repair/` | **100** | **100** | **100** | **100** | 1.7 s | 0 | 0 ms |
| Guide | `/advice/check-engine-light/` | **99** | **100** | **100** | **100** | 1.8 s | 0 | 0 ms |
| Contact | `/contact/` | **100** | **100** | **100** | **100** | 1.7 s | 0 | 0 ms |

Last run: 2026-09-25

## Notes

- The LCP is the hero poster (AVIF, ~9 KB), preloaded with `fetchpriority="high"`.
- The video source is not attached until after `load`, so it never competes
  with the LCP. With no clip present yet, no video is requested at all.
- Fonts are self-hosted woff2 with `font-display: optional` and metric-matched
  fallbacks, which is what holds CLS at 0.
- GSAP and Lenis are dynamically imported after `load` and skipped entirely for
  `prefers-reduced-motion`.
