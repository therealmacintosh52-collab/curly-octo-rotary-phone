import { heroMedia } from '@/generated/media';
import { site } from '@/config/site';
import { BookLink, QuoteLink } from '../CtaLinks';
import { HeroScrub } from './HeroScrub';

/*
  Scroll-scrub hero.
  - Track = 350svh in scrub mode (100svh sticky stage + ~250svh scrub); 100svh in static mode.
    Mode is decided by the inline head script before first paint → no CLS.
  - Frame 0 is a real <img> poster (fetchpriority=high, explicit size) → LCP-safe; the canvas
    draws on top of it once frames decode.
  - Copy is SSR HTML; beats are revealed by scroll (HeroScrub) or a CSS fade in static mode.
*/
export function Hero() {
  const { poster, static: still, backdrop } = heroMedia;
  return (
    <section id="top" aria-labelledby="hero-title" className="hero-track" data-hero-track>
      <div className="hero-stage">
        {/* Desktop backdrop: hero-beading pre-blurred + darkened (no runtime blur filter). */}
        <div aria-hidden="true" className="absolute inset-0 hidden lg:block">
          <div className="absolute inset-0 scale-110 bg-cover bg-center" style={{ backgroundImage: `url(${backdrop.tiny})` }} />
          <div className="absolute inset-0 scale-110 bg-cover bg-center" style={{ backgroundImage: `url(${backdrop.src})` }} />
          <div className="absolute inset-0 bg-gradient-to-r from-onyx via-onyx/55 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-onyx to-transparent" />
        </div>

        {/* Media: full-bleed on mobile, 55%-width rounded panel on desktop */}
        <div
          data-hero-media
          className="absolute inset-0 overflow-hidden bg-onyx bg-cover bg-center lg:inset-auto lg:bottom-6 lg:right-8 lg:top-24 lg:w-[55%] lg:rounded-[var(--radius-panel)] lg:border lg:border-white/10 lg:shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]"
          style={{ backgroundImage: `url(${poster.m.tiny})` }}
        >
          <picture>
            <source media="(min-width: 1024px) and (prefers-reduced-motion: reduce)" type="image/avif" srcSet={still.d.avif} width={720} height={1000} />
            <source media="(min-width: 1024px) and (prefers-reduced-motion: reduce)" type="image/webp" srcSet={still.d.webp} width={720} height={1000} />
            <source media="(prefers-reduced-motion: reduce)" type="image/avif" srcSet={still.m.avif} />
            <source media="(prefers-reduced-motion: reduce)" type="image/webp" srcSet={still.m.webp} />
            <source media="(min-width: 1024px)" type="image/avif" srcSet={poster.d.avif} width={720} height={1000} />
            <source media="(min-width: 1024px)" type="image/webp" srcSet={poster.d.webp} width={720} height={1000} />
            <source type="image/avif" srcSet={poster.m.avif} />
            <img
              data-hero-poster
              src={poster.m.webp}
              width={720}
              height={1280}
              alt="Dark blue car door with a dent, lit in a studio at night"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </picture>
          <canvas data-hero-canvas aria-hidden="true" className="absolute inset-0 h-full w-full opacity-0" />
          {/* legibility gradients (mobile copy sits on the image) */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[58%] bg-gradient-to-b from-onyx/90 via-onyx/50 to-transparent lg:hidden" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-onyx/80 to-transparent lg:h-1/4 lg:from-onyx/40" />
        </div>

        {/* Copy */}
        <div className="relative z-10 flex h-full flex-col px-5 pt-[5.5rem] sm:px-8 lg:absolute lg:inset-y-0 lg:left-0 lg:w-[45%] lg:justify-center lg:pb-10 lg:pl-[max(2rem,calc((100vw-1240px)/2+2rem))] lg:pr-12 lg:pt-20">
          <div className="hero-copy max-w-[34rem]">
            <p className="eyebrow mb-4 lg:mb-6">Mobile PDR &amp; detailing · Sacramento</p>
            <h1 id="hero-title" className="font-display text-[clamp(1.6rem,7.4vw,2.6rem)] leading-[1.12] lg:text-[clamp(2rem,2.85vw,3.1rem)]">
              <span className="beat beat-1 block">{site.heroLines[0]}</span>
              <span className="beat beat-2 block">{site.heroLines[1]}</span>
              <span className="beat beat-3 text-metal block pb-1">{site.heroLines[2]}</span>
            </h1>
            <div className="hero-after mt-5 lg:mt-7">
              <p className="max-w-[30rem] text-[0.98rem] text-ivory/80 lg:text-lg lg:text-steel">{site.heroSubhead}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <QuoteLink where="hero" className="btn btn-gold">Get a price from a photo</QuoteLink>
                <BookLink where="hero" className="btn btn-outline bg-onyx/30 backdrop-blur-sm">Book now</BookLink>
              </div>
            </div>
          </div>
        </div>

        <div data-hero-cue aria-hidden="true" className="pointer-events-none absolute bottom-24 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[0.65rem] tracking-[0.3em] text-steel lg:bottom-10 lg:left-[22%] [html.scrub_&]:flex">
          SCROLL
          <span className="block h-10 w-px bg-gradient-to-b from-gold to-transparent" />
        </div>
      </div>
      <HeroScrub />
    </section>
  );
}
