import { Suspense } from "react";
import { AssessmentTabs } from "./_components/assessment-tabs";
import prisma from "@/lib/prisma";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

async function getTeacherGradesAndSubjects(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        grade: true,
        userGrades: {
          include: {
            grade: true,
          },
        },
        userSubjects: {
          include: {
            subject: true,
          },
        },
      },
    });

    const grades = user?.userGrades
      ? user.userGrades.map((ug) => ({
          id: ug.grade.id,
          name: ug.grade.name,
        }))
      : user?.grade
      ? [{ id: user.grade.id, name: user.grade.name }]
      : [];
    const subjects = user?.userSubjects
      ? user.userSubjects.map((us) => ({
          id: us.subject.id,
          name: us.subject.name,
        }))
      : [];

    return { grades, subjects };
  } catch (error) {
    console.error("Error fetching teacher grades and subjects:", error);
    return { grades: [], subjects: [] };
  }
}

export default async function AssessmentGenerationPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const { grades, subjects } = session?.user?.id
    ? await getTeacherGradesAndSubjects(session.user.id)
    : { grades: [], subjects: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">
          Assessment Generation
        </h1>
        <p className="text-muted-foreground mt-1">
          Create comprehensive assessments with multiple question types for your
          students
        </p>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <AssessmentTabs initialGrades={grades} initialSubjects={subjects} />
      </Suspense>
    </div>
  );
}
