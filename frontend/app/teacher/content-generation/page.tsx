import { ContentTabs } from "./_components/content-tabs";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

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

export default async function ContentGenerationPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const { grades, subjects } = session?.user?.id
    ? await getTeacherGradesAndSubjects(session.user.id)
    : { grades: [], subjects: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Content Generation</h1>
        <p className="text-muted-foreground mt-1">
          Create and manage educational content for your students
        </p>
      </div>
      <ContentTabs initialGrades={grades} initialSubjects={subjects} />
    </div>
  );
}