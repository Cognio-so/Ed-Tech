"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { StudentData } from "@/data/get-student-data";
import { TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";

interface PerformanceListProps {
  students: StudentData[];
}

export function PerformanceList({ students }: PerformanceListProps) {
  const chartData = React.useMemo(() => {
    // Get last 6 months
    const endDate = new Date();
    const startDate = subMonths(endDate, 5);
    const months = eachMonthOfInterval({ start: startDate, end: endDate });

    // Create data structure for chart
    const monthlyData = months.map((month) => {
      const monthKey = format(month, "MMM");
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const dataPoint: Record<string, any> = {
        month: monthKey,
      };

      // Calculate average score for each student in this month
      students.forEach((student) => {
        if (student.submissions && student.submissions.length > 0) {
          const monthSubmissions = student.submissions.filter((sub) => {
            const subDate = new Date(sub.submittedAt);
            return subDate >= monthStart && subDate <= monthEnd;
          });

          if (monthSubmissions.length > 0) {
            const avgScore =
              monthSubmissions.reduce((sum, s) => sum + s.score, 0) /
              monthSubmissions.length;
            dataPoint[student.name] = Math.round(avgScore);
          } else {
            dataPoint[student.name] = null;
          }
        } else {
          dataPoint[student.name] = null;
        }
      });

      return dataPoint;
    });

    return monthlyData;
  }, [students]);

  const studentsWithData = students.filter(
    (student) => student.submissions && student.submissions.length > 0
  );

  const chartConfig = React.useMemo(() => {
    const colors = [
      "#6C5DD3",
      "#FF754C",
      "#10b981",
      "#f59e0b",
      "#3b82f6",
      "#ec4899",
      "#8b5cf6",
      "#14b8a6",
    ];

    const config: ChartConfig = {};
    students.forEach((student, index) => {
      if (student.submissions && student.submissions.length > 0) {
        config[student.name] = {
          label: student.name,
          color: colors[index % colors.length],
        };
      }
    });
    return config;
  }, [students]);

  if (studentsWithData.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center mb-2">
            Performance data is not available yet.
          </p>
          <p className="text-sm text-muted-foreground text-center">
            Students need to submit assessments to see performance trends.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Student Performance
          </h2>
          <p className="text-muted-foreground">
            Performance trends over the last 6 months for {studentsWithData.length} student(s)
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance Over Time</CardTitle>
          <CardDescription>
            Average scores by month for each student
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    domain={[0, 100]}
                    tickFormatter={(value) => Math.floor(value).toString()}
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border bg-white dark:bg-slate-800 p-3 shadow-md">
                          <p className="text-sm font-medium mb-2">{payload[0].payload.month}</p>
                          {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center gap-2 mb-1">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-sm font-medium">{entry.dataKey}:</span>
                              <span className="text-sm font-bold">
                                {entry.value !== null ? `${Math.floor(entry.value)}%` : "N/A"}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: "20px" }}
                    iconType="line"
                  />
                  {studentsWithData.map((student) => (
                    <Line
                      key={student.id}
                      type="monotone"
                      dataKey={student.name}
                      stroke={chartConfig[student.name]?.color || "#6C5DD3"}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
