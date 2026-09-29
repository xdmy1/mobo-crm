import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtDateTime, EMPTY } from "@/lib/format";
import { personName, contactLabel } from "@/lib/people";
import { taskStatus, taskPriority } from "@/lib/status";
import { staffOptions } from "@/server/options";
import { Card, Badge, Empty } from "@/components/ui/Misc";
import { TaskComments } from "./TaskComments";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const taskId = parseInt(id, 10);
  if (isNaN(taskId)) notFound();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: true,
      type: true,
      status: true,
      priority: true,
      opportunity: true,
      contact: true,
      notes: { orderBy: { createdAt: "asc" }, include: { author: true } },
    },
  });
  if (!task) notFound();

  const staff = await staffOptions();
  // aceeași etichetă RO + culoare ca în lista de sarcini
  const prio = taskPriority(task.priority?.name);
  const status = taskStatus(task.status?.name);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        back={{ href: "/admin/task", label: "Înapoi la sarcini" }}
        title={task.name}
        subtitle={`Sarcină · creată ${fmtDateTime(task.createdAt)}`}
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {prio && <Badge color={prio.color}>{prio.label}</Badge>}
          {status && <Badge color={status.color}>{status.label}</Badge>}
          {task.type && <Badge>{task.type.name}</Badge>}
        </div>
        <dl className="mt-5 grid gap-x-8 gap-y-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Responsabil (asignat)</dt>
            <dd className="font-medium">
              {personName(task.assignee)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Termen</dt>
            <dd className="font-medium">{fmtDate(task.dueDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Proiect</dt>
            <dd className="font-medium">
              {task.opportunity ? (
                <Link
                  href={`/admin/opportunity/${task.opportunity.id}`}
                  className="underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  {task.opportunity.name}
                </Link>
              ) : (
                EMPTY
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Client</dt>
            <dd className="font-medium">
              {task.contact ? (
                <Link
                  href={`/admin/contact/${task.contact.id}`}
                  className="underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  {contactLabel(task.contact)}
                </Link>
              ) : (
                EMPTY
              )}
            </dd>
          </div>
        </dl>
        {task.description && (
          <p className="mt-4 rounded-lg bg-subtle/60 px-3 py-2 text-sm">
            {task.description}
          </p>
        )}
      </Card>

      <Card title="Mesaje / comentarii">
        {task.notes.length === 0 && <Empty compact text="Niciun comentariu" />}
        <ul className="space-y-3">
          {task.notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border px-3 py-2">
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="font-medium text-foreground">
                  {personName(n.author)}
                </span>
                <span>{fmtDateTime(n.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm font-semibold">{n.title}</p>
              {n.body && <p className="text-sm text-foreground/80">{n.body}</p>}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <TaskComments taskId={task.id} staff={staff} />
        </div>
      </Card>
    </div>
  );
}
