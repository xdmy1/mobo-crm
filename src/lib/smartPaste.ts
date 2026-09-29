// „Lipește și completez eu”: scoate nume, telefon și email dintr-un text oarecare
// (un mesaj de pe Viber/Instagram, o semnătură de email, o notiță dictată).

export interface ParsedContact {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

const NOISE = /^(salut|buna|bună|ziua|seara|dimineata|dimineața|numele|nume|ma|mă|numesc|sunt|eu|tel|telefon|telefonul|nr|numar|număr|email|mail|mobil|contact|client|clientul|dl|dna|d-na|domnul|doamna|vreau|doresc|as|aș|dori|o|un|la|de|pentru|si|și|привет|здравствуйте|меня|зовут|я|тел|телефон)$/i;

const cap = (w: string) => w.charAt(0).toLocaleUpperCase("ro-RO") + w.slice(1).toLocaleLowerCase("ro-RO");

export function parseContactText(input: string): ParsedContact {
  let text = input.replace(/\s+/g, " ").trim();
  const out: ParsedContact = {};
  if (!text) return out;

  const email = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  if (email) {
    out.email = email[0].toLowerCase();
    text = text.replace(email[0], " ");
  }

  const phones = text.match(/\+?\d[\d\s().-]{6,}\d/g) ?? [];
  const phone = phones.find((p) => p.replace(/\D/g, "").length >= 8);
  if (phone) {
    out.phone = phone.trim();
    text = text.replace(phone, " ");
  }

  // numele: cuvintele scrise cu majusculă; dacă nu există, primele două cuvinte „curate”
  const words = text
    .split(/[\s,;:|/]+/)
    .map((w) => w.replace(/^[^\p{L}]+|[^\p{L}.-]+$/gu, ""))
    .filter((w) => /^\p{L}[\p{L}.'-]*$/u.test(w) && !NOISE.test(w));
  const capitalized = words.filter((w) => /^\p{Lu}/u.test(w));
  const pick = (capitalized.length >= 1 ? capitalized : words).slice(0, 3);
  if (pick.length) {
    out.firstName = cap(pick[0]);
    if (pick.length > 1) out.lastName = pick.slice(1).map(cap).join(" ");
  }
  return out;
}
