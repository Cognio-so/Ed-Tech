import { TeacherSidebar } from "@/components/sidebar/teacher-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireTeacher } from "@/data/get-teacher";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTeacher();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <TeacherSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-4 rounded-3xl">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
