"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardAction 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BookOpen, 
  Trophy, 
  Clock, 
  Target, 
  TrendingUp, 
  Star,
  Award,
  Play,
  Brain,
  Users,
  Zap,
  ChevronRight,
  Sparkles,
  Heart,
  Bookmark,
  MessageCircle,
  AlertCircle,
  LogOut
} from "lucide-react";
import { getStudentDashboardData, getQuickStats } from "./action";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut"
    }
  }
};

const floatingVariants = {
  animate: {
    y: [-5, 5, -5],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

// Color schemes for different elements
const subjectColors = {
  Math: "#FF6B6B",
  Science: "#4ECDC4", 
  English: "#45B7D1",
  History: "#96CEB4",
  Art: "#FFEAA7",
  Music: "#DDA0DD",
  Physical: "#98D8C8",
  General: "#F7DC6F"
};

const achievementColors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"];

export default function StudentDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [quickStats, setQuickStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();
  const handleLogout = async () => {
    try {
      await authClient.signOut();
      router.push("/sign-in");
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Failed to logout");
      console.error("Logout error:", error);
    }
  };
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [dashboardResult, statsResult] = await Promise.all([
          getStudentDashboardData(),
          getQuickStats()
        ]);

        if (dashboardResult.success) {
          setDashboardData(dashboardResult.data);
        } else {
          setError(dashboardResult.error);
        }

        if (statsResult.success) {
          setQuickStats(statsResult.data);
        }
      } catch (err) {
        setError("Failed to load dashboard data");
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error || !dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="text-destructive mb-4">
              <AlertCircle className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">Oops! Something went wrong</h3>
            <p className="text-muted-foreground mb-4">{error || "Failed to load dashboard"}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { user, stats, subjectProgress, recentProgress, recentAchievements, recentConversations } = dashboardData;

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Welcome Header */}
        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white border-0 shadow-xl min-h-[280px]">
            <CardContent className="pt-12 pb-12">
              <div className="flex items-center justify-between h-full">
                <div className="flex items-center space-x-8">
                    <Avatar className="h-24 w-24 border-4 border-white/20">
                      <AvatarImage src={user.profilePicture} />
                      <AvatarFallback className="text-4xl font-bold bg-white/20">
                        {user.name?.charAt(0) || "S"}
                      </AvatarFallback>
                    </Avatar>
                  <div>
                    <h1 className="text-5xl font-bold mb-3">
                      Welcome back, {user.name?.split(" ")[0] || "Student"}! 
                    </h1>
                    <p className="text-blue-100 text-2xl mb-2">
                      Ready for another amazing day of learning?🏆
                    </p>
                    <div className="flex items-center gap-4 mt-4">
                      {user.grades && user.grades.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="bg-white/20 text-white border-white/30 text-base px-1 py-1">
                            {user.grades.join(", ")}
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-blue-200 text-base font-medium">Grade:</span>
                          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-200 border-yellow-300/30 text-base px-1 py-1">
                            Contact Administration
                          </Badge>
                        </div>
                      )}
                     <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white"
                        onClick={() => {
                          handleLogout();
                        }}
                      >
                        <LogOut className="h-6 w-6" />
                        Logout
                      </Button>
                    </div>
                    </div>
                  </div>
                  
                </div>
                <div className="flex items-center gap-6">
                  <motion.div
                    className="relative w-80 h-80 hidden lg:block"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                  >
                    <Image
                      src="/student.jpg"
                      alt="Happy student learning"
                      fill
                      className="object-cover rounded-md"
                      priority
                    />
                  </motion.div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Motivational Quote Section */}
        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white border-0 shadow-lg">
            <CardContent className="pt-6 pb-6">
              <div className="text-center">
                <motion.div
                  key={Math.floor(Date.now() / 10000) % 5} // Change quote every 10 seconds
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                >
                  <blockquote className="text-xl font-medium mb-2">
                    {[
                      "The future belongs to those who believe in the beauty of their dreams. ✨",
                      "Success is not final, failure is not fatal: it is the courage to continue that counts. 💪",
                      "Education is the passport to the future, for tomorrow belongs to those who prepare for it today. 🎓",
                      "You are never too old to set another goal or to dream a new dream. 🌟",
                      "The only way to do great work is to love what you do. ❤️"
                    ][Math.floor(Date.now() / 10000) % 5]}
                  </blockquote>
                  <p className="text-indigo-100 text-sm">
                    Keep learning, keep growing! 🌱
                  </p>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Stats */}
        <motion.div variants={itemVariants}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Resources"
              value={stats.totalResources}
              icon={BookOpen}
              color="from-blue-500 to-blue-600"
              trend="+12%"
            />
            <StatCard
              title="Completed"
              value={stats.completedResources}
              icon={Trophy}
              color="from-green-500 to-green-600"
              trend="+8%"
            />
            <StatCard
              title="Study Time"
              value={`${Math.round(stats.totalStudyTime / 60)}h`}
              icon={Clock}
              color="from-purple-500 to-purple-600"
              trend="+15%"
            />
            <StatCard
              title="Achievements"
              value={stats.totalAchievements}
              icon={Award}
              color="from-yellow-500 to-yellow-600"
              trend="+3"
            />
          </div>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Progress & Activities */}
          <div className="lg:col-span-2 space-y-6">
            {/* Learning Progress */}
            <motion.div variants={itemVariants}>
              <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl text-foreground">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Learning Progress
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Your journey through different subjects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(subjectProgress).slice(0, 4).map(([subject, data], index) => (
                      <motion.div
                        key={subject}
                        className="space-y-2"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: subjectColors[subject] || subjectColors.General }}
                            />
                            <span className="font-medium text-foreground">{subject}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {data.completed}/{data.total} completed
                          </span>
                        </div>
                        <Progress 
                          value={data.averagePercentage} 
                          className="h-2"
                        />
                        <div className="text-xs text-muted-foreground">
                          {Math.round(data.averagePercentage)}% average progress
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Progress */}
            <motion.div variants={itemVariants}>
              <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl text-foreground">
                    <Bookmark className="h-5 w-5 text-blue-500" />
                    Recent Activities
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Your latest learning sessions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentProgress.slice(0, 5).map((progress, index) => (
                      <motion.div
                        key={progress._id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.02 }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                            <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <h4 className="font-medium text-sm text-foreground">{progress.contentTitle}</h4>
                            <p className="text-xs text-muted-foreground">
                              {progress.subject} • {progress.grade}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={progress.status === 'completed' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {progress.status}
                          </Badge>
                          <span className="text-sm font-medium text-foreground">
                            {progress.progress.percentage}%
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right Column - Achievements & Quick Actions */}
          <div className="space-y-6">
            {/* Achievements */}
            <motion.div variants={itemVariants}>
              <Card className="shadow-lg border-0 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl text-foreground">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Recent Achievements
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Celebrate your wins! 🎉
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentAchievements.slice(0, 3).map((achievement, index) => (
                      <motion.div
                        key={achievement._id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-background/60 hover:bg-background/80 transition-colors"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.05 }}
                      >
                        <div 
                          className="p-2 rounded-full"
                          style={{ backgroundColor: achievement.color + '20' }}
                        >
                          <Trophy className="h-5 w-5" style={{ color: achievement.color }} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm text-foreground">{achievement.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {achievement.points} points
                          </p>
                        </div>
                        <Star className="h-4 w-4 text-yellow-500" />
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions */}
            <motion.div variants={itemVariants}>
              <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl text-foreground">
                    <Zap className="h-5 w-5 text-purple-500" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button 
                        className="h-20 flex-col gap-2 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                        variant="default"
                      >
                        <Brain className="h-6 w-6" />
                        <span className="text-xs">AI Tutor</span>
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button 
                        className="h-20 flex-col gap-2 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                        variant="default"
                      >
                        <BookOpen className="h-6 w-6" />
                        <span className="text-xs">Library</span>
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button 
                        className="h-20 flex-col gap-2 bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                        variant="default"
                      >
                        <Play className="h-6 w-6" />
                        <span className="text-xs">Continue</span>
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button 
                        className="h-20 flex-col gap-2 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                        variant="default"
                      >
                        <MessageCircle className="h-6 w-6" />
                        <span className="text-xs">Chat</span>
                      </Button>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Learning Streak */}
            <motion.div variants={itemVariants}>
              <Card className="shadow-lg border-0 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <motion.div
                      className="text-4xl mb-2"
                      animate={{ 
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ 
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      🔥
                    </motion.div>
                    <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">
                      {stats.learningStreak}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Day Learning Streak!
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Keep it up! You're doing amazing! 💪
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* Additional Content Section */}
        <motion.div variants={itemVariants}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Study Goals */}
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-foreground">
                  <Target className="h-5 w-5 text-indigo-500" />
                  Study Goals
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Track your learning objectives
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900">
                        <Target className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-foreground">Complete Math Chapter 5</h4>
                        <p className="text-xs text-muted-foreground">Due in 3 days</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      75%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                        <BookOpen className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-foreground">Read Science Article</h4>
                        <p className="text-xs text-muted-foreground">Due tomorrow</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      100%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Conversations */}
            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-foreground">
                  <MessageCircle className="h-5 w-5 text-cyan-500" />
                  Recent Conversations
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Your latest AI tutor sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentConversations.slice(0, 3).map((conversation, index) => (
                    <motion.div
                      key={conversation._id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-cyan-100 dark:bg-cyan-900">
                          <MessageCircle className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-foreground">{conversation.title}</h4>
                          <p className="text-xs text-muted-foreground">
                            {conversation.sessionType} • {conversation.conversationStats.totalMessages} messages
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Stat Card Component
function StatCard({ title, value, icon: Icon, color, trend }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -5 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`bg-gradient-to-br ${color} text-white border-0 shadow-lg overflow-hidden`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">{title}</p>
              <p className="text-2xl font-bold">{value}</p>
              {trend && (
                <p className="text-white/70 text-xs flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {trend}
                </p>
              )}
            </div>
            <motion.div
              animate={{ 
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Icon className="h-8 w-8 text-white/80" />
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Loading Skeleton
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header Skeleton */}
        <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 shadow-xl min-h-[280px]">
          <CardContent className="pt-12 pb-12">
            <div className="flex items-center space-x-8">
              <Skeleton className="h-24 w-24 rounded-full bg-white/20" />
              <div className="space-y-3">
                <Skeleton className="h-12 w-80 bg-white/20" />
                <Skeleton className="h-6 w-64 bg-white/20" />
              </div>
              <div className="ml-auto flex items-center gap-6">
                <Skeleton className="h-20 w-20 rounded-full bg-white/20" />
                <Skeleton className="h-40 w-40 rounded-full bg-white/20" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-12" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {[...Array(2)].map((_, i) => (
              <Card key={i} className="shadow-lg">
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-2 w-full" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="shadow-lg">
                <CardHeader>
                  <Skeleton className="h-6 w-24" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[...Array(2)].map((_, j) => (
                      <Skeleton key={j} className="h-16 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}