import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { IdentityServiceFailure } from "./identity.contracts.js";

export const createTokenEncrypter = (key: Buffer | null) => {
  const encryptToken = (token: string): string => {
    if (!key || key.byteLength !== 32) throw new IdentityServiceFailure("storage_unavailable");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
  };

  const decryptToken = (value: string): string => {
    if (!key || key.byteLength !== 32) throw new IdentityServiceFailure("storage_unavailable");
    const [ivText, tagText, ciphertextText] = value.split(".");
    if (!ivText || !tagText || !ciphertextText) throw new IdentityServiceFailure("storage_unavailable");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, "base64url")),
      decipher.final()
    ]).toString("utf8");
  };

  return { encryptToken, decryptToken };
};

export const createRateKeyHasher = (rateLimitKey: string) => {
  return (kind: "email" | "ip" | "request", value: string): string =>
    createHmac("sha256", rateLimitKey).update(`${kind}:${value}`).digest("hex");
};
