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
  BarChart3,
  X
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
        return <Mic className="size-4" />;
      case "text":
        return <MessageSquare className="size-4" />;
      default:
        return <MessageSquare className="size-4" />;
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
        icon: <GraduationCap className="size-4" />,
        badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      };
    } else {
      return {
        icon: <Users className="size-4" />,
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

  // Close conversation preview
  const closePreview = () => {
    setSelectedConversation(null);
  };

  useEffect(() => {
    loadConversations();
    loadStats();
  }, []);

  useEffect(() => {
    loadConversations(selectedTab);
  }, [selectedTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Admin History</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              View and monitor all conversations across the platform
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Messages</p>
                    <p className="text-2xl font-bold">{stats.total.messages}</p>
                  </div>
                  <MessageSquare className="size-8 text-muted-foreground" />
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
                  <Users className="size-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
                <Input
                  placeholder="Search conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="student">Student</TabsTrigger>
                  <TabsTrigger value="teacher">Teacher</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Conversations List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full size-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageSquare className="size-12 mx-auto text-muted-foreground mb-4" />
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
                    <div className="flex flex-col gap-4">
                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {userTypeInfo.icon}
                          <Badge variant="outline" className={`${userTypeInfo.badge} shrink-0`}>
                            {conversation.type}
                          </Badge>
                          {getSessionTypeIcon(conversation.sessionType)}
                          <Badge variant={getSessionTypeBadge(conversation.sessionType)} className="shrink-0">
                            {conversation.sessionType}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadConversationDetails(conversation)}
                            className="flex items-center gap-2"
                          >
                            <Eye className="size-4" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                        </div>
                      </div>

                      {/* Message Preview */}
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground line-clamp-2 break-words">
                          {conversation.lastMessage}
                        </p>
                      </div>

                      {/* Metadata Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1 min-w-0">
                          <MessageSquare className="size-3 shrink-0" />
                          <span className="truncate">{conversation.messageCount} messages</span>
                        </div>
                        <div className="flex items-center gap-1 min-w-0">
                          <Clock className="size-3 shrink-0" />
                          <span className="truncate">{formatDuration(conversation.conversationStats?.totalDuration || 0)}</span>
                        </div>
                        <div className="flex items-center gap-1 min-w-0">
                          <Calendar className="size-3 shrink-0" />
                          <span className="truncate">
                            {new Date(conversation.lastMessageAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 min-w-0">
                          <User className="size-3 shrink-0" />
                          <span className="truncate">ID: {conversation.userId?.substring(0, 6)}...</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Conversation Preview Modal */}
      {selectedConversation && (
        <Dialog open={!!selectedConversation} onOpenChange={() => setSelectedConversation(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getUserTypeInfo(selectedConversation.type).icon}
                {selectedConversation.title}
              </DialogTitle>
              <DialogDescription>
                Conversation details and metadata
              </DialogDescription>
            </DialogHeader>
            
            {/* Metadata Section */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-b pb-4">
              <div className="flex items-center gap-1">
                <Calendar className="size-4" />
                {formatDate(selectedConversation.lastMessageAt)}
              </div>
              <Badge 
                variant="secondary" 
                className={getUserTypeInfo(selectedConversation.type).badge}
              >
                {getUserTypeInfo(selectedConversation.type).icon}
                <span className="ml-1 capitalize">{selectedConversation.type}</span>
              </Badge>
              <div className="flex items-center gap-1">
                <MessageSquare className="size-4" />
                {selectedConversation.messageCount} messages
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 mt-4">
              {selectedConversation.messages?.map((message, index) => (
                <div
                  key={message.id || index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {message.role === 'user' ? (
                        <User className="size-4 text-muted-foreground" />
                      ) : (
                        <Bot className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className={`rounded-lg px-4 py-3 min-w-0 ${message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                    }`}>
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </div>
                      <div className={`text-xs mt-2 ${message.role === 'user' 
                        ? 'text-primary-foreground/70' 
                        : 'text-muted-foreground'
                      }`}>
                        {formatDate(message.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              )) || <p className="text-muted-foreground">No messages found</p>}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}