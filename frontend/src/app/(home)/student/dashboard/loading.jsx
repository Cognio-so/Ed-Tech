'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  BookOpen, 
  Trophy, 
  MessageCircle, 
  Clock, 
  Target, 
  BarChart3,
  Activity,
  Award,
  Sparkles,
  Brain,
  CheckCircle,
  Crown,
  Flame,
  Play,
  Rocket,
  Star,
  Zap
} from 'lucide-react';

// Fun gradients for kids UI
const kidGradients = {
  purple: "from-violet-500 via-purple-500 to-indigo-500",
  orange: "from-amber-400 via-orange-500 to-pink-500",
  blue: "from-blue-400 via-cyan-500 to-sky-500",
  green: "from-emerald-400 via-green-500 to-teal-500",
  pink: "from-pink-400 via-rose-500 to-fuchsia-500",
  yellow: "from-yellow-400 via-orange-500 to-red-500",
  rainbow: "from-red-400 via-yellow-400 via-green-400 via-blue-400 to-purple-400"
}

// Animated background particles
const AnimatedBackground = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 dark:from-violet-950 dark:via-purple-950 dark:to-fuchsia-950" />
    {[...Array(20)].map((_, i) => (
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
          scale: [0.5, 1, 0.5]
        }}
        transition={{ 
          duration: 10 + Math.random() * 10,
          repeat: Infinity,
          ease: "linear"
        }}
      >
        <div className={`w-2 h-2 rounded-full opacity-60 ${
          ['bg-violet-400', 'bg-purple-400', 'bg-fuchsia-400', 'bg-pink-400'][Math.floor(Math.random() * 4)]
        }`} />
      </motion.div>
    ))}
  </div>
)

// Floating emojis component
const FloatingEmojis = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    {['🚀', '⭐', '✨', '🎯', '', '🎨', '‍', '🔥'].map((emoji, i) => (
      <motion.div
        key={i}
        className="absolute text-2xl"
        initial={{ 
          x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200), 
          y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
          opacity: 0
        }}
        animate={{ 
          x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200), 
          y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
          opacity: [0, 1, 0],
          scale: [0.5, 1.5, 0.5],
          rotate: [0, 180, 360]
        }}
        transition={{ 
          duration: 8 + Math.random() * 4,
          repeat: Infinity,
          ease: "easeInOut",
          delay: i * 0.5
        }}
      >
        {emoji}
      </motion.div>
    ))}
  </div>
)

// Animated stat card skeleton
const AnimatedStatCardSkeleton = ({ gradient, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8, y: 20 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ delay, type: "spring", stiffness: 100 }}
    className="h-full"
  >
    <Card className={`border-0 rounded-3xl shadow-xl bg-gradient-to-br ${gradient} text-white overflow-hidden h-full`}>
      <CardContent className="p-6 text-center relative h-full flex flex-col justify-center">
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.2, 1]
          }}
          transition={{ 
            duration: 20, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="absolute top-2 right-2 w-8 h-8 opacity-20"
        >
          <Sparkles className="w-full h-full" />
        </motion.div>
        
        <motion.div 
          className="text-5xl mb-4 flex justify-center"
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ 
            duration: 3, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        >
          <Skeleton className="w-12 h-12 rounded-full bg-white/20" />
        </motion.div>
        <Skeleton className="h-10 w-16 mx-auto mb-3 bg-white/20" />
        <Skeleton className="h-6 w-24 mx-auto bg-white/20" />
      </CardContent>
    </Card>
  </motion.div>
)

// Quick action button skeleton
const QuickActionButtonSkeleton = ({ gradient, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, type: "spring" }}
    className="w-full h-32 p-6 rounded-3xl bg-gradient-to-r shadow-lg border-0 flex flex-col items-center justify-center"
    style={{ background: `linear-gradient(to right, ${gradient})` }}
  >
    <Skeleton className="w-12 h-12 rounded-full bg-white/20 mb-3" />
    <Skeleton className="h-5 w-20 bg-white/20" />
  </motion.div>
)

