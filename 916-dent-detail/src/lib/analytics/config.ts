// Env-gated tracking config. Every ID is optional: with none set, no third-party script is ever loaded and no
// consent banner is shown (nothing to consent to). NEXT_PUBLIC_* must be referenced literally so Next inlines them.
export const ga4Id = process.env.NEXT_PUBLIC_GA4_ID || '';
export const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';
// Either spelling works: NEXT_PUBLIC_GADS_ID (SPEC) or NEXT_PUBLIC_GOOGLE_ADS_ID (.env.example).
export const gadsId = process.env.NEXT_PUBLIC_GADS_ID || process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || '';
export const gadsLabels = {
  quote: process.env.NEXT_PUBLIC_GADS_LABEL_QUOTE || process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_QUOTE || '',
  booking: process.env.NEXT_PUBLIC_GADS_LABEL_BOOKING || process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_BOOKING || '',
  call: process.env.NEXT_PUBLIC_GADS_LABEL_CALL || process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_CALL || '',
} as const;
/** [OWNER] URL of the privacy policy page; the consent banner links to it once set. */
export const privacyUrl = process.env.NEXT_PUBLIC_PRIVACY_URL || '';

export const trackingConfigured = Boolean(ga4Id || metaPixelId || gadsId);
