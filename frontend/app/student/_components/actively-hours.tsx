"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Clock, BookOpen, CheckCircle2 } from "lucide-react";

interface ActivelyHoursProps {
  weeklyHours?: number[];
  timeSpent?: { hours: number; percentage: number };
  lessonsTaken?: { count: number; percentage: number };
  examsPassed?: { count: number; percentage: number };
}

const chartData = [
  { day: "S", hours: 2 },
  { day: "M", hours: 4 },
  { day: "T", hours: 3 },
  { day: "W", hours: 5 },
  { day: "T", hours: 4 },
  { day: "F", hours: 3 },
  { day: "S", hours: 2 },
];

const chartConfig = {
  hours: {
    label: "Hours",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function ActivelyHours({
  weeklyHours,
  timeSpent = { hours: 28, percentage: 85 },
  lessonsTaken = { count: 60, percentage: 78 },
  examsPassed = { count: 10, percentage: 100 },
}: ActivelyHoursProps) {
  const data = weeklyHours
    ? weeklyHours.map((hours, index) => ({
        day: ["S", "M", "T", "W", "T", "F", "S"][index],
        hours,
      }))
    : chartData;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 }}
      className="h-full"
    >
      <Card className="border-2 h-full flex flex-col">
        <CardHeader>
          <CardTitle>Actively Hours</CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            <div className="lg:col-span-2">
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="hours"
                      fill="var(--color-hours)"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Time spent</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{timeSpent.hours}</span>
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600 font-medium">{timeSpent.percentage}%</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${timeSpent.percentage}%` }}
                        transition={{ delay: 0.8, duration: 1 }}
                        className="h-full bg-green-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Lessons taken</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{lessonsTaken.count}</span>
                </div>
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600 font-medium">{lessonsTaken.percentage}%</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${lessonsTaken.percentage}%` }}
                        transition={{ delay: 0.9, duration: 1 }}
                        className="h-full bg-green-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Exam passed</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{examsPassed.count}</span>
                </div>
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600 font-medium">{examsPassed.percentage}%</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${examsPassed.percentage}%` }}
                        transition={{ delay: 1, duration: 1 }}
                        className="h-full bg-green-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

