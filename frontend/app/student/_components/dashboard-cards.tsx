"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Medal } from "lucide-react";

interface DashboardCardsProps {
  totalScore?: number;
}

export function DashboardCards({ totalScore = 2400 }: DashboardCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* XP Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="col-span-1 md:col-span-2"
      >
        <Card className="border-none shadow-sm h-full">
          <CardContent className="p-4 sm:p-6 flex flex-col justify-between h-full">
            <div className="flex items-center gap-3 sm:gap-4 mb-4">
              <div className="relative h-12 w-12 sm:h-16 sm:w-16 flex-shrink-0">
                 <div className="absolute inset-0 bg-green-100 rounded-full animate-pulse" />
                 <Medal className="h-12 w-12 sm:h-16 sm:w-16 text-green-500 relative z-10" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white truncate">
                  {Math.floor(totalScore || 0)} XP
                </h3>
                <p className="text-slate-500 text-xs sm:text-sm">Point</p>
              </div>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="rounded-xl border-slate-200 flex-1 text-xs sm:text-sm py-2 sm:py-2.5">
                Redeem
              </Button>
              <Button className="rounded-xl bg-green-500 hover:bg-green-600 text-white flex-1 text-xs sm:text-sm py-2 sm:py-2.5">
                Collect Point
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Consultation Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-none shadow-sm bg-gradient-to-br from-orange-300 to-orange-400 text-white h-full">
          <CardContent className="p-6 flex flex-col justify-between h-full min-h-[160px]">
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <span className="text-xl">👩‍🏫</span>
              </div>
              <ArrowUpRight className="h-5 w-5 text-white/80" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-1">Consultation</h3>
              <p className="text-orange-50 text-sm">Get a mentor to help your learning process</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Target Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-none shadow-sm bg-gradient-to-br from-purple-400 to-pink-400 text-white h-full">
          <CardContent className="p-6 flex flex-col justify-between h-full min-h-[160px]">
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <span className="text-xl">🎯</span>
              </div>
              <ArrowUpRight className="h-5 w-5 text-white/80" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-1">Set target</h3>
              <p className="text-purple-50 text-sm">Set target, reminders and your study timeline</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

