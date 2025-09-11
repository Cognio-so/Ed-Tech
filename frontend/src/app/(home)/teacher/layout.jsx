import RoleProtection from "@/components/RoleProtection";
import { TeacherSidebar } from "@/components/sidebar/teacher-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default async function TeacherLayout({ children }) {
  const ProtectedLayout = RoleProtection({ 
    children: (
      <SidebarProvider> 
          <TeacherSidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
      </SidebarProvider>
    ), 
    allowedRoles: ["teacher"] 
  });
  
  return <ProtectedLayout />;
}