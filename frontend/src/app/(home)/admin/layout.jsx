import RoleProtection from "@/components/RoleProtection";
import { AdminSidebar } from "@/components/sidebar/admin-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default async function AdminLayout({ children }) { 
  const ProtectedLayout = RoleProtection({ 
    children: (
      <SidebarProvider> 
          <AdminSidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
      </SidebarProvider>
    ), 
    allowedRoles: ["admin"] 
  });
  
  return <ProtectedLayout />;
}