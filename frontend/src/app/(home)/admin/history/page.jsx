"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  MessageSquare, 
  Mic, 
  Clock, 
  Calendar, 
  Search, 
  MoreVertical, 
  Eye,
  Filter,
  Users,
  GraduationCap,
  Bot,
  User,
  FileText,
  BarChart3
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { 
  getAllConversations,
  getConversationsByType,
  getAdminConversationStats,
  getConversationDetails
} from "./action";

export default function AdminHistoryPage() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [stats, setStats] = useState(null);

  // Load conversations based on selected tab
  const loadConversations = async (tab = selectedTab) => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("type", tab);

      const result = await getConversationsByType(formData);
      
      if (result.success) {
        setConversations(result.data);
      } else {
        toast.error(result.error || "Failed to load conversations");
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  };

  // Load conversation details
  const loadConversationDetails = async (conversation) => {
    try {
      const formData = new FormData();
      formData.append("conversationId", conversation._id);
      formData.append("type", conversation.type);

      const result = await getConversationDetails(formData);
      
      if (result.success) {
        setSelectedConversation(result.data);
      } else {
        toast.error(result.error || "Failed to load conversation");
      }
    } catch (error) {
      console.error("Error loading conversation details:", error);
      toast.error("Failed to load conversation details");
    }
  };

  // Load stats
  const loadStats = async () => {
    try {
      const result = await getAdminConversationStats();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.sessionId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get session type icon
  const getSessionTypeIcon = (sessionType) => {
    switch (sessionType) {
      case "voice":
        return <Mic className="w-4 h-4" />;
      case "text":
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  // Get session type badge variant
  const getSessionTypeBadge = (sessionType) => {
    switch (sessionType) {
      case "voice":
        return "default";
      case "text":
        return "secondary";
      default:
        return "outline";
    }
  };

  // Get user type icon and color
  const getUserTypeInfo = (type) => {
    if (type === 'student') {
      return {
        icon: <GraduationCap className="w-4 h-4" />,
        badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      };
    } else {
      return {
        icon: <Users className="w-4 h-4" />,
        badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      };
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "Unknown date";
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format duration
  const formatDuration = (minutes) => {
    if (!minutes || minutes < 1) return "0m";
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  useEffect(() => {
    loadConversations();
    loadStats();
  }, []);

  useEffect(() => {
    loadConversations(selectedTab);
  }, [selectedTab]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin History</h1>
          <p className="text-muted-foreground">
            View and monitor all conversations across the platform
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Messages</p>
                  <p className="text-2xl font-bold">{stats.total.messages}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Teacher Conversations</p>
                  <p className="text-2xl font-bold">{stats.teacher.totalTeacherConversations}</p>
                </div>
                <Users className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="student">Student</TabsTrigger>
                <TabsTrigger value="teacher">Teacher</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Conversations List */}
      <div className="grid gap-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No conversations found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "No conversations match your search." : "No conversations found for the selected filter."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredConversations.map((conversation) => {
            const userTypeInfo = getUserTypeInfo(conversation.type);
            return (
              <Card key={conversation._id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {userTypeInfo.icon}
                        <Badge variant="outline" className={userTypeInfo.badge}>
                          {conversation.type}
                        </Badge>
                        {getSessionTypeIcon(conversation.sessionType)}
                        <Badge variant={getSessionTypeBadge(conversation.sessionType)}>
                          {conversation.sessionType}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {conversation.lastMessage}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {conversation.messageCount} messages
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(conversation.conversationStats?.totalDuration || 0)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(conversation.lastMessageAt)}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          User ID: {conversation.userId?.substring(0, 8)}...
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadConversationDetails(conversation)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          {selectedConversation && (
                            <div className="space-y-4">
                              {/* Conversation Info */}

                              
                              {/* Messages */}
                              <div className="space-y-4">
                                <h4 className="font-semibold">Messages ({selectedConversation.messageCount})</h4>
                                {selectedConversation.messages?.map((message, index) => (
                                  <div
                                    key={message.id || index}
                                    className={`w-full ${
                                      message.role === 'user' ? 'flex justify-end' : 'flex justify-start'
                                    }`}
                                  >
                                    <div
                                      className={`max-w-[80%] rounded-lg p-3 ${
                                        message.role === 'user'
                                          ? 'bg-primary text-primary-foreground'
                                          : 'bg-muted'
                                      }`}
                                    >
                                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                      <p className="text-xs opacity-70 mt-1">
                                        {formatDate(message.timestamp)}
                                      </p>
                                    </div>
                                  </div>
                                )) || <p className="text-muted-foreground">No messages found</p>}
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}