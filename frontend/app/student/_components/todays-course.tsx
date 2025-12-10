"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, Clock } from "lucide-react";

interface Course {
  id: string;
  title: string;
  lessons: number;
  assignments: number;
  duration: string;
  students: number;
  progress: number;
  icon: string;
  color: string;
}

interface TodaysCourseProps {
  courses?: Course[];
}

const defaultCourses: Course[] = [
  {
    id: "1",
    title: "Biology Molecular",
    lessons: 21,
    assignments: 5,
    duration: "50 min",
    students: 312,
    progress: 79,
    icon: "🧬",
    color: "bg-green-100 text-green-600",
  },
  {
    id: "2",
    title: "Color Theory",
    lessons: 10,
    assignments: 2,
    duration: "45 min",
    students: 256,
    progress: 64,
    icon: "🎨",
    color: "bg-orange-100 text-orange-600",
  },
];

export function TodaysCourse({ courses = defaultCourses }: TodaysCourseProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Today's course</h2>
      </div>
      <div className="grid gap-4">
        {courses.map((course, index) => (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-none shadow-sm hover:shadow-md transition-all duration-200">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-6">
                  {/* Progress Circle & Icon */}
                  <div className="relative flex-shrink-0 flex items-center justify-center w-24 h-24">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-slate-100 dark:text-slate-800"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        strokeLinecap="round"
                        className={course.progress > 70 ? "text-green-500" : "text-orange-500"}
                        strokeDasharray={2 * Math.PI * 40}
                        strokeDashoffset={2 * Math.PI * 40 * (1 - course.progress / 100)}
                      />
                    </svg>
                    <div className={`absolute inset-0 m-6 rounded-full ${course.color} flex items-center justify-center text-2xl`}>
                      {course.icon}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">{course.title}</h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-500">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            <span>{course.lessons} lesson</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{course.duration}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            <span>{course.assignments} assignment</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>{course.students} students</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className={`text-xl font-bold ${course.progress > 70 ? "text-green-500" : "text-orange-500"}`}>
                        {course.progress}%
                      </span>
                      <div className="flex gap-3">
                        <Button variant="outline" className="rounded-xl px-6 hover:bg-slate-100">
                          Skip
                        </Button>
                        <Button className="rounded-xl px-6 bg-green-500 hover:bg-green-600 text-white">
                          Continue
                        </Button>
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

