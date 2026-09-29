import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getList, type ListParams } from "@/server/lists";
import { productCategoryOptions } from "@/server/options";
import { ListShell } from "@/components/table/ListShell";
import type { FormConfig } from "@/lib/listTypes";

export const metadata = { title: "Produse — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  const params = await searchParams;
  const [list, categories, subcats] = await Promise.all([
    getList("product", params),
    productCategoryOptions(),
    prisma.product.findMany({
      where: { subcategory: { not: null } },
      select: { subcategory: true },
      distinct: ["subcategory"],
    }),
  ]);

  const form: FormConfig = {
    title: "Creează Produs",
    entity: "product",
    fields: [
      {
        name: "name",
        label: "Nume produs",
        type: "text",
        required: true,
        help: "Denumirea afișată în catalog și estimări",
      },
      { name: "subcategory", label: "Subcategorie", type: "text" },
      {
        name: "unit",
        label: "Unitate de măsură",
        type: "select",
        options: [
          { value: "M2", label: "M2" },
          { value: "ML", label: "M/L" },
          { value: "BUC", label: "Bucată" },
        ],
        defaultValue: "BUC",
      },
      {
        name: "pricePerUnit",
        label: "Preț per unitate (MDL)",
        type: "number",
        placeholder: "10000",
      },
      {
        name: "categoryIds",
        label: "Categorie produs",
        type: "multiselect",
        required: true,
        options: categories,
      },
      { name: "sku", label: "Cod SKU", type: "text" },
      { name: "supplier", label: "Furnizor", type: "text" },
    ],
  };

  return (
    <ListShell
      entity="product"
      title="Produse"
      {...list}
      filters={[
        { key: "category", label: "Filtrează după categorie", options: categories },
        {
          key: "subcategory",
          label: "Filtrează după subcategorie",
          options: subcats
            .filter((s) => s.subcategory)
            .map((s) => ({ value: s.subcategory!, label: s.subcategory! })),
        },
      ]}
      createForm={form}
      createLabel="Creează Produs"
      editForm={form}
    />
  );
}
