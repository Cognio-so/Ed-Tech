"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AchievementTier } from "@/data/achievement-types";
import { Sparkles } from "lucide-react";

interface TierProgressProps {
  currentTier: AchievementTier;
  nextTier: AchievementTier | null;
  currentScore: number;
  progressPercentage: number;
}

export function TierProgress({
  currentTier,
  nextTier,
  currentScore,
  progressPercentage,
}: TierProgressProps) {
  if (!nextTier) {
    return (
      <Card className="relative overflow-hidden border-2 border-primary/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10" />
        <CardHeader className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-2xl shadow-lg">
              {currentTier.icon}
            </div>
            <div>
              <CardTitle className="text-2xl capitalize">
                {currentTier.name} Master
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                You&apos;ve reached the highest tier!
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Score</span>
              <span className="text-2xl font-bold">
                {currentScore.toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const remaining = nextTier.minScore - currentScore;

  return (
    <Card className="relative overflow-hidden border-2 border-primary/50">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10" />
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-2xl shadow-lg">
              {currentTier.icon}
            </div>
            <div>
              <CardTitle className="text-lg">Progress to {nextTier.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {nextTier.description}
              </p>
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-2xl shadow-lg">
            {nextTier.icon}
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current Score</span>
            <span className="font-semibold">
              {currentScore.toLocaleString()}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {remaining > 0
                ? `${remaining.toLocaleString()} points to go`
                : "Almost there!"}
            </span>
            <span className="font-semibold">
              {Math.round(progressPercentage)}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Complete assessments to earn more points and unlock the{" "}
            <span className="font-semibold text-foreground capitalize">
              {nextTier.name}
            </span>{" "}
            tier!
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

