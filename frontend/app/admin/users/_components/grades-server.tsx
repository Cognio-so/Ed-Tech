import { cache } from "react";
import prisma from "@/lib/prisma";
import { GradesTab } from "./grades-tab";

const getGrades = cache(async () => {
  return prisma.grade.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
    },
  });
});

export async function GradesServer() {
  const grades = await getGrades();
  return <GradesTab initialGrades={grades} />;
}
