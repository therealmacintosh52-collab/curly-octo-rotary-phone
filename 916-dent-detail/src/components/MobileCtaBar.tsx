import { CallLink, QuoteLink, TextLink } from './CtaLinks';

/* Sticky bottom bar on phones/tablets: Call · Text · Get price. Fixed → never shifts layout. */
export function MobileCtaBar() {
  const item = 'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[0.72rem] font-semibold tracking-wide';
  return (
    <nav aria-label="Quick contact" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-onyx/92 backdrop-blur-md lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex max-w-xl items-stretch gap-2 px-3 py-2">
        <CallLink where="sticky_bar" className={`${item} rounded-xl text-ivory`}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" /></svg>
          Call
        </CallLink>
        <TextLink where="sticky_bar" className={`${item} rounded-xl text-ivory`}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 5h16v11H8l-4 4z" /></svg>
          Text
        </TextLink>
        <QuoteLink where="sticky_bar" className={`${item} flex-[1.6] flex-row gap-2 rounded-full bg-gold text-[0.85rem] text-onyx`}>
          Get price
        </QuoteLink>
      </div>
    </nav>
  );
}
