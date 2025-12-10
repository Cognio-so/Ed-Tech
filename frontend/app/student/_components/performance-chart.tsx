"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const data = [
  { month: "Aug", materials: 50, exams: 30 },
  { month: "Sept", materials: 40, exams: 70 },
  { month: "Oct", materials: 70, exams: 40 },
  { month: "Nov", materials: 60, exams: 35 },
  { month: "Dec", materials: 90, exams: 20 },
  { month: "Jan", materials: 70, exams: 30 },
];

const chartConfig = {
  materials: {
    label: "Materials",
    color: "#8884d8",
  },
  exams: {
    label: "Exams",
    color: "#ff84d8",
  },
} satisfies ChartConfig;

export function LearningActivityChart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="h-full"
    >
      <Card className="border-none shadow-sm h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">Learning activity</CardTitle>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#6C5DD3]" />
                <span className="text-slate-500">Materials</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#FF754C]" />
                <span className="text-slate-500">Exams</span>
              </div>
            </div>
            <select className="text-sm border-none bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-1 text-slate-500 cursor-pointer outline-none">
              <option>3rd semester</option>
              <option>2nd semester</option>
              <option>1st semester</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ChartContainer config={chartConfig} className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMaterials" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6C5DD3" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6C5DD3" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExams" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF754C" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FF754C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    domain={[0, 100]}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    tickFormatter={(value) => Math.floor(value).toString()}
                  />
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border bg-white dark:bg-slate-800 p-2 shadow-md">
                          {payload.map((entry, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div 
                                className="h-3 w-3 rounded-full" 
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-sm font-medium">{entry.name}:</span>
                              <span className="text-sm font-bold">{Math.floor(Number(entry.value))}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="materials"
                    stroke="#6C5DD3"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorMaterials)"
                  />
                  <Area
                    type="monotone"
                    dataKey="exams"
                    stroke="#FF754C"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorExams)"
                  />
                </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

