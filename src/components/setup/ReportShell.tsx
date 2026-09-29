// Shell comun pentru rapoartele contabile (interval de date + tabel).

import { Card } from "@/components/ui/Misc";
import { fmtLei } from "@/lib/format";

export function parseRange(sp: Record<string, string | undefined>) {
  const from = sp.from ? new Date(sp.from) : undefined;
  const to = sp.to ? new Date(`${sp.to}T23:59:59`) : undefined;
  return { from, to };
}

export function RangeForm({
  from,
  to,
}: {
  from?: string;
  to?: string;
}) {
  return (
    <form className="flex flex-wrap items-end gap-2" method="get">
      <label className="text-xs text-muted">
        De la
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="mt-1 block h-8 rounded-lg border border-border bg-card px-2 text-xs"
        />
      </label>
      <label className="text-xs text-muted">
        Până la
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="mt-1 block h-8 rounded-lg border border-border bg-card px-2 text-xs"
        />
      </label>
      <button
        type="submit"
        className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-fg hover:bg-primary-hover cursor-pointer"
      >
        Aplică
      </button>
    </form>
  );
}

export function ReportTable({
  title,
  head,
  rows,
  totals,
  range,
}: {
  title: string;
  head: string[];
  rows: Array<Array<string | number>>;
  totals?: Array<string | number>;
  range: { from?: string; to?: string };
}) {
  return (
    <Card title={title} extra={<RangeForm from={range.from} to={range.to} />}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              {head.map((h, i) => (
                <th
                  key={h}
                  className={`py-2 pr-3 font-medium ${i > 0 ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border/70 last:border-0">
                {r.map((c, j) => (
                  <td key={j} className={`py-2 pr-3 ${j > 0 ? "text-right" : ""}`}>
                    {typeof c === "number" ? fmtLei(c) : c}
                  </td>
                ))}
              </tr>
            ))}
            {totals && (
              <tr className="border-t-2 border-border bg-subtle/60 font-bold">
                {totals.map((c, j) => (
                  <td key={j} className={`py-2 pr-3 ${j > 0 ? "text-right" : ""}`}>
                    {typeof c === "number" ? fmtLei(c) : c}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
