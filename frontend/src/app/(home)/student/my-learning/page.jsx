"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BookOpen, 
  Clock, 
  Trophy, 
  Star, 
  MessageSquare, 
  Eye, 
  Bookmark,
  BookmarkCheck,
  TrendingUp,
  Target,
  Award,
  Loader2,
  CheckCircle,
  PlayCircle,
  FileText,
  Presentation,
  Image,
  Video,
  Search,
  FileCheck,
  Play,
  Sparkles,
  Gamepad2,
  Film,
  ExternalLink,
  ImageIcon,
  Heart,
  BarChart3,
  Zap,
  Calendar
} from "lucide-react";
import { toast } from "sonner";
import StartLearning from "@/components/ui/start-learning";
import { 
  getStudentProgress, 
  addFeedback, 
  updateFeedback, 
  deleteFeedback, 
  toggleBookmark,
  getProgressStats 
} from "./action";

// Beautiful gradients matching learning-library
const gradients = {
  Math: 'from-yellow-300 via-orange-300 to-red-400',
  Science: 'from-green-300 via-blue-300 to-purple-400',
  English: 'from-pink-300 via-purple-300 to-indigo-400',
  History: 'from-amber-300 via-orange-400 to-red-400',
  Art: 'from-purple-300 via-pink-300 to-red-300',
  Geography: 'from-green-400 via-teal-400 to-blue-500',
  Physics: 'from-blue-400 via-indigo-400 to-purple-500',
  Chemistry: 'from-green-400 via-emerald-400 to-teal-500',
  Biology: 'from-green-300 via-lime-300 to-emerald-400',
  'Computer Science': 'from-gray-400 via-blue-400 to-indigo-500',
  'Social Studies': 'from-orange-300 via-red-300 to-pink-400',
  Music: 'from-purple-300 via-pink-300 to-red-300',
  'Physical Education': 'from-green-300 via-emerald-300 to-teal-400',
  'Foreign Languages': 'from-blue-300 via-indigo-300 to-purple-400',
  Business: 'from-gray-300 via-blue-300 to-indigo-400',
  Health: 'from-green-300 via-emerald-300 to-teal-400'
};

// Content type characters and icons
const typeCharacters = {
  slides: '📄',
  video: '🎥', 
  comic: '📖',
  image: '🖼️',
  content: '📝',
  assessment: '🎯',
  lesson: '📚',
  websearch: '🔍'
};

const contentTypes = {
  content: { label: "Content", icon: FileText, color: "bg-blue-100 text-blue-800" },
  slides: { label: "Slides", icon: Presentation, color: "bg-purple-100 text-purple-800" },
  comic: { label: "Comics", icon: BookOpen, color: "bg-green-100 text-green-800" },
  image: { label: "Images", icon: Image, color: "bg-pink-100 text-pink-800" },
  video: { label: "Videos", icon: Video, color: "bg-red-100 text-red-800" },
  assessment: { label: "Assessments", icon: FileCheck, color: "bg-yellow-100 text-yellow-800" },
  websearch: { label: "Web Search", icon: Search, color: "bg-indigo-100 text-indigo-800" },
  lesson: { label: "Lessons", icon: BookOpen, color: "bg-emerald-100 text-emerald-800" }
};

