import type { FormConfig, SelectOption } from "@/lib/listTypes";

export function companyFormConfig(
  types: SelectOption[],
  industries: SelectOption[]
): FormConfig {
  return {
    title: "Creează Persoană Juridică",
    entity: "company",
    fields: [
      { name: "name", label: "Nume persoană juridică", type: "text", required: true, placeholder: "XYZ SRL", help: "Denumirea oficială a companiei" },
      { name: "adminName", label: "Nume administrator", type: "text", placeholder: "Administrator" },
      { name: "phone", label: "Număr de contact", type: "text", placeholder: "+373 22 000 000" },
      { name: "email", label: "Email", type: "email", placeholder: "office@companie.md" },
      { name: "idno", label: "IDNO", type: "text", placeholder: "1000000000000" },
      { name: "vatCode", label: "Cod TVA", type: "text" },
      { name: "iban", label: "IBAN", type: "text", placeholder: "MD77AG000000000000000000", section: "Rechizite bancare:" },
      { name: "bic", label: "BIC", type: "text", placeholder: "AGRNMD2X" },
      { name: "bankName", label: "Denumirea băncii", type: "text", placeholder: "MICB" },
      { name: "legalStreet", label: "Strada sediului juridic", type: "text", section: "Sediul juridic:" },
      { name: "legalCity", label: "Orașul sediului juridic", type: "text" },
      { name: "legalZip", label: "Codul poștal al sediului juridic", type: "text" },
      { name: "officeStreet", label: "Strada oficiului", type: "text", section: "Oficiu:" },
      { name: "officeCity", label: "Orașul oficiului", type: "text" },
      { name: "officeZip", label: "Codul poștal al oficiului", type: "text" },
      { name: "typeId", label: "Tip companie", type: "select", options: types, section: "Alte detalii:" },
      { name: "industryId", label: "Industrie", type: "select", options: industries },
      { name: "size", label: "Mărimea (nr. angajați)", type: "text" },
      { name: "annualRevenue", label: "Venituri anuale", type: "number" },
    ],
  };
}
