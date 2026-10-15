// Owner authorization for the dealer screens. There is ONE owner guard, defined in src/lib/auth/server.ts (Phase 3 session);
// this module only re-exports it so dealer code keeps its import path. Do NOT import this file from code that unit tests load:
// it pulls in 'server-only' / next/headers.
export { requireOwner, ownerAllowed } from '@/lib/auth/server';
