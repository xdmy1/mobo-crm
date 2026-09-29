import { SetupSidebar } from "./SetupSidebar";

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      <SetupSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