// Progress card skeleton
const ProgressCardSkeleton = ({ delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, type: "spring" }}
    className="h-full"
  >
    <Card className="border-0 rounded-3xl shadow-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm overflow-hidden group h-full flex flex-col">
      <div className="h-20 bg-gradient-to-r from-violet-400 to-purple-400 flex items-center justify-center relative overflow-hidden flex-shrink-0">
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 10, -10, 0]
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="text-4xl"
        >
          
        </motion.div>
      </div>
      
      <CardContent className="p-6 flex-1 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <Skeleton className="h-6 w-full mb-2" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="text-right ml-4 flex-shrink-0">
              <Skeleton className="h-8 w-12 mb-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
        </div>
        
        <Skeleton className="h-12 w-full rounded-2xl mt-4" />
      </CardContent>
    </Card>
  </motion.div>
)

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 dark:from-violet-950 dark:via-purple-950 dark:to-fuchsia-950 relative overflow-hidden">
      <AnimatedBackground />
      <FloatingEmojis />
      
      <div className="relative z-10 mx-auto max-w-7xl p-6 md:p-8 space-y-8">
        
        {/* Animated Header Skeleton */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <div className="relative">
            <motion.div
              animate={{ 
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
              }}
              transition={{ 
                duration: 3, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              className="text-5xl md:text-6xl font-black bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent"
            >
              <Skeleton className="h-16 w-96 mx-auto" />
            </motion.div>
            
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
              className="absolute -top-4 -right-1 text-3xl"
            >
              ⭐
            </motion.div>
            <motion.div
              animate={{ 
                y: [0, -10, 0],
                rotate: [0, 180, 360]
              }}
              transition={{ 
                duration: 4, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="absolute -top-2 -left-1 text-2xl"
            >
              🌟
            </motion.div>
            <motion.div
              animate={{ 
                x: [0, 10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 3, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="absolute top-8 -right-2 text-xl"
            >
              ✨
            </motion.div>
          </div>
          
          <Skeleton className="h-6 w-80 mx-auto" />
        </motion.div>

        {/* User Profile Card Skeleton */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
        >
          <Card className="border-0 rounded-3xl shadow-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-8">
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <div className="relative flex-shrink-0">
                  <Avatar className="h-24 w-24 border-4 border-white dark:border-gray-800 shadow-xl">
                    <AvatarFallback className="bg-gradient-to-r from-violet-500 to-purple-500 text-white text-3xl font-bold">
                      <Skeleton className="w-8 h-8 rounded-full bg-white/20" />
                    </AvatarFallback>
                  </Avatar>
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [1, 0.5, 1]
                    }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    }}
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full border-4 border-white dark:border-gray-800"
                  />
                </div>
                
                <div className="flex-1 text-center lg:text-left min-w-0">
                  <Skeleton className="h-8 w-48 mb-2" />
                  <Skeleton className="h-5 w-32 mb-4" />
                  
                  <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                    <Skeleton className="h-8 w-20 rounded-full" />
                    <Skeleton className="h-8 w-24 rounded-full" />
                    <Skeleton className="h-8 w-28 rounded-full" />
                  </div>
                </div>
                
                <Skeleton className="h-10 w-24 rounded-2xl flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Stats Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <AnimatedStatCardSkeleton 
            gradient={kidGradients.purple}
            delay={0.1}
          />
          <AnimatedStatCardSkeleton 
            gradient={kidGradients.green}
            delay={0.2}
          />
          <AnimatedStatCardSkeleton 
            gradient={kidGradients.orange}
            delay={0.3}
          />
          <AnimatedStatCardSkeleton 
            gradient={kidGradients.pink}
            delay={0.4}
          />
        </div>

        {/* Quick Actions Skeleton */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Skeleton className="h-8 w-80 mx-auto mb-6" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <QuickActionButtonSkeleton 
              gradient="from-blue-400 to-cyan-500"
              delay={0.1}
            />
            <QuickActionButtonSkeleton 
              gradient="from-violet-500 to-purple-500"
              delay={0.2}
            />
            <QuickActionButtonSkeleton 
              gradient="from-amber-400 to-orange-500"
              delay={0.3}
            />
            <QuickActionButtonSkeleton 
              gradient="from-emerald-400 to-teal-500"
              delay={0.4}
            />
          </div>
        </motion.div>

        {/* Recent Lessons Skeleton */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-violet-500" />
            <Skeleton className="h-8 w-64" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ProgressCardSkeleton delay={0.1} />
            <ProgressCardSkeleton delay={0.2} />
            <ProgressCardSkeleton delay={0.3} />
          </div>
        </motion.div>

        {/* Progress Overview Skeleton */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
        >
          {/* Overall Progress Skeleton */}
          <Card className="border-0 rounded-3xl shadow-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm overflow-hidden h-full">
            <CardHeader className="bg-gradient-to-r from-violet-400 to-purple-400 text-white p-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6" />
                <Skeleton className="h-6 w-48 bg-white/20" />
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6 flex-1">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-12" />
                </div>
                <Skeleton className="h-4 w-full rounded-full" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 rounded-2xl">
                  <Skeleton className="h-8 w-8 mx-auto mb-2" />
                  <Skeleton className="h-8 w-12 mx-auto mb-2" />
                  <Skeleton className="h-4 w-20 mx-auto" />
                </div>
                <div className="text-center p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 rounded-2xl">
                  <Skeleton className="h-8 w-8 mx-auto mb-2" />
                  <Skeleton className="h-8 w-12 mx-auto mb-2" />
                  <Skeleton className="h-4 w-16 mx-auto" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Learning Streak Skeleton */}
          <Card className="border-0 rounded-3xl shadow-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm overflow-hidden h-full">
            <CardHeader className="bg-gradient-to-r from-amber-400 to-orange-400 text-white p-6">
              <div className="flex items-center gap-3">
                <Flame className="h-6 w-6" />
                <Skeleton className="h-6 w-32 bg-white/20" />
              </div>
            </CardHeader>
            <CardContent className="p-6 text-center flex-1 flex flex-col justify-center">
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
                className="text-6xl mb-4"
              >
                🔥
              </motion.div>
              <Skeleton className="h-10 w-20 mx-auto mb-2" />
              <Skeleton className="h-5 w-32 mx-auto" />
            </CardContent>
          </Card>
        </motion.div>

        {/* Motivational Message Skeleton */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="text-center"
        >
          <Card className="border-0 rounded-3xl shadow-2xl bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 text-white max-w-lg mx-auto overflow-hidden">
            <CardContent className="p-8">
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="text-6xl mb-4"
              >
                🌟
              </motion.div>
              <Skeleton className="h-8 w-48 mx-auto mb-3 bg-white/20" />
              <Skeleton className="h-6 w-64 mx-auto bg-white/20" />
              <div className="flex justify-center gap-2 mt-4">
                <motion.span 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  className="text-2xl"
                >
                  🚀
                </motion.span>
                <motion.span 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  className="text-2xl"
                >
                  ⭐
                </motion.span>
                <motion.span 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  className="text-2xl"
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
}
