import "server-only";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export async function requireStudent() {
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

  if (!user || user.role !== "student") {
    redirect("/");
  }

  return session;
}

export interface StudentData {
  id: string;
  name: string;
  email: string;
  image: string | null;
  grade: { id: string; name: string } | null;
  subjects: Array<{ id: string; name: string }>;
}

export async function getStudentData(): Promise<StudentData | null> {
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
        userSubjects: {
          include: {
            subject: true,
          },
        },
      },
    });

    if (!user || user.role !== "student") {
      return null;
    }

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
      subjects,
    };
  } catch (error) {
    return null;
  }
}
