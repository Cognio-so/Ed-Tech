import { cache } from "react";
import prisma from "@/lib/prisma";
import { SubjectsTab } from "./subjects-tab";

const getSubjects = cache(async () => {
  return prisma.subject.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
    },
  });
});

export async function SubjectsServer() {
  const subjects = await getSubjects();
  return <SubjectsTab initialSubjects={subjects} />;
}
