"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Target, Star, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

interface StatsGridProps {
  totalScore: number;
  totalSubmissions: number;
  averageScore: number;
  perfectScores: number;
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  delay: number;
  suffix?: string;
}

function StatCard({ icon: Icon, label, value, color, delay, suffix }: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (typeof value === "number") {
      const duration = 1500;
      const steps = 60;
      const increment = value / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setDisplayValue(value);
          clearInterval(timer);
        } else {
          setDisplayValue(current);
        }
      }, duration / steps);
      return () => clearInterval(timer);
    } else {
      setDisplayValue(value as any);
    }
  }, [value]);

  const formatValue = (val: number) => {
    if (suffix === "%") {
      return val.toFixed(1);
    }
    return Math.floor(val).toLocaleString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ scale: 1.05, y: -4 }}
      className="h-full"
    >
      <Card className="h-full border-2 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-background to-muted/20">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className={`inline-flex p-2 rounded-xl ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl md:text-3xl font-bold">
                  {typeof value === "number" ? formatValue(displayValue) : value}
                </span>
                {suffix && (
                  <span className="text-sm text-muted-foreground">{suffix}</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function StatsGrid({
  totalScore,
  totalSubmissions,
  averageScore,
  perfectScores,
}: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Trophy}
        label="Total Score"
        value={totalScore}
        color="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
        delay={0.1}
      />
      <StatCard
        icon={Target}
        label="Submissions"
        value={totalSubmissions}
        color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        delay={0.2}
      />
      <StatCard
        icon={TrendingUp}
        label="Average Score"
        value={averageScore}
        color="bg-green-500/10 text-green-600 dark:text-green-400"
        delay={0.3}
        suffix="%"
      />
      <StatCard
        icon={Star}
        label="Perfect Scores"
        value={perfectScores}
        color="bg-purple-500/10 text-purple-600 dark:text-purple-400"
        delay={0.4}
      />
    </div>
  );
}

