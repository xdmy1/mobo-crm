import { requireUser } from "@/lib/auth";
import { getList, type ListParams } from "@/server/lists";
import {
  staffOptions,
  contactOptions,
  opportunityOptions,
  taskPriorityOptions,
  taskStatusOptions,
  taskTypeOptions,
} from "@/server/options";
import { ListShell } from "@/components/table/ListShell";
import type { FormConfig } from "@/lib/listTypes";

export const metadata = { title: "Sarcini — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  const params = await searchParams;
  const [list, staff, contacts, opportunities, types, statuses, priorities] =
    await Promise.all([
      getList("task", params),
      staffOptions(),
      contactOptions(),
      opportunityOptions(),
      taskTypeOptions(),
      taskStatusOptions(),
      taskPriorityOptions(),
    ]);

  const form: FormConfig = {
    title: "Creează Sarcină",
    entity: "task",
    fields: [
      { name: "name", label: "Nume", type: "text", required: true },
      { name: "description", label: "Descriere", type: "textarea" },
      { name: "assigneeId", label: "Responsabil (asignat)", type: "select", options: staff },
      { name: "typeId", label: "Tip", type: "select", options: types },
      { name: "statusId", label: "Statusul", type: "select", options: statuses },
      { name: "priorityId", label: "Prioritate", type: "select", options: priorities },
      { name: "opportunityId", label: "Proiect", type: "select", options: opportunities },
      { name: "contactId", label: "Client", type: "select", options: contacts },
      { name: "dueDate", label: "Termen", type: "date" },
    ],
  };

  return (
    <ListShell
      entity="task"
      title="Sarcini"
      {...list}
      filters={[
        { key: "status", label: "Statusul", options: statuses },
        { key: "priority", label: "Prioritate", options: priorities },
        { key: "assignee", label: "Responsabil", options: staff },
      ]}
      createForm={form}
      createLabel="Creează Sarcină"
      editForm={form}
    />
  );
}
