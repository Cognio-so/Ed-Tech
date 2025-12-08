import "server-only";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import {
  ACHIEVEMENT_TIERS,
  AchievementTier,
  getTierByScore,
  calculateScoreCredit,
} from "./achievement-types";

export type { AchievementTier };
export { ACHIEVEMENT_TIERS, getTierByScore, calculateScoreCredit };

export async function getStudentAchievements() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return null;
  }

  const achievement = await prisma.studentAchievement.findUnique({
    where: { userId: session.user.id },
  });

  if (!achievement) {
    const newAchievement = await prisma.studentAchievement.create({
      data: {
        userId: session.user.id,
        totalScore: 100000,
        currentTier: "starter",
        unlockedTiers: JSON.stringify(["starter"]),
      },
    });
    return newAchievement;
  }

  return achievement;
}

export async function getStudentStats() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return null;
  }

  const [existingAchievement, submissions] = await Promise.all([
    prisma.studentAchievement.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.studentSubmission.findMany({
      where: { userId: session.user.id },
      select: {
        score: true,
        submittedAt: true,
      },
      orderBy: {
        submittedAt: "desc",
      },
    }),
  ]);

  // Calculate total score from all submissions
  const totalScore = submissions.reduce((sum, s) => sum + Number(s.score), 0);

  let achievement;
  if (!existingAchievement) {
    achievement = await prisma.studentAchievement.create({
      data: {
        userId: session.user.id,
        totalScore: totalScore,
        currentTier: "starter",
        unlockedTiers: JSON.stringify(["starter"]),
      },
    });
  } else {
    // Update achievement with calculated total score from submissions
    const newTier = getTierByScore(totalScore);
    const unlockedTiers = JSON.parse(existingAchievement.unlockedTiers || "[]");
    
    if (!unlockedTiers.includes(newTier.name)) {
      unlockedTiers.push(newTier.name);
    }

    achievement = await prisma.studentAchievement.update({
      where: { userId: session.user.id },
      data: {
        totalScore: totalScore,
        currentTier: newTier.name,
        unlockedTiers: JSON.stringify(unlockedTiers),
      },
    });
  }

  // Ensure achievement is defined (TypeScript guard)
  if (!achievement) {
    throw new Error("Failed to create or update achievement");
  }

  const totalSubmissions = submissions.length;
  const averageScore =
    totalSubmissions > 0
      ? submissions.reduce((sum, s) => sum + Number(s.score), 0) / totalSubmissions
      : 0;
  const perfectScores = submissions.filter((s) => s.score === 100).length;
  const recentSubmissions = submissions.slice(0, 10);

  const currentTierData = ACHIEVEMENT_TIERS.find(
    (tier) => tier.name === achievement?.currentTier || "starter"
  ) || ACHIEVEMENT_TIERS[0];

  const nextTier = ACHIEVEMENT_TIERS.find(
    (tier) => tier.minScore > (achievement?.totalScore || 0)
  );

  const progressToNextTier = nextTier
    ? {
        current: achievement?.totalScore || 0,
        target: nextTier.minScore,
        percentage: Math.min(
          ((achievement?.totalScore || 0) / nextTier.minScore) * 100,
          100
        ),
      }
    : null;

  return {
    achievement: achievement || {
      id: "",
      userId: session.user.id,
      totalScore: 0,
      currentTier: "starter",
      unlockedTiers: JSON.stringify(["starter"]),
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    stats: {
      totalSubmissions,
      averageScore: Math.round(averageScore * 10) / 10,
      perfectScores,
      recentSubmissions,
    },
    currentTier: currentTierData,
    nextTier,
    progressToNextTier,
  };
}


