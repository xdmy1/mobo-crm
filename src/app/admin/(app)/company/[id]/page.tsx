import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime, fmtLei, EMPTY } from "@/lib/format";
import { personName } from "@/lib/people";
import { companyTypeOptions, industryOptions } from "@/server/options";
import { companyFormConfig } from "@/lib/forms/company";
import { Card, Empty } from "@/components/ui/Misc";
import { CompanyEditButton } from "./CompanyEditButton";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const companyId = parseInt(id, 10);
  if (isNaN(companyId)) notFound();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      type: true,
      industry: true,
      contacts: { where: { deletedAt: null } },
      contracts: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: true } },
    },
  });
  if (!company) notFound();

  const [types, industries] = await Promise.all([
    companyTypeOptions(),
    industryOptions(),
  ]);

  const raw: Record<string, unknown> = {
    name: company.name, adminName: company.adminName, phone: company.phone,
    email: company.email, idno: company.idno, vatCode: company.vatCode,
    iban: company.iban, bic: company.bic, bankName: company.bankName,
    legalStreet: company.legalStreet, legalCity: company.legalCity, legalZip: company.legalZip,
    officeStreet: company.officeStreet, officeCity: company.officeCity, officeZip: company.officeZip,
    typeId: company.typeId ? String(company.typeId) : null,
    industryId: company.industryId ? String(company.industryId) : null,
    size: company.size, annualRevenue: company.annualRevenue,
  };

  const info: Array<[string, string | null]> = [
    ["Administrator", company.adminName],
    ["Număr de contact", company.phone],
    ["Email", company.email],
    ["IDNO", company.idno],
    ["Cod TVA", company.vatCode],
    ["IBAN", company.iban],
    ["BIC", company.bic],
    ["Banca", company.bankName],
    ["Sediul juridic", [company.legalStreet, company.legalCity, company.legalZip].filter(Boolean).join(", ") || null],
    ["Oficiu", [company.officeStreet, company.officeCity, company.officeZip].filter(Boolean).join(", ") || null],
    ["Tip companie", company.type?.name ?? null],
    ["Industrie", company.industry?.name ?? null],
    ["Mărimea", company.size],
    ["Venituri anuale", company.annualRevenue != null ? fmtLei(company.annualRevenue) : null],
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/admin/company", label: "Înapoi la persoane juridice" }}
        title={company.name}
        subtitle="Persoană juridică"
        actions={
          <CompanyEditButton
            companyId={company.id}
            form={companyFormConfig(types, industries)}
            raw={raw}
          />
        }
      />
      <Card title="Detalii companie">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {info.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 truncate text-[13px] font-medium">{v ?? <span className="font-normal text-muted/70">{EMPTY}</span>}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Contacte asociate">
          {company.contacts.length === 0 ? (
            <Empty compact />
          ) : (
            <ul className="space-y-2 text-sm">
              {company.contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <Link href={`/admin/contact/${c.id}`} className="font-medium underline-offset-4 transition-colors hover:text-primary hover:underline">
                    {personName(c)}
                  </Link>
                  <span className="text-xs text-muted">{c.phone ?? c.email ?? `#${c.humanId}`}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Contracte">
          {company.contracts.length === 0 ? (
            <Empty compact />
          ) : (
            <ul className="space-y-2 text-sm">
              {company.contracts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{c.fileName}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-muted">{fmtDateTime(c.createdAt)}</span>
                    {c.filePath && (
                      <a
                        href={`/api/files/${encodeURIComponent(c.filePath)}?download=1`}
                        className="text-xs font-medium underline-offset-4 transition-colors hover:text-primary hover:underline"
                      >
                        Descarcă
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Mesaje">
        {company.notes.length === 0 ? (
          <Empty compact />
        ) : (
          <ul className="space-y-2 text-sm">
            {company.notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-border/70 px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{n.title}</p>
                  <span className="text-xs text-muted">{fmtDateTime(n.createdAt)}</span>
                </div>
                {n.body && <p className="mt-0.5 text-foreground/80">{n.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
