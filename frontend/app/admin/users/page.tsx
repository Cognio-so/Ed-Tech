import { Suspense } from "react";
import { getAllUsers } from "@/data/get-all-users";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersPageClient } from "./_components/users-page-client";
import { DataTableSkeleton } from "../_components/loading-skeletons";
import prisma from "@/lib/prisma";
import { SubjectsTab } from "./_components/subjects-tab";
import { GradesTab } from "./_components/grades-tab";
import InviteMember from "../teams/_components/invite-member";

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

  // Fetch users with SSR for better performance
  const users = await getAllUsers(
    roleFilter !== "all" ? roleFilter : undefined,
    searchQuery || undefined
  );

  // Fetch grades and subjects
  const [grades, subjects] = await Promise.all([
    prisma.grade.findMany({ orderBy: { name: "asc" } }),
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users Management</h1>
          <p className="text-muted-foreground">
            Manage users, subjects, and grades
          </p>
        </div>
        <InviteMember />
      </div>

      <Tabs defaultValue={activeTab} className="w-full">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="grades">Grades</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Suspense fallback={<DataTableSkeleton />}>
            <UsersPageClient
              initialUsers={users}
              grades={grades}
              subjects={subjects}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="subjects" className="mt-4">
          <Suspense fallback={<div>Loading subjects...</div>}>
            <SubjectsTab initialSubjects={subjects} />
          </Suspense>
        </TabsContent>

        <TabsContent value="grades" className="mt-4">
          <Suspense fallback={<div>Loading grades...</div>}>
            <GradesTab initialGrades={grades} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
