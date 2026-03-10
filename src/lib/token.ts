import crypto from "crypto";
import { nanoid } from "nanoid";

/**
 * Generate a secure random token (32 chars, URL-safe)
 */
export function generateToken(): string {
  return nanoid(32);
}

/**
 * Hash a token using SHA-256
 * Only the hash is stored in the database
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
