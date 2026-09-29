"use client";

import { useRouter } from "next/navigation";
import { FunnelX } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { SelectOption } from "@/lib/listTypes";

export function CalendarFilters({
  stages,
  staff,
  currentStage,
  currentStaff,
  month,
}: {
  stages: SelectOption[];
  staff: SelectOption[];
  currentStage: string | null;
  currentStaff: string | null;
  month: string;
}) {
  const router = useRouter();

  const nav = (stage: string | null, staffId: string | null) => {
    const p = new URLSearchParams({ m: month });
    if (stage) p.set("stage", stage);
    if (staffId) p.set("staff", staffId);
    router.replace(`/admin/calendar?${p.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(currentStage || currentStaff) && (
        <Button variant="ghost" onClick={() => nav(null, null)}>
          <FunnelX className="h-4 w-4" /> Resetează filtrele
        </Button>
      )}
      <Select
        className="w-44"
        value={currentStage}
        onChange={(v) => nav(v, currentStaff)}
        options={stages}
        placeholder="Toate etapele"
      />
      <Select
        className="w-48"
        value={currentStaff}
        onChange={(v) => nav(currentStage, v)}
        options={staff}
        placeholder="Toți responsabilii"
      />
    </div>
  );
}
