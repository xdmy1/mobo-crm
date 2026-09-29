// Fabrică server-side pentru paginile de nomenclator din Setup.

import { getList, type ListParams } from "@/server/lists";
import { ListShell } from "@/components/table/ListShell";
import type { FormConfig, FormFieldDef } from "@/lib/listTypes";

export async function NomenclaturePage({
  entity,
  title,
  createLabel,
  fields,
  searchParams,
}: {
  entity: string;
  title: string;
  createLabel: string;
  fields?: FormFieldDef[];
  searchParams: ListParams;
}) {
  const list = await getList(entity, searchParams);
  const form: FormConfig = {
    title: createLabel,
    entity,
    fields: fields ?? [{ name: "name", label: "Nume", type: "text", required: true }],
  };
  return (
    <ListShell
      entity={entity}
      title={title}
      {...list}
      createForm={form}
      createLabel={createLabel}
      editForm={form}
    />
  );
}
