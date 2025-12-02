import "server-only";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

export interface StudentData {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  performance: string | null;
  achievements: string | null;
  feedback: string | null;
  issues: string | null;
  image: string | null;
  createdAt: Date;
}

/**
 * Fetches all students of the same grade as the logged-in teacher.
 * Returns student data including name, grade, performance, achievements, feedback, and issues.
 *
 * @returns Array of student data with their details
 */
export async function getStudentData(): Promise<StudentData[]> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return [];
    }

    // Get the teacher's grade
    const teacher = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        gradeId: true,
      },
    });

    if (!teacher || teacher.role !== "teacher" || !teacher.gradeId) {
      return [];
    }

    const students = await prisma.user.findMany({
      where: {
        role: "student",
        gradeId: teacher.gradeId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        grade: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return students.map((student) => ({
      id: student.id,
      name: student.name,
      email: student.email,
      grade: student.grade?.name || null,
      performance: null,
      achievements: null,
      feedback: null,
      issues: null,
      image: student.image,
      createdAt: student.createdAt,
    }));
  } catch (error) {
    return [];
  }
}
