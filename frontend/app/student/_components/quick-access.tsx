"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Library, Trophy, Bot, History, BookOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface QuickAccessItem {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
  gradient: string;
}

const quickAccessItems: QuickAccessItem[] = [
  {
    title: "Learning Library",
    description: "Explore lessons & content",
    icon: Library,
    href: "/student/learning-library",
    color: "text-blue-600 dark:text-blue-400",
    gradient: "from-blue-500/10 to-blue-600/10",
  },
  {
    title: "Achievements",
    description: "View your progress",
    icon: Trophy,
    href: "/student/achievements",
    color: "text-yellow-600 dark:text-yellow-400",
    gradient: "from-yellow-500/10 to-yellow-600/10",
  },
  {
    title: "AI Assistant",
    description: "Get help & answers",
    icon: Bot,
    href: "/student/ai-assistant",
    color: "text-purple-600 dark:text-purple-400",
    gradient: "from-purple-500/10 to-purple-600/10",
  },
  {
    title: "History",
    description: "Past activities",
    icon: History,
    href: "/student/history",
    color: "text-green-600 dark:text-green-400",
    gradient: "from-green-500/10 to-green-600/10",
  },
];

export function QuickAccess() {
  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex items-center gap-2"
      >
        <Sparkles className="h-5 w-5 text-purple-500" />
        <h2 className="text-xl font-bold">Quick Access</h2>
      </motion.div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickAccessItems.map((item, index) => (
          <motion.div
            key={item.href}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 + index * 0.1 }}
            whileHover={{ scale: 1.05, y: -4 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link href={item.href}>
              <Card className="h-full border-2 hover:shadow-lg transition-all duration-300 cursor-pointer group bg-gradient-to-br from-background to-muted/20">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div
                      className={cn(
                        "p-4 rounded-2xl bg-gradient-to-br",
                        item.gradient,
                        "group-hover:scale-110 transition-transform duration-300"
                      )}
                    >
                      <item.icon className={cn("h-6 w-6", item.color)} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

