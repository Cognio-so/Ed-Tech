"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { LibraryContent } from "@/data/get-library-content"

interface ChartAreaInteractiveProps {
  data?: LibraryContent[];
}

export function ChartAreaInteractive({ data = [] }: ChartAreaInteractiveProps) {
  const chartData = React.useMemo(() => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const currentMonth = new Date().getMonth();
    const last6Months = months.slice(
      Math.max(0, currentMonth - 5),
      currentMonth + 1
    );

    const monthlyData = last6Months.map((month) => {
      const monthIndex = months.indexOf(month);
      const year = new Date().getFullYear();
      const startDate = new Date(year, monthIndex, 1);
      const endDate = new Date(year, monthIndex + 1, 0);

      const contentCount = data.filter((item) => {
        const itemDate = new Date(item.createdAt);
        return itemDate >= startDate && itemDate <= endDate;
      }).length;

      const assessmentCount = data.filter((item) => {
        const itemDate = new Date(item.createdAt);
        return (
          item.type === "assessment" &&
          itemDate >= startDate &&
          itemDate <= endDate
        );
      }).length;

      return {
        month,
        content: contentCount,
        assessments: assessmentCount,
      };
    });

    return monthlyData;
  }, [data]);

  const chartConfig = {
    content: {
      label: "Content",
      color: "hsl(var(--chart-1))",
    },
    assessments: {
      label: "Assessments",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <AreaChart
        accessibilityLayer
        data={chartData}
        margin={{
          left: 0,
          right: 10,
          top: 10,
          bottom: 0,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => value.slice(0, 3)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => `${value}`}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dot" />}
        />
        <Area
          dataKey="content"
          type="natural"
          fill="var(--color-content)"
          fillOpacity={0.4}
          stroke="var(--color-content)"
          stackId="a"
        />
        <Area
          dataKey="assessments"
          type="natural"
          fill="var(--color-assessments)"
          fillOpacity={0.4}
          stroke="var(--color-assessments)"
          stackId="a"
        />
      </AreaChart>
    </ChartContainer>
  )
}
