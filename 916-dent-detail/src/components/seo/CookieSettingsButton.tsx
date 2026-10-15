'use client';
import { trackingConfigured } from '@/lib/analytics/config';
import { CONSENT_OPEN_EVENT } from '@/lib/analytics-consent';

/** Footer link to reopen the banner. Renders nothing when no tracker is configured. */
export function CookieSettingsButton({ className }: { className?: string }) {
  if (!trackingConfigured) return null;
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}>
      Cookie settings
    </button>
  );
}
