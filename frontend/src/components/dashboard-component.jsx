'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, 
  Star, 
  Target, 
  Zap, 
  BookOpen, 
  Award,
  TrendingUp, 
  Calendar,
  Clock, 
  CheckCircle,
  Sparkles,
  Crown,
  Medal,
  Gift,
  Rocket,
  Rainbow,
  Heart,
  Moon,
  Sun,
  Cloud,
  Lightning,
  Fire,
  Ice,
  Diamond,
  Brain,
  Gamepad2,
  Palette,
  Music,
  Camera,
  Video,
  Users,
  BarChart3,
  Flame,
  BookMarked,
  GraduationCap,
  ArrowRight,
  ChevronRight,
  Eye,
  Timer,
  BookText,
  ImageIcon,
  ExternalLink,
  Play,
  Pause,
  Loader2,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { getStudentDashboardData, getQuickStats } from '@/app/(home)/student/dashboard/action';

// Modern gradients inspired by Dribbble designs
const modernGradients = {
  primary: "from-blue-500 via-purple-500 to-pink-500",
  secondary: "from-emerald-400 via-cyan-400 to-blue-500",
  success: "from-green-400 via-emerald-500 to-teal-500",
  warning: "from-yellow-400 via-orange-500 to-red-500",
  info: "from-blue-400 via-indigo-500 to-purple-500",
  fun: "from-pink-400 via-purple-500 to-indigo-500",
  energy: "from-orange-400 via-red-500 to-pink-500",
  calm: "from-teal-400 via-cyan-500 to-blue-500"
}

// Subject configurations with modern design
const subjectConfig = {
  English: {
    gradient: 'from-pink-400 via-rose-400 to-red-500',
    icon: '📚',
    emoji: '👩‍��',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50 dark:bg-pink-950',
    cardGradient: 'from-pink-50 to-rose-50 dark:from-pink-950 dark:to-rose-950'
  },
  Math: {
    gradient: 'from-yellow-400 via-orange-400 to-red-500',
    icon: '🔢',
    emoji: '👨‍🎓',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
    cardGradient: 'from-orange-50 to-yellow-50 dark:from-orange-950 dark:to-yellow-950'
  },
  Science: {
    gradient: 'from-green-400 via-emerald-400 to-teal-500',
    icon: '🧪',
    emoji: '��‍��',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950',
    cardGradient: 'from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950'
  },
  History: {
    gradient: 'from-amber-400 via-orange-500 to-red-500',
    icon: '🏛️',
    emoji: '👨‍🎓',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950',
    cardGradient: 'from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950'
  },
  Art: {
    gradient: 'from-purple-400 via-pink-400 to-rose-500',
    icon: '🎨',
    emoji: '👩‍🎓',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
    cardGradient: 'from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950'
  },
  Geography: {
    gradient: 'from-blue-400 via-cyan-400 to-teal-500',
    icon: '🌍',
    emoji: '👨‍��',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    cardGradient: 'from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950'
  }
}

// Modern animated background with geometric shapes
const ModernBackground = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950" />
    {[...Array(15)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute"
        initial={{ 
          x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200), 
          y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800) 
        }}
        animate={{ 
          x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200), 
          y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
          rotate: [0, 360],
          scale: [0.8, 1.2, 0.8]
        }}
        transition={{ 
          duration: 15 + Math.random() * 10,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <div className={`w-3 h-3 rounded-full opacity-30 ${
          ['bg-blue-400', 'bg-purple-400', 'bg-pink-400', 'bg-cyan-400'][Math.floor(Math.random() * 4)]
        }`} />
      </motion.div>
    ))}
    
    {/* Floating geometric shapes */}
    {[...Array(8)].map((_, i) => (
      <motion.div
        key={`shape-${i}`}
        className="absolute opacity-20"
        initial={{ 
          x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200), 
          y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800) 
        }}
        animate={{ 
          x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200), 
          y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
          rotate: [0, 180, 360]
        }}
        transition={{ 
          duration: 20 + Math.random() * 15,
          repeat: Infinity,
          ease: "linear"
        }}
      >
        <div className={`w-4 h-4 ${
          i % 2 === 0 ? 'rounded-full' : 'rounded-lg'
        } ${
          ['bg-blue-300', 'bg-purple-300', 'bg-pink-300', 'bg-cyan-300'][Math.floor(Math.random() * 4)]
        }`} />
      </motion.div>
    ))}
  </div>
)

