/**
 * Același telefon scris diferit („069 123 456”, „+373 69123456”) e același client.
 * Forma canonică din baza de date: +373XXXXXXXX. Numerele din alte țări rămân cum au fost scrise.
 */
export function normalizePhone(raw?: string | null): string | null {
  const text = raw?.trim();
  if (!text) return null;
  const digits = text.replace(/[^0-9]/g, "");
  if (digits.startsWith("373") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 9) return `+373${digits.slice(1)}`;
  if (digits.length === 8) return `+373${digits}`;
  return text;
}
