"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  MessageSquare, 
  GraduationCap, 
  UserCheck, 
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  Database,
  BarChart3,
  PieChart,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  MoreHorizontal
} from "lucide-react";
import { toast } from "sonner";
import { 
  getDashboardStats,
  getRecentConversations,
  getUserActivityData,
  getSystemHealth
} from "./action";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [recentConversations, setRecentConversations] = useState([]);
  const [activityData, setActivityData] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load all dashboard data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResult, conversationsResult, activityResult, healthResult] = await Promise.all([
        getDashboardStats(),
        getRecentConversations(),
        getUserActivityData(),
        getSystemHealth()
      ]);

      if (statsResult.success) {
        setStats(statsResult.data);
      } else {
        toast.error(statsResult.error);
      }

      if (conversationsResult.success) {
        setRecentConversations(conversationsResult.data);
      }

      if (activityResult.success) {
        setActivityData(activityResult.data);
      }

      if (healthResult.success) {
        setSystemHealth(healthResult.data);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format relative time
  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  // Get session type icon
  const getSessionTypeIcon = (sessionType) => {
    switch (sessionType) {
      case "voice":
        return "🎤";
      case "text":
        return "💬";
      default:
        return "💬";
    }
  };

  // Get user type icon
  const getUserTypeIcon = (type) => {
    return type === 'student' ? "🎓" : "��‍��";
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening on your platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <Activity className="w-4 h-4 mr-1" />
            System Healthy
          </Badge>
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Last 30 days
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <p className="text-3xl font-bold">{stats.users.total}</p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+{stats.activity.last30Days.newUsers} this month</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Conversations</p>
                  <p className="text-3xl font-bold">{stats.conversations.total}</p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+{stats.activity.last30Days.conversations} this month</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Messages</p>
                  <p className="text-3xl font-bold">{stats.messages.total.toLocaleString()}</p>
                  <div className="flex items-center mt-2">
                    <Activity className="w-4 h-4 text-blue-500 mr-1" />
                    <span className="text-sm text-blue-600">Active conversations</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Today's Activity</p>
                  <p className="text-3xl font-bold">{stats.activity.today.conversations}</p>
                  <div className="flex items-center mt-2">
                    <Clock className="w-4 h-4 text-orange-500 mr-1" />
                    <span className="text-sm text-orange-600">+{stats.activity.today.newUsers} new users</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                  <Activity className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Distribution and Activity Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              User Distribution
            </CardTitle>
            <CardDescription>
              Breakdown of users by role
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">Students</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{stats.users.student}</span>
                    <span className="text-xs text-muted-foreground">
                      ({Math.round((stats.users.student / stats.users.total) * 100)}%)
                    </span>
                  </div>
                </div>
                <Progress value={(stats.users.student / stats.users.total) * 100} className="h-2" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Teachers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{stats.users.teacher}</span>
                    <span className="text-xs text-muted-foreground">
                      ({Math.round((stats.users.teacher / stats.users.total) * 100)}%)
                    </span>
                  </div>
                </div>
                <Progress value={(stats.users.teacher / stats.users.total) * 100} className="h-2" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span className="text-sm">Administrators</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{stats.users.admin}</span>
                    <span className="text-xs text-muted-foreground">
                      ({Math.round((stats.users.admin / stats.users.total) * 100)}%)
                    </span>
                  </div>
                </div>
                <Progress value={(stats.users.admin / stats.users.total) * 100} className="h-2" />
              </>
            )}
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              System Health
            </CardTitle>
            <CardDescription>
              Database and system performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {systemHealth && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Database Status</span>
                  <Badge variant={systemHealth.database.status === 'healthy' ? 'default' : 'destructive'}>
                    {systemHealth.database.status === 'healthy' ? 'Healthy' : 'Error'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Response Time</span>
                  <span className="text-sm font-medium">{systemHealth.database.latency}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Uptime</span>
                  <span className="text-sm font-medium">{Math.floor(systemHealth.uptime / 3600)}h {Math.floor((systemHealth.uptime % 3600) / 60)}m</span>
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium">Collections</span>
                  <div className="grid grid-cols-2 gap-2">
                    {systemHealth.database.collections.slice(0, 4).map((collection, index) => (
                      <div key={index} className="flex justify-between text-xs">
                        <span className="truncate">{collection.name}</span>
                        <span className="font-medium">{collection.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

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
                Latest activity across the platform
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentConversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No recent conversations found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentConversations.map((conversation, index) => (
                <div key={conversation._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getUserTypeIcon(conversation.type)}</span>
                      <span className="text-lg">{getSessionTypeIcon(conversation.sessionType)}</span>
                    </div>
                    <div>
                      <p className="font-medium">{conversation.title}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="capitalize">{conversation.type}</span>
                        <span>•</span>
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

      {/* Activity Chart */}
      {activityData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Activity Overview (Last 7 Days)
            </CardTitle>
            <CardDescription>
              Daily user registrations and conversation activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-4">
                {activityData.map((day, index) => (
                  <div key={index} className="space-y-2">
                    <div className="text-center">
                      <p className="text-sm font-medium">{day.label}</p>
                      <p className="text-xs text-muted-foreground">{day.date.split('-')[2]}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="h-20 bg-muted rounded flex flex-col justify-end p-1">
                        <div 
                          className="bg-blue-500 rounded-sm mb-1" 
                          style={{ height: `${(day.newUsers / Math.max(...activityData.map(d => d.newUsers))) * 100}%` }}
                        ></div>
                        <div 
                          className="bg-green-500 rounded-sm" 
                          style={{ height: `${(day.totalConversations / Math.max(...activityData.map(d => d.totalConversations))) * 100}%` }}
                        ></div>
                      </div>
                      <div className="text-center text-xs">
                        <p className="text-blue-600">{day.newUsers} users</p>
                        <p className="text-green-600">{day.totalConversations} convs</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>New Users</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Conversations</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}