// Modern floating elements
const FloatingElements = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    {['🚀', '⭐', '✨', '🎯', '🎨', '🧠', '��', '💡'].map((emoji, i) => (
      <motion.div
        key={i}
        className="absolute text-2xl opacity-60"
        initial={{ 
          x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200), 
          y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
          opacity: 0
        }}
        animate={{ 
          x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200), 
          y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
          opacity: [0, 0.6, 0],
          scale: [0.5, 1.2, 0.5],
          rotate: [0, 180, 360]
        }}
        transition={{ 
          duration: 12 + Math.random() * 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: i * 0.8
        }}
      >
        {emoji}
      </motion.div>
    ))}
  </div>
)

// Modern stat card with glassmorphism effect
const ModernStatCard = ({ icon, value, label, gradient, delay = 0, description }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9, y: 20 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ delay, type: "spring", stiffness: 100 }}
    whileHover={{ 
      scale: 1.05,
      y: -5,
      transition: { duration: 0.2 }
    }}
    className="h-full"
  >
    <Card className="border-0 rounded-2xl shadow-lg bg-white/70 dark:bg-gray-800/70 backdrop-blur-md overflow-hidden h-full group hover:shadow-xl transition-all duration-300">
      <CardContent className="p-6 text-center relative h-full flex flex-col justify-center">
        {/* Gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />
        
        {/* Animated background icon */}
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            duration: 20, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="absolute top-3 right-3 w-6 h-6 opacity-20"
        >
          <Sparkles className="w-full h-full" />
        </motion.div>
        
        <motion.div 
          className="text-4xl mb-3 flex justify-center"
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        >
          {icon}
        </motion.div>
        <div className="text-3xl font-bold mb-2 text-gray-800 dark:text-white">{value}</div>
        <div className="font-semibold text-sm text-gray-600 dark:text-gray-300 mb-1">{label}</div>
        {description && (
          <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
        )}
      </CardContent>
    </Card>
  </motion.div>
)

// Modern action button with improved design
const ModernActionButton = ({ icon, label, onClick, gradient, delay = 0, description }) => (
  <motion.button
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, type: "spring" }}
    whileHover={{ 
      scale: 1.05,
      y: -3,
      transition: { duration: 0.2 }
    }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`w-full h-36 p-6 rounded-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-md text-gray-800 dark:text-white font-semibold shadow-lg hover:shadow-xl transform transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50 flex flex-col items-center justify-center group relative overflow-hidden`}
  >
    {/* Gradient overlay on hover */}
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
    
    <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">{icon}</div>
    <div className="text-center leading-tight text-base font-bold">{label}</div>
    {description && (
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</div>
    )}
  </motion.button>
)

