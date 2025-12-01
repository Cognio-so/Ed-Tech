import "server-only";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { getStudentData } from "./get-student-data";

export interface TeacherStats {
  name: string;
  grade: string | null;
  grades: string[];
  subjects: string[];
  totalContent: number;
  totalAssessments: number;
  totalStudents: number;
  students: Array<{
    id: string;
    name: string;
    grade: string | null;
    performance: string | null;
    achievements: string | null;
    feedback: string | null;
    issues: string | null;
  }>;
}

export async function getTeacherStats(): Promise<TeacherStats | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return null;
    }

    const teacher = await prisma.user.findUnique({
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
        contents: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!teacher || teacher.role !== "teacher") {
      return null;
    }

    const totalContent = teacher.contents.length;

    const assessments = await prisma.content.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
      },
    });

    const studentsData = await getStudentData();

    const subjects = teacher.userSubjects.map((us) => us.subject.name);
    const grades = teacher.userGrades.map((ug) => ug.grade.name);

    return {
      name: teacher.name,
      grade: teacher.grade?.name || null,
      grades: grades.length > 0 ? grades : teacher.grade ? [teacher.grade.name] : [],
      subjects,
      totalContent,
      totalAssessments: assessments.length,
      totalStudents: studentsData.length,
      students: studentsData.map((student) => ({
        id: student.id,
        name: student.name,
        grade: student.grade,
        performance: student.performance,
        achievements: student.achievements,
        feedback: student.feedback,
        issues: student.issues,
      })),
    };
  } catch (error) {
    console.error("Error fetching teacher stats:", error);
    return null;
  }
}
