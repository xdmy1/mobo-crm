// Tipul clientului ales la adăugarea lead-ului: persoană fizică sau juridică.
// La „juridică” se cere denumirea companiei; serverul (registry → contact.beforeSave)
// leagă clientul de compania existentă cu același nume sau o creează.

import type { FormFieldDef, SelectOption } from "@/lib/listTypes";

export const CLIENT_TYPE_OPTIONS: SelectOption[] = [
  { value: "fizica", label: "Persoană fizică" },
  { value: "juridica", label: "Persoană juridică" },
];

export function clientTypeFields(companyNames: string[]): FormFieldDef[] {
  const juridica = { field: "clientType", equals: "juridica" };
  return [
    { name: "clientType", label: "Tip client", type: "radio", options: CLIENT_TYPE_OPTIONS, defaultValue: "fizica" },
    {
      name: "companyName",
      label: "Denumirea companiei",
      type: "text",
      required: true,
      placeholder: "XYZ SRL",
      help: "Dacă firma e deja în CRM, clientul se leagă de ea; altfel se creează",
      suggestions: companyNames,
      showIf: juridica,
    },
    { name: "companyIdno", label: "IDNO", type: "text", placeholder: "1000000000000", showIf: juridica },
  ];
}
