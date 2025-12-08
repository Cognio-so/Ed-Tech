export interface AchievementTier {
  name: string;
  minScore: number;
  maxScore: number;
  color: string;
  gradient: string;
  icon: string;
  description: string;
}

export const ACHIEVEMENT_TIERS: AchievementTier[] = [
  {
    name: "starter",
    minScore: 0,
    maxScore: 1000,
    color: "text-slate-500",
    gradient: "from-slate-400 to-slate-600",
    icon: "🌱",
    description: "Just getting started on your learning journey",
  },
  {
    name: "bronze",
    minScore: 1000,
    maxScore: 3000,
    color: "text-amber-600",
    gradient: "from-amber-500 to-amber-700",
    icon: "🥉",
    description: "Building your foundation with dedication",
  },
  {
    name: "silver",
    minScore: 3000,
    maxScore: 6000,
    color: "text-gray-400",
    gradient: "from-gray-300 to-gray-500",
    icon: "🥈",
    description: "Shining bright with consistent progress",
  },
  {
    name: "gold",
    minScore: 6000,
    maxScore: 10000,
    color: "text-yellow-500",
    gradient: "from-yellow-400 to-yellow-600",
    icon: "🥇",
    description: "Excellence through hard work and persistence",
  },
  {
    name: "platinum",
    minScore: 10000,
    maxScore: 25000,
    color: "text-cyan-400",
    gradient: "from-cyan-300 to-cyan-500",
    icon: "💎",
    description: "Mastery achieved through exceptional dedication",
  },
  {
    name: "diamond",
    minScore: 25000,
    maxScore: Infinity,
    color: "text-blue-400",
    gradient: "from-blue-300 to-indigo-500",
    icon: "💠",
    description: "The pinnacle of learning achievement",
  },
];

export function getTierByScore(score: number): AchievementTier {
  return (
    ACHIEVEMENT_TIERS.find(
      (tier) => score >= tier.minScore && score < tier.maxScore
    ) || ACHIEVEMENT_TIERS[0]
  );
}

export function calculateScoreCredit(submissionScore: number): number {
  // Return the actual score without multiplication
  // Total score is the sum of all submission scores
  return Math.round(submissionScore);
}

