import { StudentSidebar } from "@/components/sidebar/student-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireStudent } from "@/data/get-student";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStudent();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <StudentSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-4 rounded-3xl">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

