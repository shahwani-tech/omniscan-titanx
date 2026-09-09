/**
 * OMNISCAN TITAN X - Cryptographic Engine
 * Industrial-strength password hashing, timing-safe verification,
 * HMAC signing, and AES-256-GCM configuration encryption.
 */

import crypto from "crypto";

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = "sha512";
const DEFAULT_SALT_BYTES = 32;

// Internal master HMAC key (derived per installation or machine seed)
let derivedMachineKey: Buffer | null = null;

function getMachineKey(): Buffer {
  if (!derivedMachineKey) {
    const rawSecret = process.env.CENTRAL_ADMIN_SECRET || "omniscan-titan-x-node-secret-seed-98214";
    derivedMachineKey = crypto.createHash("sha256").update(rawSecret).digest();
  }
  return derivedMachineKey;
}

/**
 * Hash a password using PBKDF2-HMAC-SHA512 with a cryptographically secure random 32-byte salt.
 * Returns format: $pbkdf2$<iterations>$<salt_hex>$<hash_hex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(DEFAULT_SALT_BYTES);
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEYLEN,
    PBKDF2_DIGEST
  );
  return `$pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/**
 * Timing-safe password verification against stored hash format.
 * Prevents timing attacks via crypto.timingSafeEqual.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!storedHash || !storedHash.startsWith("$pbkdf2$")) {
      return false;
    }

    const parts = storedHash.split("$");
    if (parts.length !== 5) {
      return false;
    }

    const iterations = parseInt(parts[2], 10);
    const salt = Buffer.from(parts[3], "hex");
    const originalHash = Buffer.from(parts[4], "hex");

    const computedHash = crypto.pbkdf2Sync(
      password,
      salt,
      iterations,
      originalHash.length,
      PBKDF2_DIGEST
    );

    if (computedHash.length !== originalHash.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedHash, originalHash);
  } catch (err) {
    console.error("Error during password verification:", err);
    return false;
  }
}

/**
 * Generate a cryptographically secure random identifier.
 * Example: generateSecureId("TITAN-INST", 8) => "TITAN-INST-9a2f-e81c-b430-c75d"
 */
export function generateSecureId(prefix = "TITAN", randomBytesCount = 8): string {
  const bytes = crypto.randomBytes(randomBytesCount).toString("hex");
  // Group into 4-character chunks
  const chunks = bytes.match(/.{1,4}/g) || [bytes];
  return `${prefix}-${chunks.join("-").toUpperCase()}`;
}

/**
 * Generate a secure cryptographically random session token or nonce.
 */
export function generateToken(lengthBytes = 32): string {
  return crypto.randomBytes(lengthBytes).toString("hex");
}

/**
 * Generate HMAC-SHA256 signature for data tampering detection.
 */
export function computeHmac(data: string, secretKey?: string): string {
  const key = secretKey ? Buffer.from(secretKey) : getMachineKey();
  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

/**
 * Verify HMAC-SHA256 signature in timing-safe manner.
 */
export function verifyHmac(data: string, signatureHex: string, secretKey?: string): boolean {
  try {
    const computedHex = computeHmac(data, secretKey);
    const computedBuf = Buffer.from(computedHex, "hex");
    const providedBuf = Buffer.from(signatureHex, "hex");

    if (computedBuf.length !== providedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuf, providedBuf);
  } catch {
    return false;
  }
}

/**
 * Encrypt a string using AES-256-GCM for configuration export.
 */
export function encryptPayload(plainText: string, passphrase: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(passphrase, salt, 10000, 32, "sha256");
  const iv = crypto.randomBytes(12); // GCM recommended IV 12 bytes

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    v: 1,
    s: salt.toString("hex"),
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: encrypted,
  });
}

/**
 * Decrypt a string encrypted with AES-256-GCM.
 */
export function decryptPayload(cipherJsonString: string, passphrase: string): string {
  const envelope = JSON.parse(cipherJsonString);
  const salt = Buffer.from(envelope.s, "hex");
  const iv = Buffer.from(envelope.iv, "hex");
  const tag = Buffer.from(envelope.tag, "hex");
  const dataHex = envelope.data;

  const key = crypto.pbkdf2Sync(passphrase, salt, 10000, 32, "sha256");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(dataHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