// Modern progress card with better visual hierarchy
const ModernProgressCard = ({ lesson, progress, onContinue, delay = 0 }) => {
  const config = subjectConfig[lesson.subject] || subjectConfig['English']
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: "spring" }}
      whileHover={{ 
        scale: 1.02,
        y: -5,
        transition: { duration: 0.2 }
      }}
      className="h-full"
    >
      <Card className="border-0 rounded-2xl shadow-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-md overflow-hidden group h-full flex flex-col hover:shadow-xl transition-all duration-300">
        <div className={`h-16 bg-gradient-to-r ${config.gradient} flex items-center justify-center relative overflow-hidden flex-shrink-0`}>
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 10, -10, 0]
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="text-3xl"
          >
            {config.icon}
          </motion.div>
          
          {/* Floating particles */}
          <motion.div
            animate={{ 
              y: [0, -8, 0],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="absolute top-2 right-3 w-1.5 h-1.5 bg-white rounded-full"
          />
          <motion.div
            animate={{ 
              y: [0, -12, 0],
              opacity: [0.3, 1, 0.3]
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: 1
            }}
            className="absolute bottom-3 left-4 w-2 h-2 bg-white rounded-full"
          />
        </div>
        
        <CardContent className="p-5 flex-1 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-800 dark:text-white text-base mb-2 leading-tight line-clamp-2">
                  {lesson.title}
                </h4>
                <Badge className={`bg-gradient-to-r ${config.gradient} text-white border-0 text-xs font-semibold`}>
                  {lesson.subject}
                </Badge>
              </div>
              <div className="text-right ml-3 flex-shrink-0">
                <div className="text-xl font-bold text-gray-800 dark:text-white">
                  {progress}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Complete
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-gray-600 dark:text-gray-300">Progress</span>
                <span className="text-blue-600 dark:text-blue-400">Keep going! 🎯</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
          
          <Button 
            onClick={onContinue}
            className={`w-full rounded-xl bg-gradient-to-r ${config.gradient} text-white font-semibold shadow-md hover:shadow-lg transform hover:scale-105 transition-all border-0 mt-3 text-sm`}
          >
            <Play className="mr-2 h-4 w-4" />
            Continue Learning
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function StudentDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [quickStats, setQuickStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchDashboardData = async () => {
    try {
      const [dashboardResult, statsResult] = await Promise.all([
        getStudentDashboardData(),
        getQuickStats()
      ]);

      if (dashboardResult.success) {
        setDashboardData(dashboardResult.data);
      } else {
        toast.error(dashboardResult.error || 'Failed to load dashboard data');
      }

      if (statsResult.success) {
        setQuickStats(statsResult.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 flex items-center justify-center">
        <div className="text-center space-y-6">
          <motion.div
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full mx-auto"
          />
          <div className="space-y-2">
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 animate-pulse">
              Loading your learning dashboard... ✨
            </p>
            <div className="flex justify-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">Failed to load dashboard data</p>
          <Button onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const { user, stats, subjectProgress, recentProgress, recentAchievements, recentConversations } = dashboardData;

  // Calculate statistics
  const totalLessons = recentProgress?.length || 0;
  const totalResources = stats?.totalResources || 0;
  const completedResources = stats?.completedResources || 0;
  const activeResources = stats?.inProgressResources || 0;
  const totalProgress = totalResources > 0 ? Math.round((completedResources / totalResources) * 100) : 0;
  const streak = stats?.learningStreak || 0;
  const level = Math.floor((totalProgress / 10)) + 1;

  // Get recent lessons with progress
  const recentLessons = recentProgress?.slice(0, 3).map(progress => {
    const progressPercentage = progress.progress?.percentage || 0;
    return { 
      _id: progress._id,
      title: progress.contentTitle,
      subject: progress.subject,
      progress: progressPercentage
    };
  }) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 relative overflow-hidden">
      <ModernBackground />
      <FloatingElements />
      
      <div className="relative z-10 mx-auto max-w-7xl p-6 md:p-8 space-y-8">
        
        {/* Modern Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <div className="relative">
            <motion.h1 
              className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
              animate={{ 
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
              }}
              transition={{ 
                duration: 3, 
                repeat: Infinity, 
                ease: "linear" 
              }}
            >
              Welcome to Your Learning Hub! 🌟
            </motion.h1>
            
            {/* Floating stars */}
            <motion.div
              animate={{ 
                rotate: 360,
                scale: [1, 1.2, 1]
              }}
              transition={{ 
                duration: 15, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              className="absolute -top-3 -right-2 text-2xl"
            >
              ⭐
            </motion.div>
            <motion.div
              animate={{ 
                y: [0, -8, 0],
                rotate: [0, 180, 360]
              }}
              transition={{ 
                duration: 4, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="absolute -top-1 -left-2 text-xl"
            >
              🌟
            </motion.div>
            <motion.div
              animate={{ 
                x: [0, 8, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 3, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="absolute top-6 -right-1 text-lg"
            >
              ✨
            </motion.div>
          </div>
          
          <motion.p 
            className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Hello {user?.name?.split(' ')[0] || 'Super Student'}! Ready for another amazing day of learning? 🚀
          </motion.p>
        </motion.div>

        {/* Modern User Profile Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
        >
          <Card className="border-0 rounded-2xl shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-md overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row items-center gap-6">
                <div className="relative flex-shrink-0">
                  <Avatar className="h-20 w-20 border-4 border-white dark:border-gray-800 shadow-lg">
                    <AvatarImage src="/student-img.jpg" alt="Student" />
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-2xl font-bold">
                      {user?.name?.charAt(0) || 'S'}
                    </AvatarFallback>
                  </Avatar>
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [1, 0.7, 1]
                    }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    }}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-3 border-white dark:border-gray-800"
                  />
                </div>
                
                <div className="flex-1 text-center lg:text-left min-w-0">
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-1 leading-tight">
                    {user?.name || 'Student'}
                  </h2>
                  <p className="text-base text-gray-600 dark:text-gray-300 mb-3">
                    Grade {user?.grades?.[0] || '8'} • {user?.role || 'Student'}
                  </p>
                  
                  <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                    <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 px-3 py-1 text-xs font-semibold">
                      <Crown className="w-3 h-3 mr-1" />
                      Level {level}
                    </Badge>
                    <Badge className="bg-gradient-to-r from-orange-400 to-red-500 text-white border-0 px-3 py-1 text-xs font-semibold">
                      <Flame className="w-3 h-3 mr-1" />
                      {streak} Day Streak
                    </Badge>
                    <Badge className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white border-0 px-3 py-1 text-xs font-semibold">
                      <Target className="w-3 h-3 mr-1" />
                      {totalProgress}% Complete
                    </Badge>
                  </div>
                </div>
                
                <Button 
                  onClick={handleRefresh}
                  variant="outline"
                  className="rounded-xl border-2 hover:bg-gray-50 dark:hover:bg-gray-700 transform hover:scale-105 transition-all flex-shrink-0"
                  disabled={refreshing}
                >
                  {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Modern Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ModernStatCard 
            icon="📚" 
            value={totalResources} 
            label="Total Resources" 
            gradient={modernGradients.primary}
            delay={0.1}
            description="Available to learn"
          />
          <ModernStatCard 
            icon="✅" 
            value={completedResources} 
            label="Completed" 
            gradient={modernGradients.success}
            delay={0.2}
            description="Great job!"
          />
          <ModernStatCard 
            icon="⏰" 
            value={Math.round((stats?.totalStudyTime || 0) / 60)} 
            label="Hours Studied" 
            gradient={modernGradients.warning}
            delay={0.3}
            description="Keep it up!"
          />
          <ModernStatCard 
            icon="🏆" 
            value={stats?.totalAchievements || 0} 
            label="Achievements" 
            gradient={modernGradients.fun}
            delay={0.4}
            description="You're amazing!"
          />
        </div>

        {/* Modern Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4 text-center">
            What would you like to do today? 🎯
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ModernActionButton 
              icon="📚" 
              label="Start Learning" 
              onClick={() => window.location.href = '/student/learning-library'}
              gradient={modernGradients.primary}
              delay={0.1}
              description="Explore new lessons"
            />
            <ModernActionButton 
              icon="🧠" 
              label="AI Tutor" 
              onClick={() => window.location.href = '/student/ai-tutor'}
              gradient={modernGradients.secondary}
              delay={0.2}
              description="Get help anytime"
            />
            <ModernActionButton 
              icon="🏆" 
              label="Achievements" 
              onClick={() => window.location.href = '/student/achievements'}
              gradient={modernGradients.warning}
              delay={0.3}
              description="View your progress"
            />
            <ModernActionButton 
              icon="📊" 
              label="My Progress" 
              onClick={() => window.location.href = '/student/history'}
              gradient={modernGradients.success}
              delay={0.4}
              description="Track your journey"
            />
          </div>
        </motion.div>

        {/* Modern Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl p-1 shadow-lg">
            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white font-semibold">
              <BookOpen className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="progress" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white font-semibold">
              <TrendingUp className="h-4 w-4 mr-2" />
              Progress
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Recent Lessons */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-500" />
                Continue Your Journey ��
              </h3>
              
              {recentLessons.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentLessons.map((lesson, index) => (
                    <ModernProgressCard 
                      key={lesson._id} 
                      lesson={lesson} 
                      progress={lesson.progress}
                      onContinue={() => window.location.href = '/student/learning-library'}
                      delay={index * 0.1}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <img src="/student-img.jpg" alt="Student" className="w-24 h-24 mx-auto mb-4 rounded-full object-cover shadow-lg" />
                  <p className="text-lg text-gray-600 dark:text-gray-300 font-semibold mb-4">
                    Ready to start your learning adventure?
                  </p>
                  <Button 
                    onClick={() => window.location.href = '/student/learning-library'}
                    className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold text-base px-6 py-3 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                  >
                    <Rocket className="mr-2 h-4 w-4" />
                    Explore Lessons! 🚀
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Overall Progress */}
              <Card className="border-0 rounded-2xl shadow-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-md overflow-hidden h-full">
                <CardHeader className="bg-gradient-to-r from-blue-400 to-purple-400 text-white p-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Your Learning Progress 📊
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4 flex-1">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Overall Completion</span>
                      <span className="font-bold text-blue-600 text-xl">{totalProgress}%</span>
                    </div>
                    <Progress value={totalProgress} className="h-3" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-xl">
                      <div className="text-2xl mb-1">📚</div>
                      <p className="text-lg font-bold text-gray-800 dark:text-white">{totalResources}</p>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Total Resources</p>
                    </div>
                    <div className="text-center p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 rounded-xl">
                      <div className="text-2xl mb-1">✅</div>
                      <p className="text-lg font-bold text-gray-800 dark:text-white">{completedResources}</p>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Completed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Learning Streak */}
              <Card className="border-0 rounded-2xl shadow-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-md overflow-hidden h-full">
                <CardHeader className="bg-gradient-to-r from-orange-400 to-red-400 text-white p-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Flame className="h-5 w-5" />
                    Learning Streak 🔥
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 text-center flex-1 flex flex-col justify-center">
                  <motion.div
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    }}
                    className="text-5xl mb-3"
                  >
                    🔥
                  </motion.div>
                  <div className="text-3xl font-bold text-gray-800 dark:text-white mb-1">
                    {streak} Days
                  </div>
                  <p className="text-base text-gray-600 dark:text-gray-300 font-medium">
                    Keep the fire burning! 💪
                  </p>
                  
                  {streak >= 7 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 1, type: "spring" }}
                      className="mt-3 p-2 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-800 dark:to-orange-800 rounded-xl"
                    >
                      <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-300 font-semibold text-sm">
                        <Trophy className="h-4 w-4" />
                        <span>Week Warrior! 🏆</span>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modern Motivational Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="text-center"
        >
          <Card className="border-0 rounded-2xl shadow-xl bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-white max-w-lg mx-auto overflow-hidden transform hover:scale-105 transition-all">
            <CardContent className="p-6">
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="text-4xl mb-3"
              >
                ��
              </motion.div>
              <p className="text-xl font-bold mb-2">You're Amazing! ✨</p>
              <p className="font-medium text-base">Every day you learn, you grow stronger! 🚀</p>
              <div className="flex justify-center gap-2 mt-3">
                <motion.span 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  className="text-xl"
                >
                  🚀
                </motion.span>
                <motion.span 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  className="text-xl"
                >
                  ⭐
                </motion.span>
                <motion.span 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  className="text-xl"
                >
                  🚀
                </motion.span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};