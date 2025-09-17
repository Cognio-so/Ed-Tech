"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BookOpen, 
  MessageSquare, 
  FileText, 
  Image, 
  Video,
  Users,
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  BarChart3,
  PieChart,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  MoreHorizontal,
  Plus,
  Play,
  Edit,
  Trash2,
  Download,
  Share,
  Star,
  Award,
  Lightbulb,
  GraduationCap,
  BookMarked,
  FileCheck,
  Upload,
  Mic,
  Camera,
  PenTool
} from "lucide-react";
import { toast } from "sonner";
import { 
  getTeacherDashboardData,
  getTeacherQuickStats
} from "./action";

export default function TeacherDashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [quickStats, setQuickStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load dashboard data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardResult, statsResult] = await Promise.all([
        getTeacherDashboardData(),
        getTeacherQuickStats()
      ]);

      if (dashboardResult.success) {
        setDashboardData(dashboardResult.data);
      } else {
        toast.error(dashboardResult.error);
      }

      if (statsResult.success) {
        setQuickStats(statsResult.data);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Format date with better error handling
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  // Format relative time with better error handling
  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      const now = new Date();
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    } catch (error) {
      console.error('Error formatting relative time:', error);
      return 'Invalid Date';
    }
  };

  // Get content type icon
  const getContentTypeIcon = (type) => {
    switch (type) {
      case "lesson":
        return <BookOpen className="w-4 h-4" />;
      case "assessment":
        return <FileCheck className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      case "image":
        return <Image className="w-4 h-4" />;
      case "audio":
        return <Mic className="w-4 h-4" />;
      case "presentation":
        return <FileText className="w-4 h-4" />;
      case "comic":
        return <BookOpen className="w-4 h-4" />;
      case "websearch":
        return <Activity className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "draft":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "review":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "completed":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  // Handle quick action navigation
  const handleQuickAction = (action) => {
    switch (action) {
      case 'create-lesson':
        router.push('/teacher/content-generation');
        break;
      case 'build-assessment':
        router.push('/teacher/assessment-builder');
        break;
      case 'generate-video':
        router.push('/teacher/media-toolkit');
        break;
      case 'create-visual':
        router.push('/teacher/media-toolkit');
        break;
      case 'start-voice':
        router.push('/teacher/voice-coach');
        break;
      case 'manage-students':
        router.push('/teacher/class-grouping');
        break;
      default:
        toast.error('Navigation not implemented yet');
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {dashboardData?.user?.name}! Here's your teaching overview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <GraduationCap className="w-4 h-4 mr-1" />
            Teacher
          </Badge>
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Last 30 days
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      {dashboardData?.stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Conversations</p>
                  <p className="text-3xl font-bold">{dashboardData.stats.totalConversations}</p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+{dashboardData.stats.recentActivity} this week</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Content Generated</p>
                  <p className="text-3xl font-bold">{dashboardData.stats.totalContentGenerated}</p>
                  <div className="flex items-center mt-2">
                    <Lightbulb className="w-4 h-4 text-purple-500 mr-1" />
                    <span className="text-sm text-purple-600">Creative content</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Assessments Created</p>
                  <p className="text-3xl font-bold">{dashboardData.stats.totalAssessments}</p>
                  <div className="flex items-center mt-2">
                    <Target className="w-4 h-4 text-orange-500 mr-1" />
                    <span className="text-sm text-orange-600">Learning goals</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                  <FileCheck className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Productivity Score</p>
                  <p className="text-3xl font-bold">{dashboardData.stats.productivityScore}%</p>
                  <div className="flex items-center mt-2">
                    <Award className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">Excellent work!</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Productivity Overview and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productivity Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Productivity Overview
            </CardTitle>
            <CardDescription>
              Your teaching activity breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData?.stats && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm">Conversations</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{dashboardData.stats.totalConversations}</span>
                      <span className="text-xs text-muted-foreground">
                        ({Math.round((dashboardData.stats.totalConversations / (dashboardData.stats.totalConversations + dashboardData.stats.totalContentGenerated + dashboardData.stats.totalAssessments)) * 100)}%)
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={(dashboardData.stats.totalConversations / (dashboardData.stats.totalConversations + dashboardData.stats.totalContentGenerated + dashboardData.stats.totalAssessments)) * 100} 
                    className="h-2" 
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                      <span className="text-sm">Content Generated</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{dashboardData.stats.totalContentGenerated}</span>
                      <span className="text-xs text-muted-foreground">
                        ({Math.round((dashboardData.stats.totalContentGenerated / (dashboardData.stats.totalConversations + dashboardData.stats.totalContentGenerated + dashboardData.stats.totalAssessments)) * 100)}%)
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={(dashboardData.stats.totalContentGenerated / (dashboardData.stats.totalConversations + dashboardData.stats.totalContentGenerated + dashboardData.stats.totalAssessments)) * 100} 
                    className="h-2" 
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span className="text-sm">Assessments</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{dashboardData.stats.totalAssessments}</span>
                      <span className="text-xs text-muted-foreground">
                        ({Math.round((dashboardData.stats.totalAssessments / (dashboardData.stats.totalConversations + dashboardData.stats.totalContentGenerated + dashboardData.stats.totalAssessments)) * 100)}%)
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={(dashboardData.stats.totalAssessments / (dashboardData.stats.totalConversations + dashboardData.stats.totalContentGenerated + dashboardData.stats.totalAssessments)) * 100} 
                    className="h-2" 
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Start creating and teaching
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => handleQuickAction('create-lesson')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Lesson
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => handleQuickAction('build-assessment')}
            >
              <FileCheck className="w-4 h-4 mr-2" />
              Build Assessment
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => handleQuickAction('generate-video')}
            >
              <Video className="w-4 h-4 mr-2" />
              Generate Video Content
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => handleQuickAction('create-visual')}
            >
              <Image className="w-4 h-4 mr-2" />
              Create Visual Content
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => handleQuickAction('start-voice')}
            >
              <Mic className="w-4 h-4 mr-2" />
              Start Voice Session
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => handleQuickAction('manage-students')}
            >
              <Users className="w-4 h-4 mr-2" />
              Manage Students
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Recent Conversations
                </CardTitle>
                <CardDescription>
                  Your latest teaching sessions
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push('/teacher/history')}
              >
                <Eye className="w-4 h-4 mr-2" />
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {dashboardData?.recentConversations?.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No recent conversations found</p>
                <Button 
                  className="mt-4" 
                  variant="outline"
                  onClick={() => handleQuickAction('start-voice')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Start New Session
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {dashboardData?.recentConversations?.slice(0, 5).map((conversation) => (
                  <div key={conversation._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {conversation.sessionType === "voice" ? "🎤" : "💬"}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{conversation.title}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{conversation.messageCount} messages</span>
                          <span>•</span>
                          <span>{formatRelativeTime(conversation.lastMessageAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {conversation.sessionType}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Content */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Recent Content
                </CardTitle>
                <CardDescription>
                  Your latest created materials
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push('/teacher/library')}
              >
                <Plus className="w-4 h-4 mr-2" />
                View Library
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {dashboardData?.recentContent?.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No content created yet</p>
                <Button 
                  className="mt-4" 
                  variant="outline"
                  onClick={() => handleQuickAction('create-lesson')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Content
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {dashboardData?.recentContent?.slice(0, 5).map((content) => (
                  <div key={content._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                        {getContentTypeIcon(content.type)}
                      </div>
                      <div>
                        <p className="font-medium">{content.title}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="capitalize">{content.type}</span>
                          <span>•</span>
                          <span>{content.subject}</span>
                          <span>•</span>
                          <span>{formatRelativeTime(content.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(content.status)}>
                        {content.status}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Activity Chart */}
      {dashboardData?.weeklyActivity && dashboardData.weeklyActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Weekly Activity Overview
            </CardTitle>
            <CardDescription>
              Your teaching activity over the last 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-4">
                {dashboardData.weeklyActivity.map((day, index) => (
                  <div key={index} className="space-y-2">
                    <div className="text-center">
                      <p className="text-sm font-medium">
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </p>
                      <p className="text-xs text-muted-foreground">{day.date.split('-')[2]}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="h-20 bg-muted rounded flex flex-col justify-end p-1">
                        <div 
                          className="bg-blue-500 rounded-sm" 
                          style={{ 
                            height: `${Math.max(10, (day.activity / Math.max(...dashboardData.weeklyActivity.map(d => d.activity))) * 100)}%` 
                          }}
                        ></div>
                      </div>
                      <div className="text-center text-xs">
                        <p className="text-blue-600">{day.activity} sessions</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Teaching Sessions</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

     
    </div>
  );
}