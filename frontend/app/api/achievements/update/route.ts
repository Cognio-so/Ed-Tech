import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import {
  getTierByScore,
} from "@/data/achievement-types";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { score } = body;

    if (typeof score !== "number" || score < 0 || score > 100) {
      return NextResponse.json(
        { error: "Invalid score" },
        { status: 400 }
      );
    }

    // Get all submissions to calculate total score
    const submissions = await prisma.studentSubmission.findMany({
      where: { userId: session.user.id },
      select: { score: true },
    });

    // Calculate total score by summing all submission scores
    const totalScore = submissions.reduce((sum, s) => sum + Number(s.score), 0);

    let achievement = await prisma.studentAchievement.findUnique({
      where: { userId: session.user.id },
    });

    const newTier = getTierByScore(totalScore);

    if (!achievement) {
      achievement = await prisma.studentAchievement.create({
        data: {
          userId: session.user.id,
          totalScore: totalScore,
          currentTier: newTier.name,
          unlockedTiers: JSON.stringify([newTier.name]),
        },
      });
    } else {
      const unlockedTiers = JSON.parse(achievement.unlockedTiers || "[]");
      
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

    return NextResponse.json({
      success: true,
      achievement,
      totalScore,
    });
  } catch (error) {
    console.error("Error updating achievements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

