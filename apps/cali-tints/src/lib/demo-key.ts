/**
 * Optional build-time fallback for DEMO_ACCESS_KEY. Stays null in the
 * repository; a demo-only deployment may overwrite this file at install
 * time (see README "Guest preview"). Never import from client code.
 */
export const BUILT_IN_DEMO_KEY: string | null = null;
