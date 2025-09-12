import RoleProtection from "@/components/RoleProtection";
import Navbar from "@/components/ui/Navbar";

export default function DashboardLayout({ children }) {
  const ProtectedLayout = RoleProtection({ 
    children, 
    allowedRoles: ["student"] 
  });
  
  return (
    <ProtectedLayout>
      <div>
        <Navbar />
        {children}
      </div>
    </ProtectedLayout>
  );
}