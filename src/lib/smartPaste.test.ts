import { describe, expect, it } from "vitest";
import { parseContactText } from "./smartPaste";
import { normalizePhone } from "./phone";

describe("parseContactText", () => {
  it("scoate nume, telefon și email dintr-un mesaj obișnuit", () => {
    expect(parseContactText("Bună ziua, sunt Ion Popescu, tel 069 123 456, ion.popescu@mail.md")).toEqual({
      firstName: "Ion",
      lastName: "Popescu",
      phone: "069 123 456",
      email: "ion.popescu@mail.md",
    });
  });

  it("înțelege +373 și nume scrise cu litere mici", () => {
    const p = parseContactText("maria rusu +373 (79) 555-123");
    expect(p.firstName).toBe("Maria");
    expect(p.lastName).toBe("Rusu");
    expect(normalizePhone(p.phone)).toBe("+37379555123");
  });

  it("nume în chirilice", () => {
    const p = parseContactText("Меня зовут Андрей Чобану 078123456");
    expect(p.firstName).toBe("Андрей");
    expect(p.lastName).toBe("Чобану");
  });

  it("text gol sau fără date nu inventează nimic", () => {
    expect(parseContactText("   ")).toEqual({});
    expect(parseContactText("12").phone).toBeUndefined();
  });
});

describe("normalizePhone", () => {
  it("același număr, scris diferit, are aceeași formă", () => {
    for (const raw of ["069123456", "069 123 456", "+373 69 123 456", "373-69-123-456", "69123456"])
      expect(normalizePhone(raw)).toBe("+37369123456");
  });
  it("numerele din alte țări rămân cum au fost scrise", () => {
    expect(normalizePhone("+40 721 000 111")).toBe("+40 721 000 111");
  });
});
