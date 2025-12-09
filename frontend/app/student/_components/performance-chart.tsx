"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { TrendingUp } from "lucide-react";

interface PerformanceChartProps {
  productivityPercentage?: number;
}

const performanceData = [
  { month: "Jan", score: 65 },
  { month: "Feb", score: 72 },
  { month: "Mar", score: 68 },
  { month: "Apr", score: 80 },
  { month: "May", score: 85 },
  { month: "Jun", score: 90 },
];

const chartConfig = {
  score: {
    label: "Performance",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function PerformanceChart({
  productivityPercentage = 40,
}: PerformanceChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 }}
      className="h-full"
    >
      <Card className="border-2 h-full flex flex-col">
        <CardHeader>
          <CardTitle>Performance</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <ChartContainer config={chartConfig} className="h-[200px] w-full mb-4 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  domain={[0, 100]}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--color-score)"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
          <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/50">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <p className="text-sm">
              <span className="font-semibold">{productivityPercentage}%</span> Your productivity is{" "}
              {productivityPercentage}% higher compared to last month
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

