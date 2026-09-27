import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/*
  Tokens from "Sign in with Clover" are stored encrypted (AES-256-GCM). The
  key is derived from CLOVER_APP_SECRET, which the OAuth flow needs anyway,
  so connecting Clover never requires one more secret to manage.
*/

function key(): Buffer {
  const secret = process.env.CLOVER_APP_SECRET?.trim();
  if (!secret) throw new Error("CLOVER_APP_SECRET is not set");
  return createHash("sha256").update(`cali-tints:clover:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(packed: string): string {
  const [v, iv, tag, data] = packed.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
