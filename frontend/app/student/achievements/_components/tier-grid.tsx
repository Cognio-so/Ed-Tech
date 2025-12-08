"use client";

import { AchievementCard } from "./achievement-card";
import { ACHIEVEMENT_TIERS } from "@/data/achievement-types";

interface TierGridProps {
  currentTier: string;
  unlockedTiers: string[];
  totalScore: number;
}

export function TierGrid({
  currentTier,
  unlockedTiers,
  totalScore,
}: TierGridProps) {
  const parsedUnlockedTiers =
    typeof unlockedTiers === "string"
      ? JSON.parse(unlockedTiers)
      : unlockedTiers;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Achievement Tiers</h2>
        <p className="text-muted-foreground">
          Unlock new tiers by earning score credits through your submissions
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENT_TIERS.map((tier) => {
          const isUnlocked = parsedUnlockedTiers.includes(tier.name);
          const isCurrent = tier.name === currentTier;

          return (
            <AchievementCard
              key={tier.name}
              tier={tier}
              isUnlocked={isUnlocked}
              isCurrent={isCurrent}
              score={isCurrent ? totalScore : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

