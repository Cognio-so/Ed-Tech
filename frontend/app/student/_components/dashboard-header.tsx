"use client";

import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface DashboardHeaderProps {
  name: string;
}

export function DashboardHeader({ name }: DashboardHeaderProps) {
  const firstName = name.split(" ")[0];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-8"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
            className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white"
        >
            Hello, {firstName}
        </motion.h1>
          <motion.span
            initial={{ opacity: 0, rotate: -20 }}
            animate={{ opacity: 1, rotate: 0 }}
            transition={{ delay: 0.4 }}
            className="text-3xl md:text-4xl"
          >
            👋
          </motion.span>
        </div>
        <motion.p
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="text-slate-500 text-base max-w-md"
        >
          Nice to have you back, what an exciting day!
          Get ready and continue your lesson today.
        </motion.p>
      </div>
    </motion.div>
  );
}
