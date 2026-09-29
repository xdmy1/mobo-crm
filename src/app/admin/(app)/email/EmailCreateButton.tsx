"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormDrawer } from "@/components/form/FormDrawer";
import { sendCrmEmail } from "@/server/actions/emails";
import type { FormConfig, SelectOption } from "@/lib/listTypes";

export function EmailCreateButton({
  contacts,
  companies,
  opportunities,
  quotes,
}: {
  contacts: SelectOption[];
  companies: SelectOption[];
  opportunities: SelectOption[];
  quotes: SelectOption[];
}) {
  const [open, setOpen] = useState(false);

  const form: FormConfig = {
    title: "Creează Email",
    entity: "email",
    submitLabel: "Trimite",
    fields: [
      { name: "to", label: "Destinatar (email)", type: "email", required: true },
      { name: "subject", label: "Subiect", type: "text", required: true },
      { name: "body", label: "Corp", type: "textarea", required: true },
      { name: "contactId", label: "Client", type: "select", options: contacts },
      { name: "companyId", label: "Persoană juridică", type: "select", options: companies },
      { name: "opportunityId", label: "Proiect", type: "select", options: opportunities },
      { name: "quoteId", label: "Estimare", type: "select", options: quotes },
    ],
  };

  return (
    <>
      <Button variant="create" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Creează Email
      </Button>
      <FormDrawer
        config={form}
        open={open}
        onClose={() => setOpen(false)}
        action={sendCrmEmail}
      />
    </>
  );
}
