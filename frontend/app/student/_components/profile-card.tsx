"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, BookOpen, Award } from "lucide-react";

interface ProfileCardProps {
  name: string;
  image: string | null;
  role?: string;
  grade?: string;
  achievements?: number;
}

export function ProfileCard({ name, image, grade = "10", achievements = 0 }: ProfileCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 }}
      className="h-full"
    >
      <Card className="border-none shadow-sm h-full">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl opacity-50" />
              <Avatar className="h-24 w-24 ring-4 ring-white shadow-lg">
                <AvatarImage src={image || undefined} alt={name} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold">
                  {name.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </div>
            
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{name}</h3>

            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mb-2">
                  <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-lg font-bold text-slate-900 dark:text-white">{grade}</span>
                <span className="text-xs text-slate-500">Grade</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg mb-2">
                  <Award className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-lg font-bold text-slate-900 dark:text-white">{achievements}</span>
                <span className="text-xs text-slate-500">Achievement</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

