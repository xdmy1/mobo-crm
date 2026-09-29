import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateSecret,
  hashRecoveryCode,
  hotp,
  otpauthUrl,
  totp,
  verifyTotp,
} from "./totp";

// vectorii de test din RFC 6238 (SHA1, secret ASCII „12345678901234567890”)
const RFC_SECRET = Buffer.from("12345678901234567890", "ascii");
const RFC_SECRET_B32 = base32Encode(RFC_SECRET);
const VECTORS: Array<[number, string]> = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"],
];

describe("base32", () => {
  it("codifică/decodifică fără pierderi", () => {
    for (let i = 0; i < 20; i++) {
      const buf = Buffer.from(Array.from({ length: i }, (_, k) => (k * 37 + i) & 255));
      expect(base32Decode(base32Encode(buf))).toEqual(buf);
    }
  });
  it("respectă RFC 4648", () => {
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Decode("mzxw6ytboi").toString()).toBe("foobar");
  });
});

describe("totp", () => {
  it("reproduce vectorii RFC 6238", () => {
    for (const [seconds, code] of VECTORS) {
      expect(totp(RFC_SECRET_B32, seconds * 1000)).toBe(code);
    }
  });
  it("hotp acceptă contoare mari", () => {
    expect(hotp(RFC_SECRET, Math.floor(20000000000 / 30))).toBe("353130");
  });
  it("verifică cu fereastră ±1 pas și respinge codurile greșite", () => {
    const now = 1111111111 * 1000;
    expect(verifyTotp(RFC_SECRET_B32, "050471", { timeMs: now })).not.toBeNull();
    // codul pasului precedent (t=1111111109 e în pasul anterior)
    expect(verifyTotp(RFC_SECRET_B32, "081804", { timeMs: now })).not.toBeNull();
    expect(verifyTotp(RFC_SECRET_B32, "000000", { timeMs: now })).toBeNull();
    expect(verifyTotp(RFC_SECRET_B32, "05047", { timeMs: now })).toBeNull();
    expect(verifyTotp(RFC_SECRET_B32, "abc123", { timeMs: now })).toBeNull();
  });
  it("nu acceptă același cod de două ori (anti-reutilizare)", () => {
    const now = 1111111111 * 1000;
    const step = verifyTotp(RFC_SECRET_B32, "050471", { timeMs: now });
    expect(step).not.toBeNull();
    expect(verifyTotp(RFC_SECRET_B32, "050471", { timeMs: now, lastStep: step })).toBeNull();
  });
  it("secretul generat are 160 biți și un URL otpauth valid", () => {
    const s = generateSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    const url = otpauthUrl(s, "admin");
    expect(url.startsWith("otpauth://totp/MOBO%20CRM%3Aadmin?")).toBe(true);
    expect(url).toContain(`secret=${s}`);
    expect(url).toContain("issuer=MOBO+CRM");
  });
});

describe("coduri de recuperare și criptare", () => {
  it("codurile sunt unice, în formatul XXXXX-XXXXX, iar hash-ul ignoră formatarea", () => {
    const codes = generateRecoveryCodes(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) expect(c).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
    expect(hashRecoveryCode(codes[0])).toBe(hashRecoveryCode(codes[0].toLowerCase().replace("-", " ")));
  });
  it("secretul criptat se decriptează identic și diferă la fiecare criptare (IV aleator)", () => {
    const s = generateSecret();
    const a = encryptSecret(s);
    const b = encryptSecret(s);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(s);
    expect(decryptSecret(b)).toBe(s);
  });
});
