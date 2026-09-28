import { registerCheck, type Check } from "../registry";

const TEL_LINK = /<a\b[^>]*\bhref\s*=\s*["']tel:/i;

/**
 * The first real check, and the template for the rest: read only what was
 * collected, cite the evidence, say what it costs in plain English, and return
 * `unavailable` when the module is missing.
 */
export const phoneClickToCall: Check = registerCheck({
  id: "conversion.phone_click_to_call",
  category: "conversion",
  title: "Phone number is a tap-to-call link",
  description: "On phones, a phone number that is not an <a href=\"tel:\"> link forces the visitor to copy it by hand. Most do not.",
  run(ctx) {
    const home = ctx.website?.pages[0];
    if (!home) return { status: "unavailable", reason: "home page was not crawled" };
    if (TEL_LINK.test(home.html)) return { status: "pass" };

    const digits = ctx.business.phone?.replace(/\D/g, "");
    const phoneShown = !!digits && home.html.replace(/\D/g, "").includes(digits.slice(-7));
    return {
      status: "finding",
      title: phoneShown ? "Your phone number cannot be tapped on mobile" : "No tap-to-call phone link on the home page",
      plain_english: phoneShown
        ? "Your number is on the page as plain text. On a phone, a visitor has to memorise or copy it to call you, and many do not bother."
        : "Visitors on a phone who want to call you have nothing to tap. They have to find the number somewhere else or give up.",
      severity: "high",
      impact_score: 70,
      fix_difficulty: "easy",
      evidence: [
        {
          type: "html",
          excerpt: phoneShown ? "Phone number found as plain text; no <a href=\"tel:\"> link in the page." : "No <a href=\"tel:\"> link in the page.",
          source_url: home.final_url,
        },
      ],
    };
  },
});
