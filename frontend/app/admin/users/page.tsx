import { Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTableSkeleton } from "../_components/loading-skeletons";
import InviteMember from "../teams/_components/invite-member";
import { initializeSubjectsAndGrades } from "./action";
import { UsersServer } from "./_components/users-server";
import { SubjectsServer } from "./_components/subjects-server";
import { GradesServer } from "./_components/grades-server";

// Enable dynamic rendering for search params
export const dynamic = "force-dynamic";

interface UsersPageProps {
  searchParams: Promise<{
    search?: string;
    role?: string;
    tab?: string;
  }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const params = await searchParams;
  const searchQuery = params.search || "";
  const roleFilter = params.role || "all";
  const activeTab = params.tab || "users";

  initializeSubjectsAndGrades().catch((error) => {
    console.error("Initialization error (non-blocking):", error);
  });

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Users Management
          </h1>
          <p className="text-muted-foreground">
            Manage users, subjects, and grades
          </p>
        </div>
        <InviteMember />
      </div>

      <Tabs defaultValue={activeTab} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="grades">Grades</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Suspense fallback={<DataTableSkeleton />}>
            <UsersServer roleFilter={roleFilter} searchQuery={searchQuery} />
          </Suspense>
        </TabsContent>

        <TabsContent value="subjects" className="mt-4">
          <Suspense fallback={<div className="p-4">Loading subjects...</div>}>
            <SubjectsServer />
          </Suspense>
        </TabsContent>

        <TabsContent value="grades" className="mt-4">
          <Suspense fallback={<div className="p-4">Loading grades...</div>}>
            <GradesServer />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
