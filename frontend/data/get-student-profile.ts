'use server';

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

export interface StudentProfile {
  name: string;
  grade: string | null;
  subjects: string[];
  achievements: string[];
  totalScore: number;
  currentTier: string;
}

export async function getStudentProfile(): Promise<StudentProfile | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        gradeId: true,
        grade: {
          select: {
            name: true,
          },
        },
        userSubjects: {
          select: {
            subject: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    const subjects = user.userSubjects.map((us) => us.subject.name);

    // Get achievements
    const achievement = await prisma.studentAchievement.findUnique({
      where: { userId: session.user.id },
      select: {
        totalScore: true,
        currentTier: true,
        unlockedTiers: true,
      },
    });

    const unlockedTiers = achievement?.unlockedTiers
      ? typeof achievement.unlockedTiers === 'string'
        ? JSON.parse(achievement.unlockedTiers)
        : achievement.unlockedTiers
      : [];

    return {
      name: user.name || "Student",
      grade: user.grade?.name || null,
      subjects,
      achievements: unlockedTiers,
      totalScore: achievement?.totalScore || 0,
      currentTier: achievement?.currentTier || "starter",
    };
  } catch (error) {
    console.error("Error fetching student profile:", error);
    return null;
  }
}

