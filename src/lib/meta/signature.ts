import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta semnează fiecare livrare de webhook cu HMAC-SHA256 pe body-ul brut, cheia fiind App Secret-ul
 * aplicației; antetul arată așa: `X-Hub-Signature-256: sha256=<hex>`. Comparația e în timp constant.
 */
export function verifyMetaSignature(
  rawBody: string | Uint8Array,
  header: string | null | undefined,
  appSecret: string | undefined
): boolean {
  if (!header || !appSecret) return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!m) return false;
  const got = Buffer.from(m[1], "hex");
  const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody).digest("hex"), "hex");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Antetul pe care l-ar trimite Meta pentru un body — folosit în teste și la simulări locale. */
export function signMetaBody(rawBody: string | Uint8Array, appSecret: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
}
