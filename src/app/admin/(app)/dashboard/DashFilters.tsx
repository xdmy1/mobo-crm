"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import type { SelectOption } from "@/lib/listTypes";

export function DashFilters({ staff }: { staff: SelectOption[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  const set = (updates: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (!v) p.delete(k);
      else p.set(k, v);
    }
    router.replace(`/admin/dashboard?${p.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        compact
        className="w-28"
        allowClear={false}
        value={sp.get("period") ?? "30d"}
        onChange={(v) => set({ period: v, from: null, to: null })}
        options={[
          { value: "1d", label: "1 zi" },
          { value: "7d", label: "7 zile" },
          { value: "30d", label: "30 zile" },
          { value: "1y", label: "1 an" },
        ]}
      />
      <Input
        type="date"
        className="w-36 h-8 text-xs"
        value={sp.get("from") ?? ""}
        onChange={(e) => set({ from: e.target.value || null })}
      />
      <span className="text-muted text-xs">→</span>
      <Input
        type="date"
        className="w-36 h-8 text-xs"
        value={sp.get("to") ?? ""}
        onChange={(e) => set({ to: e.target.value || null })}
      />
      <Select
        compact
        className="w-44"
        value={sp.get("staff")}
        onChange={(v) => set({ staff: v })}
        options={staff}
        placeholder="General"
      />
    </div>
  );
}
