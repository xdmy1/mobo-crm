import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { financeAccess, financeLockedMessage } from "@/lib/financeAccess";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** Backup complet al bazei de date în JSON, dintr-un click [NOU]. Doar admin. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin)
    return NextResponse.json({ error: "Doar administratorul poate face backup." }, { status: 403 });
  // backup-ul conține plăți, finanțe per contract și tranzacții: cere stratul financiar deblocat
  const access = await financeAccess(user, "readAll-finances");
  if (!access.allowed)
    return NextResponse.json({ error: `Backup-ul conține date financiare. ${financeLockedMessage(access)}` }, { status: 403 });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const tables: Record<string, string> = {
    staff: "staff", departments: "department", designations: "designation",
    employmentStatuses: "employmentStatus", shifts: "shift", roles: "role",
    permissions: "permission", rolePermissions: "rolePermission",
    contactStages: "contactStage", contactSources: "contactSource",
    failureCauses: "failureCause", productionSequences: "productionSequence",
    contacts: "contact", contactStageHistory: "contactStageHistory",
    roomTypes: "roomType", rooms: "room",
    opportunityStages: "opportunityStage", opportunityTypes: "opportunityType",
    opportunitySources: "opportunitySource", opportunities: "opportunity",
    opportunityStageHistory: "opportunityStageHistory",
    quoteStages: "quoteStage", quotes: "quote", quoteVersions: "quoteVersion",
    productCategories: "productCategory", products: "product",
    productOnCategories: "productOnCategory",
    companyTypes: "companyType", industries: "industry", companies: "company",
    contracts: "contract", contractRooms: "contractRoom",
    contractOpportunities: "contractOpportunity", offers: "offer",
    contractFinances: "contractFinance", payments: "payment",
    notes: "note", attachments: "attachment",
    taskTypes: "taskType", taskStatuses: "taskStatus", taskPriorities: "taskPriority",
    tasks: "task", emails: "email", emailConfigs: "emailConfig",
    accounts: "account", transactions: "transaction",
    announcements: "announcement", awards: "award",
    partners: "partner", designerPartners: "designerPartner",
    organizations: "organization", calcCatalogs: "calcCatalog",
    notifications: "notification", auditLogs: "auditLog",
  };

  const dump: Record<string, unknown> = {
    _meta: {
      app: "MOBO CRM",
      exportedAt: new Date().toISOString(),
      exportedBy: user.username,
      note: "Backup JSON — pentru restaurare completă folosiți și pg_dump + folderul uploads/",
    },
  };
  for (const [key, model] of Object.entries(tables)) {
    try {
      dump[key] = await (prisma as any)[model].findMany();
    } catch {
      dump[key] = [];
    }
  }

  // fără hash-uri de parole și date SMTP sensibile în export
  if (Array.isArray(dump.staff)) {
    dump.staff = (dump.staff as Array<Record<string, unknown>>).map((s) => ({
      ...s,
      passwordHash: "***",
    }));
  }
  if (Array.isArray(dump.emailConfigs)) {
    dump.emailConfigs = (dump.emailConfigs as Array<Record<string, unknown>>).map(
      (c) => ({ ...c, pass: "***" })
    );
  }

  await audit(user.id, "backup", "database");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return new NextResponse(JSON.stringify(dump, null, 1), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mobo-backup-${stamp}.json"`,
    },
  });
}
