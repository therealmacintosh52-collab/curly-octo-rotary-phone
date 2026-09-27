import { Inngest } from "inngest";

/**
 * One Inngest app. Locally the dev server (`pnpm inngest:dev`) discovers
 * /api/inngest; in production the Vercel integration sets INNGEST_EVENT_KEY
 * and INNGEST_SIGNING_KEY.
 */
export const inngest = new Inngest({ id: "local-audit" });
