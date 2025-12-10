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
  submissions?: Array<{
    score: number;
    submittedAt: Date;
  }>;
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

    // Fetch performance and achievement data for each student
    const studentsWithData = await Promise.all(
      students.map(async (student) => {
        // Get student submissions to calculate performance
        const submissions = await prisma.studentSubmission.findMany({
          where: { userId: student.id },
          select: {
            score: true,
            submittedAt: true,
          },
          orderBy: {
            submittedAt: "asc",
          },
        });

        // Calculate average score
        const totalScore = submissions.reduce((sum, s) => sum + Number(s.score), 0);
        const averageScore = submissions.length > 0 
          ? Math.round((totalScore / submissions.length) * 10) / 10 
          : 0;

        // Get achievements
        const achievement = await prisma.studentAchievement.findUnique({
          where: { userId: student.id },
          select: {
            unlockedTiers: true,
            currentTier: true,
          },
        });

        let achievementsCount = 0;
        if (achievement?.unlockedTiers) {
          try {
            const unlockedTiers = JSON.parse(achievement.unlockedTiers);
            achievementsCount = Array.isArray(unlockedTiers) ? unlockedTiers.length : 0;
          } catch {
            achievementsCount = 0;
          }
        }

        return {
          id: student.id,
          name: student.name,
          email: student.email,
          grade: student.grade?.name || null,
          performance: averageScore > 0 ? `${averageScore}%` : null,
          achievements: achievementsCount > 0 ? `${achievementsCount} tiers unlocked` : null,
          feedback: null, // Feedback can be added later if needed
          issues: null, // Issues can be added later if needed
          image: student.image,
          createdAt: student.createdAt,
          submissions: submissions.map(s => ({
            score: Number(s.score),
            submittedAt: s.submittedAt,
          })),
        };
      })
    );

    return studentsWithData;
  } catch (error) {
    console.error("Error fetching student data:", error);
    return [];
  }
}
