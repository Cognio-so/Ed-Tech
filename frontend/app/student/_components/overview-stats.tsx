"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, CheckCircle2, Award, Users } from "lucide-react";
import { useEffect, useState } from "react";

interface OverviewStatsProps {
  totalSubmissions: number;
  completedAssignments: number;
  certificatesEarned: number;
  communitySupport?: number;
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  bgColor: string;
  delay: number;
}

function StatCard({ icon: Icon, label, value, color, bgColor, delay }: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
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
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ scale: 1.02, y: -2 }}
    >
      <Card className="border-2 hover:shadow-md transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-2">{label}</p>
              <p className="text-3xl md:text-4xl font-bold">{displayValue}</p>
            </div>
            <div className={`p-3 rounded-xl ${bgColor}`}>
              <Icon className={`h-6 w-6 ${color}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function OverviewStats({
  totalSubmissions,
  completedAssignments,
  certificatesEarned,
  communitySupport = 0,
}: OverviewStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        icon={BookOpen}
        label="Course in Progress"
        value={totalSubmissions}
        color="text-orange-600 dark:text-orange-400"
        bgColor="bg-orange-500/10"
        delay={0.1}
      />
      <StatCard
        icon={CheckCircle2}
        label="Course Completed"
        value={completedAssignments}
        color="text-green-600 dark:text-green-400"
        bgColor="bg-green-500/10"
        delay={0.2}
      />
      <StatCard
        icon={Award}
        label="Certificates Earned"
        value={certificatesEarned}
        color="text-blue-600 dark:text-blue-400"
        bgColor="bg-blue-500/10"
        delay={0.3}
      />
      <StatCard
        icon={Users}
        label="Community Support"
        value={communitySupport}
        color="text-purple-600 dark:text-purple-400"
        bgColor="bg-purple-500/10"
        delay={0.4}
      />
    </div>
  );
}