// Autentificare în doi pași (TOTP, RFC 6238) — compatibilă cu Google Authenticator, Authy, 1Password.
// Fără dependențe: HMAC-SHA1 din `crypto`. Secretul se ține criptat în baza de date (AES-256-GCM).

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const ISSUER = "MOBO CRM";

/* ───────────── base32 (RFC 4648, fără padding) ───────────── */

export function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/* ───────────── HOTP / TOTP ───────────── */

export function hotp(secret: Uint8Array, counter: number, digits = TOTP_DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const offset = h[h.length - 1] & 0x0f;
  const code =
    ((h[offset] & 0x7f) << 24) |
    ((h[offset + 1] & 0xff) << 16) |
    ((h[offset + 2] & 0xff) << 8) |
    (h[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, "0");
}

export function totpStep(timeMs = Date.now()): number {
  return Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);
}

export function totp(secretBase32: string, timeMs = Date.now()): string {
  return hotp(base32Decode(secretBase32), totpStep(timeMs));
}

/**
 * Verifică un cod din aplicație, tolerând ±1 pas (ceasul telefonului poate fi puțin decalat).
 * Întoarce pasul acceptat (pentru anti-reutilizare) sau null.
 */
export function verifyTotp(
  secretBase32: string,
  token: string,
  opts: { window?: number; timeMs?: number; lastStep?: number | null } = {}
): number | null {
  const t = token.replace(/\s+/g, "");
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(t)) return null;
  const secret = base32Decode(secretBase32);
  const base = totpStep(opts.timeMs ?? Date.now());
  const window = opts.window ?? 1;
  const given = Buffer.from(t);
  for (let i = -window; i <= window; i++) {
    const step = base + i;
    // un cod deja folosit nu mai deschide nimic, chiar dacă e încă în fereastră
    if (opts.lastStep != null && step <= opts.lastStep) continue;
    const candidate = Buffer.from(hotp(secret, step));
    if (candidate.length === given.length && timingSafeEqual(candidate, given)) return step;
  }
  return null;
}

/** Secret nou (160 biți, cât cere RFC 4226), în base32 — cum îl așteaptă aplicațiile de autentificare. */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

export function otpauthUrl(secretBase32: string, account: string): string {
  const label = encodeURIComponent(`${ISSUER}:${account}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/* ───────────── coduri de recuperare ───────────── */

/** „K7QX2-M9PLA” — 10 caractere din alfabetul base32, ușor de dictat la telefon. */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = base32Encode(randomBytes(10)).slice(0, 10);
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z2-7]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

export function looksLikeRecoveryCode(input: string): boolean {
  return normalizeRecoveryCode(input).length === 10;
}

/* ───────────── criptarea secretului în baza de date ───────────── */

function encryptionKey(): Buffer {
  const material =
    process.env.TOTP_SECRET_KEY ||
    process.env.SESSION_SECRET ||
    "mobo-crm-secret-schimba-ma-in-productie-minim-32ch";
  return createHash("sha256").update(`${material}:totp`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(blob: string): string {
  const [iv, tag, enc] = blob.split(".").map((s) => Buffer.from(s, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
