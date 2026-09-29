"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { Select } from "@/components/ui/Select";
import { QuoteWizard } from "@/components/wizard/QuoteWizard";
import type { SelectOption } from "@/lib/listTypes";
import type { CalcCatalogData } from "@/lib/calc/catalog";

export function QuoteCreateButton({
  opportunities,
  catalog,
}: {
  opportunities: SelectOption[];
  catalog: CalcCatalogData;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pickOpen, setPickOpen] = useState(false);
  const [oppId, setOppId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  // ?new=1 din paleta ⌘K deschide direct selectorul de oportunitate [NOU]
  useEffect(() => {
    if (sp.get("new") === "1") {
      setPickOpen(true);
      const params = new URLSearchParams(sp.toString());
      params.delete("new");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  return (
    <>
      <Button variant="create" onClick={() => setPickOpen(true)}>
        <Plus className="h-4 w-4" /> Estimare Tehnică
      </Button>

      <Modal
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        title="Selectează Oportunitatea"
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPickOpen(false)}>
              Anulează
            </Button>
            <Button
              disabled={!oppId}
              onClick={() => {
                setPickOpen(false);
                setWizardOpen(true);
              }}
            >
              Continuă
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Alege oportunitatea pentru care creezi estimarea tehnică.
        </p>
        <Select
          value={oppId}
          onChange={setOppId}
          options={opportunities}
          placeholder="Caută oportunitate…"
        />
      </Modal>

      <Modal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title="Configurare estimare"
        width={860}
      >
        {wizardOpen && oppId && (
          <QuoteWizard
            opportunityId={parseInt(oppId, 10)}
            catalog={catalog}
            onClose={() => setWizardOpen(false)}
            onSaved={(id) => router.push(`/admin/quote/${id}`)}
          />
        )}
      </Modal>
    </>
  );
}
