"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Trophy, 
  Star, 
  Award, 
  Target, 
  Zap, 
  Crown,
  Gem,
  Medal,
  Shield,
  Flame,
  Sparkles,
  Loader2,
  RefreshCw,
  TrendingUp,
  Calendar,
  Clock,
  BookOpen,
  Brain,
  Rocket,
  Gift,
  PartyPopper,
  CheckCircle,
  Lock,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "sonner";
import { 
  getStudentAchievements, 
  getAchievementStats, 
  checkAndAwardAchievements,
  getAllAvailableAchievements,
} from "./action";

// Achievement categories with colors and icons
const achievementCategories = {
  progress: { 
    label: 'Progress', 
    icon: TrendingUp, 
    color: 'from-blue-400 to-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20'
  },
  time: { 
    label: 'Time', 
    icon: Clock, 
    color: 'from-green-400 to-green-600',
    bgColor: 'bg-green-50 dark:bg-green-900/20'
  },
  performance: { 
    label: 'Performance', 
    icon: Target, 
    color: 'from-purple-400 to-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20'
  },
  subject: { 
    label: 'Subjects', 
    icon: BookOpen, 
    color: 'from-orange-400 to-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20'
  },
  streak: { 
    label: 'Streaks', 
    icon: Flame, 
    color: 'from-red-400 to-red-600',
    bgColor: 'bg-red-50 dark:bg-red-900/20'
  },
  special: { 
    label: 'Special', 
    icon: Sparkles, 
    color: 'from-pink-400 to-pink-600',
    bgColor: 'bg-pink-50 dark:bg-pink-900/20'
  }
};

// Achievement Character Component
const AchievementCharacter = () => (
  <div className="hidden lg:block absolute right-4 top-4">
    <div className="relative w-24 h-24">
      <div className="absolute inset-0 text-5xl" style={{ animation: 'gentle-bounce 4s ease-in-out infinite' }}>🎉</div>
      <div className="absolute -top-2 -right-2 text-xl" style={{ animation: 'gentle-spin 6s linear infinite' }}>⭐</div>
      <div className="absolute -top-6 right-2 text-lg" style={{ animation: 'gentle-pulse 3s ease-in-out infinite' }}>✨</div>
      <div className="absolute -bottom-2 -left-2 text-lg" style={{ animation: 'gentle-float 5s ease-in-out infinite' }}>🏆</div>
      <style jsx>{`
        @keyframes gentle-bounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes gentle-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes gentle-pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes gentle-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-5px) rotate(5deg); }
        }
      `}</style>
    </div>
  </div>
);