// Progress Character Component
const ProgressCharacter = () => (
  <div className="hidden lg:block absolute right-4 top-4">
    <div className="relative w-24 h-24">
      <div className="absolute -top-2 -right-2 text-xl" style={{ animation: 'gentle-spin 6s linear infinite' }}>⭐</div>
      <div className="absolute -top-6 right-2 text-lg" style={{ animation: 'gentle-pulse 3s ease-in-out infinite' }}>✨</div>
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
      `}</style>
    </div>
  </div>
);

export default function MyLearningPage() {
  const [progressData, setProgressData] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedContent, setSelectedContent] = useState(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [editingFeedback, setEditingFeedback] = useState(null);
  const [isStartLearningOpen, setIsStartLearningOpen] = useState(false);
  const [feedbackDialog, setFeedbackDialog] = useState({ open: false, content: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [progressResult, statsResult] = await Promise.all([
        getStudentProgress(),
        getProgressStats()
      ]);

      if (progressResult.success) {
        console.log('Progress data loaded:', progressResult.data);
        setProgressData(progressResult.data || []);
      } else {
        console.error('Failed to load progress:', progressResult.error);
        toast.error("Failed to load your learning progress");
      }

      if (statsResult.success) {
        console.log('Stats loaded:', statsResult.data);
        setStats(statsResult.data);
      } else {
        console.error('Failed to load stats:', statsResult.error);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load your learning data");
    }
  };

  const handleStartLearning = (content) => {
    setSelectedContent(content);
    setIsStartLearningOpen(true);
  };

  const handleLearningComplete = (contentId, completionData) => {
    // Update the progress data with completion information
    setProgressData(prevData => 
      prevData.map(item => 
        item.contentId === contentId 
          ? { 
              ...item, 
              status: 'completed',
              completionData,
              progress: { ...item.progress, completedAt: new Date() }
            }
          : item
      )
    );
    
    // Close the learning dialog
    setIsStartLearningOpen(false);
    setSelectedContent(null);
    
    // Show success message
    toast.success(" Great job! You've completed this content!");
    
    // Reload data to get updated stats
    loadData();
  };

  const handleAddFeedback = (content) => {
    setFeedbackDialog({ open: true, content });
    setFeedbackText("");
    setEditingFeedback(null);
  };

  const handleEditFeedback = (content, feedback) => {
    setFeedbackDialog({ open: true, content });
    setFeedbackText(feedback.text);
    setEditingFeedback(feedback);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim() || !feedbackDialog.content) return;

    try {
      let result;
      if (editingFeedback) {
        result = await updateFeedback(editingFeedback._id, feedbackText);
      } else {
        result = await addFeedback(feedbackDialog.content.contentId, feedbackText);
      }

      if (result.success) {
        toast.success(editingFeedback ? "Feedback updated successfully!" : "Feedback added successfully!");
        setFeedbackDialog({ open: false, content: null });
        setFeedbackText("");
        setEditingFeedback(null);
        loadData(); // Reload to get updated data
      } else {
        toast.error(result.error || "Failed to submit feedback");
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback");
    }
  };

  const handleToggleBookmark = async (contentId, isBookmarked) => {
    try {
      const result = await toggleBookmark(contentId, !isBookmarked);
      if (result.success) {
        toast.success(isBookmarked ? "Removed from bookmarks" : "Added to bookmarks");
        loadData(); // Reload to get updated data
      } else {
        toast.error(result.error || "Failed to update bookmark");
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      toast.error("Failed to update bookmark");
    }
  };

  const getItemColor = (subject) => gradients[subject] || 'from-gray-300 to-gray-400';

  const formatTime = (minutes) => {
    if (!minutes || minutes === 0) return "0m";
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  const getTabIcon = (tabValue) => {
    switch(tabValue) {
      case 'all': return <Sparkles className="mr-1 h-4 w-4" />
      case 'completed': return <CheckCircle className="mr-1 h-4 w-4" />
      case 'in_progress': return <PlayCircle className="mr-1 h-4 w-4" />
      case 'bookmarked': return <Bookmark className="mr-1 h-4 w-4" />
      default: return <Sparkles className="mr-1 h-4 w-4" />
    }
  };

  const renderProgressCard = (item, index) => {
    const isCompleted = item.status === 'completed';
    const progress = item.progress?.percentage || 0;
    const timeSpent = item.progress?.timeSpent || 0;
    const score = item.completionData?.score;
    const feedback = item.completionData?.feedback;
    const bookmarked = item.metadata?.bookmarked || false;
    
    return (
      <motion.div
        key={`${item._id}-${index}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        whileHover={{ y: -5 }}
      >
        <Card 
          className={`border-0 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 bg-white dark:bg-gray-800 overflow-hidden group cursor-pointer h-full ${
            isCompleted ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20' : ''
          }`}
          onClick={() => handleStartLearning(item)}
        >
          <div className={`relative h-32 bg-gradient-to-br ${getItemColor(item.subject)} flex items-center justify-center overflow-hidden`}>
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-2 left-2 w-5 h-5 bg-white rounded-full"></div>
              <div className="absolute top-3 right-3 w-4 h-4 bg-white rounded-full"></div>
              <div className="absolute bottom-2 left-3 w-6 h-6 bg-white rounded-full"></div>
            </div>
            <div className="relative z-10 text-5xl transition-transform duration-300 group-hover:scale-110">
              {typeCharacters[item.contentType] || '📄'}
            </div>
            {isCompleted && (
              <div className="absolute right-2 top-2">
                <Badge className="bg-emerald-600 text-white border-0 flex items-center gap-1 shadow-lg">
                  <CheckCircle className="h-3 w-3" /> Completed
                </Badge>
              </div>
            )}
            <div className="absolute bottom-2 left-2">
              <Badge className="bg-black/20 text-white border-0 text-xs font-semibold backdrop-blur-sm">
                {score ? `🏆 ${score}%` : `⭐ ${Math.round(progress)}%`}
              </Badge>
            </div>
            <div className="absolute top-2 left-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleBookmark(item.contentId, bookmarked);
                }}
                className="p-1 h-8 w-8 bg-white/20 hover:bg-white/30 backdrop-blur-sm"
              >
                {bookmarked ? (
                  <BookmarkCheck className="h-4 w-4 text-white" />
                ) : (
                  <Bookmark className="h-4 w-4 text-white" />
                )}
              </Button>
            </div>
          </div>
          <CardContent className="p-4 h-full flex flex-col">
            <div className="space-y-3 flex-1">
              <div>
                <h3 className="font-bold text-base text-gray-800 dark:text-white line-clamp-2 group-hover:text-purple-600 transition-colors">
                  {item.contentTitle || 'Untitled Content'}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mt-1">
                  {item.contentType || 'content'} • {item.subject || 'General'}
                </p>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`bg-gradient-to-r ${getItemColor(item.subject)} text-white border-0 font-semibold text-xs`}>
                  {item.subject || 'General'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Grade {item.grade || 'All'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {item.status?.replace('_', ' ') || 'not started'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(timeSpent)}
                </span>
                <span className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  {score ? `${score}%` : 'N/A'}
                </span>
              </div>

              {/* Progress indicator */}
              {!isCompleted && progress > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                    <span>Progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {/* Feedback Preview */}
              {feedback && (
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                    <strong>💬 Your feedback:</strong> {feedback}
                  </p>
                </div>
              )}

              {/* Completion Date */}
              {isCompleted && item.completionData?.completedAt && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Completed: {new Date(item.completionData.completedAt).toLocaleDateString()}
                </div>
              )}
            </div>
            
            <div className="mt-3 space-y-2">
              <Button 
                className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-300"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartLearning(item);
                }}
              >
                <Play className="mr-2 h-3 w-3" />
                {isCompleted ? 'Review' : 'Continue Learning!'} 🚀
              </Button>
              
              {isCompleted && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddFeedback(item);
                  }}
                >
                  <MessageSquare className="mr-2 h-3 w-3" />
                  {feedback ? 'Edit Feedback' : 'Add Feedback'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const filteredData = useMemo(() => {
    if (!progressData || progressData.length === 0) return [];
    
    switch (activeTab) {
      case 'completed':
        return progressData.filter(item => item.status === 'completed');
      case 'in_progress':
        return progressData.filter(item => item.status === 'in_progress');
      case 'bookmarked':
        return progressData.filter(item => item.metadata?.bookmarked);
      default:
        return progressData;
    }
  }, [progressData, activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-8 relative">
        <ProgressCharacter />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            My Learning Progress 🎓
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Track your learning journey, review completed content, and share your feedback! 
            Your progress and achievements are all here. 🌟
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
                <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  📊 Your Learning Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30">
                    <Target className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                    <p className="text-3xl font-bold text-blue-600">{stats.totalContent || 0}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Total Content</p>
                  </div>
                  
                  <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <p className="text-3xl font-bold text-green-600">{stats.completedContent || 0}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Completed</p>
                  </div>
                  
                  <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/30">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                    <p className="text-3xl font-bold text-yellow-600">{formatTime(stats.totalTimeSpent || 0)}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Time Spent</p>
                  </div>
                  
                  <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30">
                    <Award className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                    <p className="text-3xl font-bold text-purple-600">
                      {stats.averageScore ? Math.round(stats.averageScore) : 0}%
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Avg Score</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Progress Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="border-0 rounded-3xl shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                 Your Learning Journey
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-gray-100 dark:bg-gray-700 p-1">
                  <TabsTrigger value="all" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md">
                    {getTabIcon('all')} All Content
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md">
                    {getTabIcon('completed')} Completed
                  </TabsTrigger>
                  <TabsTrigger value="in_progress" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md">
                    {getTabIcon('in_progress')} In Progress
                  </TabsTrigger>
                  <TabsTrigger value="bookmarked" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md">
                    {getTabIcon('bookmarked')} Bookmarked
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="space-y-4">
                  <ScrollArea className="h-[600px]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pr-4">
                      <AnimatePresence>
                        {filteredData.map((item, index) => renderProgressCard(item, index))}
                      </AnimatePresence>
                    </div>
                    {filteredData.length === 0 && (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">📚</div>
                        <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">
                          No content found
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                          {activeTab === 'all' ? 'Start learning to see your progress here!' : 
                           `No ${activeTab.replace('_', ' ')} content yet.`}
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>

        {/* Start Learning Dialog */}
        <StartLearning
          isOpen={isStartLearningOpen}
          onClose={() => setIsStartLearningOpen(false)}
          content={selectedContent}
          onComplete={handleLearningComplete}
          studentProgress={selectedContent}
        />

        {/* Feedback Dialog */}
        <Dialog open={feedbackDialog.open} onOpenChange={(open) => setFeedbackDialog({ open, content: null })}>
          <DialogContent className="sm:max-w-[500px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                💬 Share Your Feedback
              </DialogTitle>
              <DialogDescription className="text-lg">
                Help us improve by sharing your thoughts about "{feedbackDialog.content?.contentTitle}"
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="What did you think about this content? Was it helpful? Any suggestions for improvement? Share your experience!"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="min-h-[120px] rounded-xl border-2 focus:border-purple-500"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setFeedbackDialog({ open: false, content: null })}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitFeedback}
                  disabled={false} // No submitting state in this simplified version
                  className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  {editingFeedback ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Save Feedback
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}