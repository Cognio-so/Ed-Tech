"use client";

import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Sun } from "lucide-react";

interface WelcomeHeaderProps {
  name: string;
  grade: string | null;
  currentTier: string;
  image: string | null;
}

export function WelcomeHeader({
  name,
  grade,
  currentTier,
  image,
}: WelcomeHeaderProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const tierColors: Record<string, string> = {
    starter: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    bronze: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    silver: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    gold: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    platinum: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
    diamond: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-pink-950/20 p-6 md:p-8 border border-border/50"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        >
          <Avatar className="h-20 w-20 md:h-24 md:w-24 ring-4 ring-background shadow-lg">
            <AvatarImage src={image || undefined} alt={name} />
            <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-blue-500 to-purple-500 text-white">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
        </motion.div>
        <div className="flex-1 space-y-3">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 flex-wrap"
          >
            <Sun className="h-5 w-5 text-yellow-500" />
            <span className="text-sm md:text-base text-muted-foreground font-medium">
              {getGreeting()},
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
          >
            {name}
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-3 flex-wrap"
          >
            {grade && (
              <Badge variant="outline" className="text-sm px-3 py-1">
                Grade {grade}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={`text-sm px-3 py-1 capitalize border ${tierColors[currentTier] || tierColors.starter}`}
            >
              <Sparkles className="h-3 w-3 mr-1.5" />
              {currentTier}
            </Badge>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

