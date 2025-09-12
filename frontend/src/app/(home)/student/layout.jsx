import RoleProtection from "@/components/RoleProtection";
import { StudentSidebar } from "@/components/sidebar/student-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default async function StudentLayout({ children }) { 
  const ProtectedLayout = RoleProtection({ 
    children: (
      <SidebarProvider> 
          <StudentSidebar />
          <main className="flex-1 overflow-auto p-2">
            {children}
          </main>
      </SidebarProvider>
    ), 
    allowedRoles: ["student"] 
  });
  
  return <ProtectedLayout />;
}