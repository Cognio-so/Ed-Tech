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
      <SidebarInset className="bg-[#F5F5F7] dark:bg-[#0D0D0F]">
        <div className="flex flex-1 flex-col h-full">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

