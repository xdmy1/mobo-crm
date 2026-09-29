"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormDrawer } from "@/components/form/FormDrawer";
import type { FormConfig } from "@/lib/listTypes";

export function CompanyEditButton({
  companyId,
  form,
  raw,
}: {
  companyId: number;
  form: FormConfig;
  raw: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" /> Editează
      </Button>
      <FormDrawer
        config={form}
        open={open}
        onClose={() => setOpen(false)}
        id={companyId}
        initial={raw}
      />
    </>
  );
}
