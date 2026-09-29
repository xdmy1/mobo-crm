// Tipuri serializabile partajate între server (interogări) și client (tabele/formulare).

export type BadgeColor = "green" | "red" | "blue" | "gray" | "amber" | "lime";

export type Cell =
  | string
  | number
  | null
  | {
      t: string;
      href?: string;
      badge?: BadgeColor;
      sub?: string; // linie secundară mică
      /** cerc cu inițiale înaintea textului (nume de persoane) */
      avatar?: boolean;
    };

export interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
}

export interface RowData {
  id: number;
  cells: Record<string, Cell>;
  /** valorile brute pentru precompletarea formularului de editare */
  raw?: Record<string, unknown>;
  viewHref?: string;
  downloadHref?: string;
  canEdit?: boolean;
  canDelete?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface FilterDef {
  key: string;
  label: string;
  options: SelectOption[];
  multi?: boolean;
  /** filtru de tip text (ex. Prenume / Nume la Contracte) */
  text?: boolean;
}

export type FieldType =
  | "text"
  | "number"
  | "password"
  | "email"
  | "date"
  | "textarea"
  | "select"
  | "multiselect"
  | "checkbox"
  | "radio"
  | "file"
  | "tags";

export interface FormFieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: SelectOption[];
  placeholder?: string;
  help?: string;
  defaultValue?: unknown;
  accept?: string;
  multiple?: boolean;
  section?: string; // subtitlu de grup, ex. „Rechizite bancare:”
}

export interface FormConfig {
  title: string;
  entity: string;
  fields: FormFieldDef[];
  submitLabel?: string;
  /** casetă „lipește textul primit” care completează firstName / lastName / phone / email */
  smartPaste?: boolean;
  /** câmpul de telefon verificat live împotriva clienților existenți */
  dedupePhoneField?: string;
}

export interface ListResult {
  columns: ColumnDef[];
  rows: RowData[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: number;
  redirect?: string;
  downloadUrl?: string;
}
