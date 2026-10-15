// Kept separate so schema.ts (also imported by client code for types) never pulls in server-only modules.
export const PHOTO_PATH_RE = /^quotes\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
