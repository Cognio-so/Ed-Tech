import { Suspense } from "react";
import { requireStudent } from "@/data/get-student";
import { getStudentStats } from "@/data/get-student-achievements";
import { StatsCard } from "./_components/stats-card";
import { TierProgress } from "./_components/tier-progress";
import { TierGrid } from "./_components/tier-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

async function AchievementsContent() {
  const data = await getStudentStats();

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Unable to load achievements</p>
      </div>
    );
  }

  const { achievement, stats, currentTier, nextTier, progressToNextTier } = data;

  const unlockedTiers = typeof achievement.unlockedTiers === "string"
    ? JSON.parse(achievement.unlockedTiers)
    : achievement.unlockedTiers;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Achievements</h1>
        <p className="text-muted-foreground mt-2">
          Track your learning progress and unlock new achievement tiers
        </p>
      </div>

      <StatsCard
        totalSubmissions={stats.totalSubmissions}
        averageScore={stats.averageScore}
        perfectScores={stats.perfectScores}
        totalScore={achievement.totalScore}
      />

      <TierProgress
        currentTier={currentTier}
        nextTier={nextTier || null}
        currentScore={achievement.totalScore}
        progressPercentage={progressToNextTier?.percentage || 100}
      />

      <TierGrid
        currentTier={achievement.currentTier}
        unlockedTiers={unlockedTiers}
        totalScore={achievement.totalScore}
      />
    </div>
  );
}

function AchievementsSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-10 w-64 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default async function AchievementsPage() {
  await requireStudent();

  return (
    <Suspense fallback={<AchievementsSkeleton />}>
      <AchievementsContent />
    </Suspense>
  );
}
