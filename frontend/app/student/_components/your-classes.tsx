"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, Clock, Filter } from "lucide-react";

interface Class {
  id: string;
  title: string;
  lessons: number;
  assignments: number;
  duration: string;
  students: number;
  image: string;
}

interface YourClassesProps {
  classes?: Class[];
}

const defaultClasses: Class[] = [
  {
    id: "1",
    title: "Microbiology Society",
    lessons: 10,
    assignments: 2,
    duration: "45 min",
    students: 256,
    image: "🦠",
  },
];

const tabs = ["All", "Design", "Science", "Coding"];

export function YourClasses({ classes = defaultClasses }: YourClassesProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Your class</h2>
      </div>

      <div className="flex items-center justify-between mb-4 overflow-x-auto pb-2">
        <div className="flex gap-4">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              className={`text-sm font-medium transition-colors ${
                i === 0
                  ? "text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white pb-1"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {classes.map((cls, index) => (
          <motion.div
            key={cls.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
          >
            <Card className="border-none shadow-sm bg-yellow-50/50 dark:bg-slate-800/50 hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center text-3xl shadow-sm">
                    {cls.image}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-white">{cls.title}</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        <span>{cls.lessons} lesson</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{cls.duration}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        <span>{cls.assignments} assignment</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{cls.students} students</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

