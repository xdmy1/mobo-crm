"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormDrawer } from "@/components/form/FormDrawer";
import type { FormConfig, SelectOption } from "@/lib/listTypes";

/**
 * „Planifică” — creează o sarcină cu dată (întâlnire, contractare, măsurare, livrare…) direct din calendar.
 * Se deschide și singur când URL-ul are `new=YYYY-MM-DD` (clic pe „+” dintr-o zi a grilei).
 */
export function PlanButton({
  options,
  defaults,
  today,
  requestedDay,
  clearHref,
}: {
  options: {
    staff: SelectOption[];
    types: SelectOption[];
    contacts: SelectOption[];
    opportunities: SelectOption[];
  };
  defaults: { userId: string; typeId?: string; statusId?: string; priorityId?: string };
  today: string;
  /** ziua aleasă din grilă (parametrul `new`), dacă există */
  requestedDay: string | null;
  /** același URL fără `new` — la închidere nu lăsăm formularul să se redeschidă la refresh */
  clearHref: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!requestedDay);
  const [day, setDay] = useState(requestedDay ?? today);

  useEffect(() => {
    if (requestedDay) {
      setDay(requestedDay);
      setOpen(true);
    }
  }, [requestedDay]);

  // obiect stabil: FormDrawer își reia valorile de fiecare dată când `initial` se schimbă
  const initial = useMemo(() => ({ dueDate: day }), [day]);

  const close = () => {
    setOpen(false);
    if (requestedDay) router.replace(clearHref);
  };

  const form: FormConfig = {
    title: "Planifică",
    entity: "task",
    submitLabel: "Planifică",
    fields: [
      {
        name: "typeId",
        label: "Ce planifici",
        type: "select",
        options: options.types,
        required: true,
        defaultValue: defaults.typeId,
      },
      { name: "dueDate", label: "Data", type: "date", required: true },
      {
        name: "name",
        label: "Titlu",
        type: "text",
        required: true,
        placeholder: "ex. Întâlnire la showroom, 10:00",
      },
      { name: "contactId", label: "Client", type: "select", options: options.contacts },
      { name: "opportunityId", label: "Proiect", type: "select", options: options.opportunities },
      {
        name: "assigneeId",
        label: "Responsabil",
        type: "select",
        options: options.staff,
        defaultValue: defaults.userId,
      },
      { name: "description", label: "Detalii", type: "textarea" },
    ],
  };

  return (
    <>
      <Button
        onClick={() => {
          setDay(today);
          setOpen(true);
        }}
      >
        <CalendarPlus className="h-4 w-4" /> Planifică
      </Button>
      <FormDrawer
        config={form}
        open={open}
        onClose={close}
        initial={initial}
        extraValues={{
          ...(defaults.statusId ? { statusId: defaults.statusId } : {}),
          ...(defaults.priorityId ? { priorityId: defaults.priorityId } : {}),
        }}
      />
    </>
  );
}
