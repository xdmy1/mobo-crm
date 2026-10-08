"use client";

import { useRouter } from "next/navigation";
import { FunnelX } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { SelectOption } from "@/lib/listTypes";

export function CalendarFilters({
  types,
  staff,
  currentType,
  currentStaff,
  month,
}: {
  types: SelectOption[];
  staff: SelectOption[];
  currentType: string | null;
  currentStaff: string | null;
  month: string;
}) {
  const router = useRouter();

  const nav = (type: string | null, staffId: string | null) => {
    const p = new URLSearchParams({ m: month });
    if (type) p.set("type", type);
    if (staffId) p.set("staff", staffId);
    router.replace(`/admin/calendar?${p.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(currentType || currentStaff) && (
        <Button variant="ghost" onClick={() => nav(null, null)}>
          <FunnelX className="h-4 w-4" /> Resetează filtrele
        </Button>
      )}
      <Select
        className="w-44"
        value={currentType}
        onChange={(v) => nav(v, currentStaff)}
        options={types}
        placeholder="Toate tipurile"
      />
      <Select
        className="w-48"
        value={currentStaff}
        onChange={(v) => nav(currentType, v)}
        options={staff}
        placeholder="Toți responsabilii"
      />
    </div>
  );
}
