"use server";

// CRUD generic pentru entitățile din registru + restore (undo) [NOU].

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getCurrentUser, can } from "@/lib/auth";
import { FINANCE_MODULES, financeAccess, financeLockedMessage } from "@/lib/financeAccess";
import { coerce, REGISTRY } from "@/server/registry";
import type { ActionResult } from "@/lib/listTypes";

/* eslint-disable @typescript-eslint/no-explicit-any */
function model(name: string): any {
  return (prisma as any)[name];
}

export async function saveRecord(
  entity: string,
  id: number | null,
  values: Record<string, unknown>
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  const cfg = REGISTRY[entity];
  if (!cfg) return { ok: false, error: `Entitate necunoscută: ${entity}` };
  const perm = id ? `update-${cfg.module}` : `create-${cfg.module}`;
  if (!can(user, perm)) return { ok: false, error: "Nu ai permisiunea necesară." };
  if (FINANCE_MODULES.has(cfg.module)) {
    const access = await financeAccess(user, perm);
    if (!access.allowed) return { ok: false, error: financeLockedMessage(access) };
  }

  try {
    let data: Record<string, unknown> = {};
    for (const [field, kind] of Object.entries(cfg.fields)) {
      if (field in values) data[field] = coerce(kind, values[field]);
    }
    // păstrează valorile speciale (ex. categoryIds, password) pentru hooks
    const merged: Record<string, unknown> = { ...values, ...data };
    if (cfg.beforeSave) {
      const out = await cfg.beforeSave(merged, user.id, !id);
      // recopiază câmpurile whitelisted + cele setate de hook care există în model
      data = {};
      for (const [field, kind] of Object.entries(cfg.fields)) {
        if (field in out) data[field] = coerce(kind, out[field]);
      }
      for (const extra of ["passwordHash", "authorId", "staffId"]) {
        if (out[extra] !== undefined) data[extra] = out[extra];
      }
      Object.assign(merged, out);
    }

    // la creare, nu trimite null pe câmpuri absente (lasă default-urile Prisma)
    if (!id) {
      for (const k of Object.keys(data)) {
        if (data[k] === null && !(k in values)) delete data[k];
      }
    }

    let recordId = id;
    if (id) {
      await model(cfg.model).update({ where: { id }, data });
    } else {
      const created = await model(cfg.model).create({ data });
      recordId = created.id;
    }
    if (cfg.afterSave && recordId) {
      await cfg.afterSave(recordId, merged, user.id, !id);
    }
    await audit(user.id, id ? "update" : "create", entity, recordId);
    revalidatePath("/admin", "layout");
    return { ok: true, id: recordId ?? undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Eroare la salvare";
    if (msg.includes("Unique constraint")) {
      return { ok: false, error: "Există deja o înregistrare cu aceste date (constrângere unică)." };
    }
    return { ok: false, error: msg };
  }
}

export async function deleteRecords(
  entity: string,
  ids: number[]
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  const cfg = REGISTRY[entity];
  if (!cfg) return { ok: false, error: `Entitate necunoscută: ${entity}` };
  if (!can(user, `delete-${cfg.module}`))
    return { ok: false, error: "Nu ai permisiunea necesară." };
  if (FINANCE_MODULES.has(cfg.module)) {
    const access = await financeAccess(user, `delete-${cfg.module}`);
    if (!access.allowed) return { ok: false, error: financeLockedMessage(access) };
  }
  if (!ids.length) return { ok: false, error: "Nimic de șters." };

  // o cameră cu proiecte nu se șterge: proiectele ar rămâne fără cameră și n-ar mai fi găsite din fișa clientului
  if (entity === "room") {
    const projects = await prisma.opportunity.count({
      where: { roomId: { in: ids }, deletedAt: null },
    });
    if (projects > 0)
      return {
        ok: false,
        error: `Camera are ${projects} ${projects === 1 ? "proiect" : "proiecte"}. Mută sau șterge întâi proiectele.`,
      };
  }

  try {
    if (cfg.softDelete) {
      const now = new Date();
      await model(cfg.model).updateMany({
        where: { id: { in: ids } },
        data: { deletedAt: now },
      });
      // un client șters își ia și proiectele cu el — altfel rămân pe borduri și în calendar;
      // același moment pe toate, ca restaurarea clientului să le aducă înapoi doar pe acestea
      if (entity === "contact") {
        await prisma.opportunity.updateMany({
          where: { contactId: { in: ids }, deletedAt: null },
          data: { deletedAt: now },
        });
      }
    } else {
      await model(cfg.model).deleteMany({ where: { id: { in: ids } } });
    }
    await audit(user.id, "delete", entity, ids.join(","));
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Eroare la ștergere";
    if (msg.includes("Foreign key constraint")) {
      return {
        ok: false,
        error: "Nu se poate șterge: există înregistrări legate de acest element.",
      };
    }
    return { ok: false, error: msg };
  }
}

/** Restaurare după soft-delete (butonul „Anulează” din toast) [NOU]. */
export async function restoreRecords(
  entity: string,
  ids: number[]
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  const cfg = REGISTRY[entity];
  if (!cfg?.softDelete) return { ok: false, error: "Entitatea nu suportă restaurare." };
  if (entity === "contact") {
    // doar proiectele șterse odată cu clientul (același moment), nu cele șterse separat înainte
    const contacts = await prisma.contact.findMany({
      where: { id: { in: ids }, deletedAt: { not: null } },
      select: { id: true, deletedAt: true },
    });
    for (const c of contacts) {
      if (!c.deletedAt) continue;
      await prisma.opportunity.updateMany({
        where: { contactId: c.id, deletedAt: c.deletedAt },
        data: { deletedAt: null },
      });
    }
  }
  await model(cfg.model).updateMany({
    where: { id: { in: ids } },
    data: { deletedAt: null },
  });
  await audit(user.id, "restore", entity, ids.join(","));
  revalidatePath("/admin", "layout");
  return { ok: true };
}
