import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";

// Server-only. Never import this from a Client Component — it reads
// META_TOKEN_ENCRYPTION_KEY, which must stay server-side.

function getEncryptionKey(): Buffer {
  const raw = process.env.META_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("META_TOKEN_ENCRYPTION_KEY is not set");
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("META_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex chars, or base64)");
  }
  return key;
}

/** Encrypts a Meta access token for storage in meta_connections.access_token_encrypted.
 * AES-256-GCM, application-layer encryption on top of Supabase's at-rest
 * encryption and the table's service-role-only RLS — defense in depth, not
 * the only layer. Returns "iv:authTag:ciphertext", each base64. */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12); // GCM standard IV size
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptToken(encrypted: string): string {
  const key = getEncryptionKey();
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error("Malformed encrypted token");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}

type OAuthStatePayload = {
  coachId: string;
  issuedAt: number;
};

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — plenty for an OAuth redirect round trip

/** Signs an OAuth "state" param so /api/meta/callback can verify it wasn't
 * forged and hasn't expired, without needing a server-side session/DB row
 * to track it. Uses META_APP_SECRET as the signing key (already a secret
 * we hold; no need for a separate one). */
export function signOAuthState(coachId: string): string {
  const secret = process.env.META_APP_SECRET;
  if (!secret) throw new Error("META_APP_SECRET is not set");
  const payload: OAuthStatePayload = { coachId, issuedAt: Date.now() };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

/** Verifies a signed state string, returning the embedded coachId if valid
 * and unexpired, or null if forged/malformed/expired. */
export function verifyOAuthState(state: string): { coachId: string } | null {
  const secret = process.env.META_APP_SECRET;
  if (!secret) throw new Error("META_APP_SECRET is not set");

  const [payloadB64, signature] = state.split(".");
  if (!payloadB64 || !signature) return null;

  const expectedSignature = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload.coachId !== "string" || typeof payload.issuedAt !== "number") return null;
  if (Date.now() - payload.issuedAt > STATE_TTL_MS) return null;

  return { coachId: payload.coachId };
}