export default function AchievementPage() {
  const [achievements, setAchievements] = useState([]);
  const [allAchievements, setAllAchievements] = useState([]);
  const [stats, setStats] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingAchievements, setCheckingAchievements] = useState(false);
  const [activeTab, setActiveTab] = useState("earned");
  const [showLocked, setShowLocked] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [achievementsResult, statsResult, allAchievementsResult, progressResult] = await Promise.all([
        getStudentAchievements(),
        getAchievementStats(),
        getAllAvailableAchievements(),
        getAchievementProgress()
      ]);

      if (achievementsResult.success) {
        setAchievements(achievementsResult.data);
      }

      if (statsResult.success) {
        setStats(statsResult.data);
      }

      if (allAchievementsResult.success) {
        setAllAchievements(allAchievementsResult.data);
      }

      if (progressResult.success) {
        setProgress(progressResult.data);
      }
    } catch (error) {
      console.error("Error loading achievement data:", error);
      toast.error("Failed to load achievement data");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAchievements = async () => {
    setCheckingAchievements(true);
    console.log(' Client: Starting to check achievements...');
    
    try {
      const result = await checkAndAwardAchievements();
      console.log(' Client: Achievement check result:', result);
      
      if (result.success) {
        if (result.data.totalNew > 0) {
          toast.success(`🎉 Congratulations! You earned ${result.data.totalNew} new achievement${result.data.totalNew > 1 ? 's' : ''}!`);
          console.log('🎯 Client: New achievements earned:', result.data.newAchievements);
          loadData(); // Reload data to show new achievements
        } else {
          toast.info("No new achievements earned yet. Keep learning!");
          console.log(' Client: No new achievements earned');
        }
      } else {
        toast.error("Failed to check achievements");
        console.log('🎯 Client: Achievement check failed:', result.error);
      }
    } catch (error) {
      console.error("🎯 Client: Error checking achievements:", error);
      toast.error("Failed to check achievements");
    } finally {
      setCheckingAchievements(false);
    }
  };

  const getCategoryIcon = (category) => {
    const categoryInfo = achievementCategories[category];
    return categoryInfo ? categoryInfo.icon : Trophy;
  };

  const getCategoryColor = (category) => {
    const categoryInfo = achievementCategories[category];
    return categoryInfo ? categoryInfo.color : 'from-gray-400 to-gray-600';
  };

  const getCategoryBgColor = (category) => {
    const categoryInfo = achievementCategories[category];
    return categoryInfo ? categoryInfo.bgColor : 'bg-gray-50 dark:bg-gray-900/20';
  };

  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getAchievementProgress = (achievement) => {
    if (!progress || achievement.earned) return { current: 100, target: 100, percentage: 100 };

    let current = 0;
    let target = 0;

    switch (achievement.category) {
      case 'progress':
        if (achievement.criteria.completedContent) {
          current = progress.completedContent;
          target = achievement.criteria.completedContent;
        }
        break;
      case 'time':
        if (achievement.criteria.totalTimeSpent) {
          current = progress.totalTimeSpent;
          target = achievement.criteria.totalTimeSpent;
        }
        break;
      case 'performance':
        if (achievement.criteria.perfectScore) {
          current = progress.perfectScores;
          target = achievement.criteria.perfectScore;
        } else if (achievement.criteria.averageScore) {
          current = Math.round(progress.averageScore);
          target = achievement.criteria.averageScore;
        } else if (achievement.criteria.goodScores) {
          current = progress.goodScores;
          target = achievement.criteria.goodScores;
        }
        break;
      case 'subject':
        const subjectStat = progress.subjectStats[achievement.criteria.subject];
        if (subjectStat) {
          current = subjectStat.completed;
          target = achievement.criteria.completedContent;
        }
        break;
      case 'special':
        if (achievement.criteria.feedbackCount) {
          current = progress.feedbackCount;
          target = achievement.criteria.feedbackCount;
        } else if (achievement.criteria.bookmarkedContent) {
          current = progress.bookmarkedContent;
          target = achievement.criteria.bookmarkedContent;
        }
        break;
    }

    const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    return { current, target, percentage };
  };

  const renderAchievementCard = (achievement, index) => {
    const isEarned = achievement.earned;
    const progressData = getAchievementProgress(achievement);
    const CategoryIcon = getCategoryIcon(achievement.category);

    return (
      <motion.div
        key={`${achievement.id}-${index}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.1 }}
        whileHover={{ y: -5, scale: 1.02 }}
      >
        <Card 
          className={`border-0 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer h-full ${
            isEarned 
              ? 'ring-2 ring-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20' 
              : 'bg-white dark:bg-gray-800'
          }`}
        >
          <div className={`relative h-32 bg-gradient-to-br ${getCategoryColor(achievement.category)} flex items-center justify-center overflow-hidden`}>
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-2 left-2 w-5 h-5 bg-white rounded-full"></div>
              <div className="absolute top-3 right-3 w-4 h-4 bg-white rounded-full"></div>
              <div className="absolute bottom-2 left-3 w-6 h-6 bg-white rounded-full"></div>
            </div>
            <div className="relative z-10 text-6xl transition-transform duration-300 group-hover:scale-110">
              {achievement.icon}
            </div>
            {isEarned && (
              <div className="absolute right-2 top-2">
                <Badge className="bg-yellow-500 text-white border-0 flex items-center gap-1 shadow-lg">
                  <CheckCircle className="h-3 w-3" /> Earned
                </Badge>
              </div>
            )}
            <div className="absolute bottom-2 left-2">
              <Badge className="bg-black/20 text-white border-0 text-xs font-semibold backdrop-blur-sm">
                {achievement.points} pts
              </Badge>
            </div>
            <div className="absolute top-2 left-2">
              <div className={`p-2 rounded-lg ${getCategoryBgColor(achievement.category)}`}>
                <CategoryIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </div>
            </div>
          </div>
          <CardContent className="p-4 h-full flex flex-col">
            <div className="space-y-3 flex-1">
              <div>
                <h3 className={`font-bold text-lg line-clamp-2 group-hover:text-purple-600 transition-colors ${
                  isEarned ? 'text-yellow-800 dark:text-yellow-200' : 'text-gray-800 dark:text-white'
                }`}>
                  {achievement.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mt-1">
                  {achievement.description}
                </p>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`bg-gradient-to-r ${getCategoryColor(achievement.category)} text-white border-0 font-semibold text-xs`}>
                  {achievementCategories[achievement.category]?.label}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {achievement.points} points
                </Badge>
              </div>

              {/* Progress indicator for unearned achievements */}
              {!isEarned && progressData.target > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                    <span>Progress</span>
                    <span>{progressData.current}/{progressData.target}</span>
                  </div>
                  <Progress value={progressData.percentage} className="h-2" />
                </div>
              )}

              {/* Earned date */}
              {isEarned && achievement.earnedAt && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Earned {new Date(achievement.earnedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const filteredAchievements = useMemo(() => {
    if (activeTab === "earned") {
      return allAchievements.filter(a => a.earned);
    } else if (activeTab === "locked") {
      return allAchievements.filter(a => !a.earned);
    } else {
      return allAchievements.filter(a => a.category === activeTab);
    }
  }, [allAchievements, activeTab]);

  const getTabIcon = (tabValue) => {
    switch(tabValue) {
      case 'earned': return <Trophy className="mr-1 h-4 w-4" />
      case 'locked': return <Lock className="mr-1 h-4 w-4" />
      case 'progress': return <TrendingUp className="mr-1 h-4 w-4" />
      case 'time': return <Clock className="mr-1 h-4 w-4" />
      case 'performance': return <Target className="mr-1 h-4 w-4" />
      case 'subject': return <BookOpen className="mr-1 h-4 w-4" />
      case 'streak': return <Flame className="mr-1 h-4 w-4" />
      case 'special': return <Sparkles className="mr-1 h-4 w-4" />
      default: return <Trophy className="mr-1 h-4 w-4" />
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 dark:from-gray-900 dark:via-yellow-900 dark:to-red-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-yellow-600" />
          <p className="text-lg text-gray-600 dark:text-gray-300">Loading your achievements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 dark:from-gray-900 dark:via-yellow-900 dark:to-red-900">
      <div className="container mx-auto px-4 py-8 relative">
        <AchievementCharacter />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 bg-clip-text text-transparent/10 mb-2">
            🎉 Achievement Hall 🏆
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Celebrate your learning journey! Unlock amazing achievements as you progress through your educational adventure. 
            Every milestone matters! 🌟
          </p>
        </motion.div>

        {/* Stats Overview */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8"
          >
            <Card className="border-0 rounded-3xl shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                    🎖️ Your Achievement Stats
                  </CardTitle>
                  <Button
                    onClick={handleCheckAchievements}
                    disabled={checkingAchievements}
                    className="rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                  >
                    {checkingAchievements ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Check New
                      </>
                    )}
                  </Button>

                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/30">
                    <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                    <p className="text-3xl font-bold text-yellow-600">{stats.total.totalAchievements}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Achievements</p>
                  </div>
                  
                  <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30">
                    <Star className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                    <p className="text-3xl font-bold text-orange-600">{stats.total.totalPoints}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Total Points</p>
                  </div>
                  
                  <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30">
                    <Crown className="h-8 w-8 mx-auto mb-2 text-red-600" />
                    <p className="text-3xl font-bold text-red-600">
                      {Math.round((stats.total.totalAchievements / 20) * 100)}%
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Completion</p>
                  </div>
                  
                  <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30">
                    <Gem className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                    <p className="text-3xl font-bold text-purple-600">
                      {stats.byCategory.length}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Categories</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Achievement Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="border-0 rounded-3xl shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                🎯 Achievement Collection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-8 rounded-2xl bg-gray-100 dark:bg-gray-700 p-1">
                  <TabsTrigger value="earned" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md">
                    {getTabIcon('earned')} Earned
                  </TabsTrigger>
                  <TabsTrigger value="locked" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md">
                    {getTabIcon('locked')} Locked
                  </TabsTrigger>
                  <TabsTrigger value="progress" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md">
                    {getTabIcon('progress')} Progress
                  </TabsTrigger>
                  <TabsTrigger value="time" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md">
                    {getTabIcon('time')} Time
                  </TabsTrigger>
                  <TabsTrigger value="performance" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md">
                    {getTabIcon('performance')} Performance
                  </TabsTrigger>
                  <TabsTrigger value="subject" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md">
                    {getTabIcon('subject')} Subjects
                  </TabsTrigger>
                  <TabsTrigger value="streak" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md">
                    {getTabIcon('streak')} Streaks
                  </TabsTrigger>
                  <TabsTrigger value="special" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md">
                    {getTabIcon('special')} Special
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="space-y-4">
                  <ScrollArea className="h-[600px]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pr-4">
                      <AnimatePresence>
                        {filteredAchievements.map((achievement, index) => renderAchievementCard(achievement, index))}
                      </AnimatePresence>
                    </div>
                    {filteredAchievements.length === 0 && (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">
                          {activeTab === 'earned' ? '🏆' : '🎉'}
                        </div>
                        <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">
                          {activeTab === 'earned' ? 'No achievements earned yet' : 'No achievements in this category'}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                          {activeTab === 'earned' 
                            ? 'Start learning to earn your first achievement!' 
                            : 'Keep learning to unlock more achievements!'}
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}