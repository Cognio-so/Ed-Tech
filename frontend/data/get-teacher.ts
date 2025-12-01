import "server-only";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export async function requireTeacher() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
    },
  });

  if (!user || user.role !== "teacher") {
    redirect("/");
  }

  return session;
}

export interface TeacherData {
  id: string;
  name: string;
  email: string;
  image: string | null;
  grade: { id: string; name: string } | null;
  grades: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string }>;
}

export async function getTeacherData(): Promise<TeacherData | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
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

    if (!user || user.role !== "teacher") {
      return null;
    }

    const grades = user.userGrades
      ? user.userGrades.map((ug) => ({
          id: ug.grade.id,
          name: ug.grade.name,
        }))
      : user.grade
      ? [{ id: user.grade.id, name: user.grade.name }]
      : [];

    const subjects = user.userSubjects.map((us) => ({
      id: us.subject.id,
      name: us.subject.name,
    }));

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      grade: user.grade ? { id: user.grade.id, name: user.grade.name } : null,
      grades,
      subjects,
    };
  } catch (error) {
    console.error("Error fetching teacher data:", error);
    return null;
  }
}