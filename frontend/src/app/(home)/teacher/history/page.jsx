"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  MessageSquare, 
  Mic, 
  Clock, 
  Calendar, 
  Search, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Eye,
  Filter,
  Download
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { 
  getVoiceCoachConversationHistory, 
  getVoiceCoachConversation,
  deleteVoiceCoachConversation,
  updateVoiceCoachConversationTitle,
  debugConversations,
  migrateConversations
} from "./action";

export default function TeacherHistoryPage() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSessionType, setSelectedSessionType] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Debug function
  const handleDebug = async () => {
    try {
      const result = await debugConversations();
      console.log('Debug result:', result);
      if (result.success) {
        toast.success(`Found ${result.data.teacherConversations} conversations for teacher, ${result.data.totalConversations} total in DB`);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Debug error:', error);
      toast.error('Debug failed');
    }
  };

  // Migration function
  const handleMigration = async () => {
    try {
      const result = await migrateConversations();
      if (result.success) {
        toast.success(result.message);
        loadConversations(currentPage, selectedSessionType);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('Migration failed');
    }
  };

  // Load conversations
  const loadConversations = async (page = 1, sessionType = selectedSessionType) => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("page", page.toString());
      formData.append("limit", "10");
      formData.append("sessionType", sessionType);

      console.log('Loading conversations with params:', { page, sessionType }); // DEBUG
      const result = await getVoiceCoachConversationHistory(formData);
      
      console.log('Conversation history result:', result); // DEBUG
      
      if (result.success) {
        setConversations(result.data.conversations);
        setTotalPages(result.data.pagination.totalPages);
        setCurrentPage(page);
        console.log('Loaded conversations:', result.data.conversations.length); // DEBUG
      } else {
        console.error('Failed to load conversations:', result.error); // DEBUG
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
  const loadConversationDetails = async (conversationId) => {
    try {
      const formData = new FormData();
      formData.append("conversationId", conversationId);

      const result = await getVoiceCoachConversation(formData);
      
      if (result.success) {
        setSelectedConversation(result.data);
        setEditingTitle(result.data.title);
      } else {
        toast.error(result.error || "Failed to load conversation");
      }
    } catch (error) {
      console.error("Error loading conversation details:", error);
      toast.error("Failed to load conversation details");
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (conversationId) => {
    try {
      const formData = new FormData();
      formData.append("conversationId", conversationId);

      const result = await deleteVoiceCoachConversation(formData);
      
      if (result.success) {
        toast.success("Conversation deleted successfully");
        loadConversations(currentPage, selectedSessionType);
        setSelectedConversation(null);
      } else {
        toast.error(result.error || "Failed to delete conversation");
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error("Failed to delete conversation");
    }
  };

  // Update conversation title
  const handleUpdateTitle = async (conversationId) => {
    try {
      const formData = new FormData();
      formData.append("conversationId", conversationId);
      formData.append("title", editingTitle);

      const result = await updateVoiceCoachConversationTitle(formData);
      
      if (result.success) {
        toast.success("Title updated successfully");
        setIsEditing(false);
        loadConversations(currentPage, selectedSessionType);
        if (selectedConversation) {
          setSelectedConversation(prev => ({ ...prev, title: editingTitle }));
        }
      } else {
        toast.error(result.error || "Failed to update title");
      }
    } catch (error) {
      console.error("Error updating title:", error);
      toast.error("Failed to update title");
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
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

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format duration
  const formatDuration = (minutes) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  useEffect(() => {
    loadConversations();
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Voice Coach History</h1>
          <p className="text-muted-foreground">
            View and manage your Voice Coach conversation history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleMigration}>
            Migrate
          </Button>
          <Button variant="outline" size="sm" onClick={handleDebug}>
            Debug
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
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
            <Tabs value={selectedSessionType} onValueChange={(value) => {
              setSelectedSessionType(value);
              loadConversations(1, value);
            }}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="voice">Voice</TabsTrigger>
                <TabsTrigger value="mixed">Mixed</TabsTrigger>
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
              <p className="text-muted-foreground">
                {searchTerm ? "No conversations match your search." : "Start a conversation with Voice Coach to see your history here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredConversations.map((conversation) => (
            <Card key={conversation._id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getSessionTypeIcon(conversation.sessionType)}
                      <h3 className="font-semibold truncate">{conversation.title}</h3>
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
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadConversationDetails(conversation._id)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            {getSessionTypeIcon(conversation.sessionType)}
                            {selectedConversation?.title || conversation.title}
                          </DialogTitle>
                          <DialogDescription>
                            Conversation from {formatDate(conversation.lastMessageAt)}
                          </DialogDescription>
                        </DialogHeader>
                        {selectedConversation && (
                          <div className="space-y-4">
                            {/* Conversation Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                              <div className="text-center">
                                <div className="text-2xl font-bold">{selectedConversation.conversationStats.totalMessages}</div>
                                <div className="text-sm text-muted-foreground">Total Messages</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold">{selectedConversation.conversationStats.userMessages}</div>
                                <div className="text-sm text-muted-foreground">Your Messages</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold">{selectedConversation.conversationStats.aiMessages}</div>
                                <div className="text-sm text-muted-foreground">AI Responses</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold">{formatDuration(selectedConversation.conversationStats.totalDuration)}</div>
                                <div className="text-sm text-muted-foreground">Duration</div>
                              </div>
                            </div>

                            {/* Messages */}
                            <div className="space-y-4">
                              {selectedConversation.messages.map((message) => (
                                <div
                                  key={message.id}
                                  className={`flex gap-3 ${
                                    message.role === 'user' ? 'justify-end' : 'justify-start'
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
                              ))}
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingTitle(conversation.title);
                            setIsEditing(true);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Title
                        </DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this conversation? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteConversation(conversation._id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadConversations(currentPage - 1, selectedSessionType)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadConversations(currentPage + 1, selectedSessionType)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Edit Title Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Conversation Title</DialogTitle>
            <DialogDescription>
              Update the title for this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              placeholder="Enter conversation title..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                if (selectedConversation) {
                  handleUpdateTitle(selectedConversation._id);
                }
              }}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

