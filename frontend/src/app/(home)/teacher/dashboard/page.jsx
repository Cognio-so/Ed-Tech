import { redirect } from "next/navigation";
import { getTeacherDashboardData } from "./action";
import TeacherDashboardClient from "./dashboard-client";

// OPTIMIZED: This is now a Server Component - data is fetched during SSR
export default async function TeacherDashboardPage() {
  // Fetch data on the server
  const result = await getTeacherDashboardData();
  
  // Handle unauthorized or error cases
  if (!result.success) {
    if (result.error === "Unauthorized") {
      redirect("/sign-in");
    }
    
    // Return error state
  return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Dashboard</h2>
          <p className="text-muted-foreground">{result.error}</p>
              </div>
    </div>
  );
  }

  // OPTIMIZED: Pass pre-fetched data to client component
  return <TeacherDashboardClient dashboardData={result.data} />;
}