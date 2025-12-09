"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, Sparkles } from "lucide-react";

interface ProgressRingProps {
  currentTier: string;
  nextTier: string | null;
  currentScore: number;
  progressPercentage: number;
}

export function ProgressRing({
  currentTier,
  nextTier,
  currentScore,
  progressPercentage,
}: ProgressRingProps) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (progressPercentage / 100) * circumference;

  const getTierColor = () => {
    const colors: Record<string, string> = {
      starter: "text-slate-500",
      bronze: "text-amber-600",
      silver: "text-gray-400",
      gold: "text-yellow-500",
      platinum: "text-cyan-400",
      diamond: "text-blue-400",
    };
    return colors[currentTier] || "text-slate-500";
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5, duration: 0.5 }}
    >
      <Card className="border-2 bg-gradient-to-br from-background to-muted/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Achievement Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center">
            <div className="relative w-40 h-40">
              <svg className="transform -rotate-90 w-40 h-40">
                <circle
                  cx="80"
                  cy="80"
                  r="45"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted"
                />
                <motion.circle
                  cx="80"
                  cy="80"
                  r="45"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  className={getTierColor()}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: offset }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  strokeDasharray={circumference}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{Math.round(progressPercentage)}%</span>
                <span className="text-xs text-muted-foreground">Complete</span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current Tier</span>
              <span className={`font-semibold capitalize flex items-center gap-1 ${getTierColor()}`}>
                <Sparkles className="h-3 w-3" />
                {currentTier}
              </span>
            </div>
            {nextTier && (
              <>
                <Progress value={progressPercentage} className="h-2" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Next Tier</span>
                  <span className="font-semibold capitalize">{nextTier}</span>
                </div>
                <div className="text-center text-xs text-muted-foreground">
                  {currentScore.toLocaleString()} points earned
                </div>
              </>
            )}
            {!nextTier && (
              <div className="text-center text-sm font-semibold text-green-600 dark:text-green-400">
                🎉 Maximum tier achieved!
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

