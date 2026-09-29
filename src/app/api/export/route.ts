import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth";
import { financeAccess, financeLockedMessage } from "@/lib/financeAccess";
import { getList, type ListParams } from "@/server/lists";
import type { Cell } from "@/lib/listTypes";

export const runtime = "nodejs";

function cellText(c: Cell): string {
  if (c === null || c === undefined) return "";
  if (typeof c === "string" || typeof c === "number") return String(c);
  return c.sub ? `${c.t} (${c.sub})` : c.t;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Neautentificat" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const entity = sp.get("entity");
  if (!entity) return NextResponse.json({ error: "Lipsește entitatea" }, { status: 400 });
  if (entity === "transaction") {
    const access = await financeAccess(user, "readAll-transaction");
    if (!access.allowed) return NextResponse.json({ error: financeLockedMessage(access) }, { status: 403 });
  }
  const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";

  const params: ListParams = { pageSize: "100000", page: "1" };
  sp.forEach((v, k) => {
    if (k !== "entity" && k !== "format") params[k] = v;
  });

  let list;
  try {
    list = await getList(entity, params);
  } catch {
    return NextResponse.json({ error: "Entitate necunoscută" }, { status: 400 });
  }

  const header = list.columns.map((c) => c.label);
  const data = list.rows.map((r) =>
    list.columns.map((c) => cellText(r.cells[c.key] ?? null))
  );

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "xlsx") {
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, entity.slice(0, 30));
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${entity}-${stamp}.xlsx"`,
      },
    });
  }

  const esc = (s: string) =>
    /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const csv =
    "﻿" +
    [header, ...data].map((row) => row.map(esc).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${entity}-${stamp}.csv"`,
    },
  });
}
