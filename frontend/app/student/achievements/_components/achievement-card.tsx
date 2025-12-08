"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AchievementTier } from "@/data/achievement-types";
import { cn } from "@/lib/utils";

interface AchievementCardProps {
  tier: AchievementTier;
  isUnlocked: boolean;
  isCurrent: boolean;
  score?: number;
}

export function AchievementCard({
  tier,
  isUnlocked,
  isCurrent,
  score,
}: AchievementCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-lg",
        isUnlocked
          ? "border-2 border-primary/50 bg-gradient-to-br from-background to-muted/20"
          : "opacity-60 grayscale",
        isCurrent && "ring-2 ring-primary ring-offset-2"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 opacity-10",
          isUnlocked ? `bg-gradient-to-br ${tier.gradient}` : "bg-gradient-to-br from-slate-300 to-slate-400"
        )}
      />
      <CardHeader className="relative">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-4xl shadow-lg transition-transform duration-300",
                isUnlocked ? tier.gradient : "from-slate-300 to-slate-400",
                isCurrent && "scale-110"
              )}
            >
              {tier.icon}
            </div>
            <div>
              <CardTitle className="text-xl capitalize">{tier.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {tier.description}
              </p>
            </div>
          </div>
          {isCurrent && (
            <Badge variant="default" className="shrink-0">
              Current
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Score Range</span>
            <span className="font-medium">
              {tier.minScore.toLocaleString()} -{" "}
              {tier.maxScore === Infinity
                ? "∞"
                : tier.maxScore.toLocaleString()}
            </span>
          </div>
          {score !== undefined && isUnlocked && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your Score</span>
              <span className="font-semibold">{score.toLocaleString()}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

