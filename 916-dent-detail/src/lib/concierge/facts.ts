// Customer-facing facts the bot may state. Everything here is either read from src/config/* or is wording lifted from
// the published site content (src/content/home.ts FAQs, the mobile-detailing posts). The bot never states a policy or
// number that is not here, in config, or in a tool result. [OWNER] items are listed in TODO.md.
import { depositPolicy } from '@/config/booking';
import { ESTIMATE_LABEL, depositAmount, travelFees } from '@/config/pricing';
import { site } from '@/config/site';
import { policyLines } from '@/lib/booking/policy';

/** Phone the bot may give out: only a real number, never the fictional placeholder. */
export const contactPhone = (): string | null => (site.phone.placeholder ? null : site.phone.display);

export const objectionPlaybook = {
  bodyShop:
    'A body shop sands, fills and repaints. We do not: paintless dent repair works the metal back from behind the panel, so there is no paint and no repaint, your factory finish stays, and we come to you instead of you losing days to a shop.',
  paintSafety:
    'It does not touch your paint. We ease the metal back from behind the panel, so the factory finish stays original. If the paint is already cracked or the metal is stretched too far, we tell you before any tool touches the car.',
  waterPower:
    'For most jobs we just need access to the car. An outdoor tap and outlet nearby are helpful, but if you have neither, tell us when you book and we plan around it. We use low-water methods and keep rinse water out of storm drains.',
  haggling:
    `I can't change prices or offer discounts, but the range comes from your photos and the final price is confirmed on inspection before we start. A $${depositAmount} deposit holds your time and is credited to your final invoice.`,
  notEveryDent:
    'Not every dent can be fixed without paint. If the paint is cracked or the metal is stretched, paintless repair may not be the right fix. Send photos and we will tell you straight.',
  insuranceHandoff:
    'Insurance questions are best answered by the owners, who can also document damage and give you an estimate. I am passing this to them now.',
} as const;

export const businessFacts = {
  name: site.name,
  area: site.areaLabel,
  deposit: depositAmount,
  estimateLabel: ESTIMATE_LABEL,
  travelFeeNote: `Travel is free within ${travelFees.freeRadiusMiles} miles of our base; a fee applies farther out, up to ${travelFees.maxServiceMiles} miles.`,
  policyLines: () => policyLines(depositPolicy),
  hoursKnown: site.hours.some((h) => h.time),
};

export const OPENER_WEB = "Hi, I'm the 916 Concierge, the AI assistant for 916 Dent & Detail. Send a photo of the dent for a price range, or tell me what your car needs.";
export const AI_DISCLOSURE = "I'm the 916 Concierge, an AI assistant for 916 Dent & Detail. I can price, schedule and answer questions, and I can bring in the owners any time.";
export const HANDOFF_REPLY = "I'm sorry about that. I've passed this to the owners and they'll reach out to you directly.";
export const PAUSED_REPLY = 'The owners have your message and will follow up with you directly.';
export const COST_CAP_REPLY = "I've hit the limit for this chat, so I'm handing you to the owners. They'll follow up with you directly.";
export const ERROR_REPLY = "Sorry, I hit a snag on my end. I've flagged it for the owners, and you're welcome to try again in a minute.";
export const TOO_LONG_REPLY = "That's a lot for one message. Could you send the short version?";
export const GIBBERISH_REPLY = "I didn't catch that. Could you say it a different way? For a price, a photo of the dent helps most.";
export const ABUSE_REPLY = "I'm happy to help, but I can't continue if the conversation stays abusive. Tell me what your car needs and we'll take it from there.";
export const RATE_LIMIT_REPLY = "You're sending messages faster than I can keep up. Give me a minute and try again.";
export const LOCKED_REPLY = 'This chat is paused for now. The owners can help you directly.';

export const STOP_REPLY = `${site.name}: You're unsubscribed and will get no more texts from us. Reply START to resubscribe.`;
export const START_REPLY = `${site.name}: You're subscribed again. Text us a photo of your dent for a price range. Reply STOP to opt out, HELP for help.`;
export const HELP_REPLY = `${site.name}: Text us a photo of the dent or tell us what your car needs and we'll help you book. Reply STOP to opt out. Msg & data rates may apply.`;
