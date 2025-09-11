import RoleProtection from "@/components/RoleProtection";
import Navbar from "@/components/ui/Navbar";

export default function AdminLayout({ children }) {
  const ProtectedLayout = RoleProtection({ 
    children, 
    allowedRoles: ["admin"] 
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