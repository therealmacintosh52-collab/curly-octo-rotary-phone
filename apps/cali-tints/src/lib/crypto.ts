import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/*
  OAuth tokens for outside services (QuickBooks) are stored encrypted
  (AES-256-GCM). The key is derived from a secret the integration needs
  anyway, so connecting a service never requires one more secret to manage.
  `scope` keeps keys for different services apart.
*/

function key(secret: string, scope: string): Buffer {
  return createHash("sha256").update(`cali-tints:${scope}:${secret}`).digest();
}

export function encryptSecret(plain: string, secret: string, scope: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret, scope), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(packed: string, secret: string, scope: string): string {
  const [v, iv, tag, data] = packed.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(secret, scope), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
