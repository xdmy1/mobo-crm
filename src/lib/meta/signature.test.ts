import { describe, expect, it } from "vitest";
import { signMetaBody, verifyMetaSignature } from "./signature";

const SECRET = "app-secret-de-test";
const BODY = JSON.stringify({ object: "page", entry: [{ id: "1", changes: [] }] });

describe("verifyMetaSignature", () => {
  it("acceptă semnătura corectă", () => {
    expect(verifyMetaSignature(BODY, signMetaBody(BODY, SECRET), SECRET)).toBe(true);
  });
  it("acceptă și body-ul ca octeți (Buffer), nu doar ca string", () => {
    const bytes = Buffer.from(BODY, "utf8");
    expect(verifyMetaSignature(bytes, signMetaBody(BODY, SECRET), SECRET)).toBe(true);
  });
  it("respinge un body modificat", () => {
    expect(verifyMetaSignature(BODY + " ", signMetaBody(BODY, SECRET), SECRET)).toBe(false);
  });
  it("respinge semnătura făcută cu alt secret", () => {
    expect(verifyMetaSignature(BODY, signMetaBody(BODY, "altul"), SECRET)).toBe(false);
  });
  it("respinge antete lipsă sau cu alt format (sha1=, hex scurt)", () => {
    expect(verifyMetaSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyMetaSignature(BODY, "", SECRET)).toBe(false);
    expect(verifyMetaSignature(BODY, "sha1=abcdef", SECRET)).toBe(false);
    expect(verifyMetaSignature(BODY, "sha256=abcdef", SECRET)).toBe(false);
  });
  it("nu validează nimic fără App Secret configurat", () => {
    expect(verifyMetaSignature(BODY, signMetaBody(BODY, SECRET), undefined)).toBe(false);
    expect(verifyMetaSignature(BODY, signMetaBody(BODY, ""), "")).toBe(false);
  });
});
