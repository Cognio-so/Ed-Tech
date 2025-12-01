import { cache } from "react";
import { getAllUsers } from "@/data/get-all-users";
import { UsersPageClient } from "./users-page-client";
import prisma from "@/lib/prisma";

const getCachedUsers = cache(
  async (roleFilter?: string, searchQuery?: string) => {
    return getAllUsers(roleFilter, searchQuery);
  }
);

const getCachedGrades = cache(async () => {
  return prisma.grade.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });
});

const getCachedSubjects = cache(async () => {
  return prisma.subject.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });
});

interface UsersServerProps {
  roleFilter: string;
  searchQuery: string;
}

export async function UsersServer({
  roleFilter,
  searchQuery,
}: UsersServerProps) {
  const [users, grades, subjects] = await Promise.all([
    getCachedUsers(
      roleFilter !== "all" ? roleFilter : undefined,
      searchQuery || undefined
    ),
    getCachedGrades(),
    getCachedSubjects(),
  ]);

  return (
    <UsersPageClient initialUsers={users} grades={grades} subjects={subjects} />
  );
}
