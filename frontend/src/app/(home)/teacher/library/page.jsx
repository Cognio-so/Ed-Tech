"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  FileText, 
  Presentation, 
  Image, 
  Video, 
  BookOpen, 
  Search, 
  FileCheck,
  Calendar,
  Eye,
  Download,
  Trash2,
  Search as SearchIcon
} from "lucide-react";
import { toast } from "sonner";
import { getAllLibraryContent, deleteLibraryContent } from "./action";
import { authClient } from "@/lib/auth-client";
import LibraryDialog from "@/components/ui/library-dialog";

// Content type configurations
const contentTypes = {
  all: { label: "All", icon: FileText, color: "bg-gray-100" },
  content: { label: "Content", icon: FileText, color: "bg-blue-100" },
  slides: { label: "Slides", icon: Presentation, color: "bg-purple-100" },
  comic: { label: "Comics", icon: BookOpen, color: "bg-green-100" },
  image: { label: "Images", icon: Image, color: "bg-pink-100" },
  video: { label: "Videos", icon: Video, color: "bg-red-100" },
  assessment: { label: "Assessments", icon: FileCheck, color: "bg-yellow-100" },
  websearch: { label: "Web Search", icon: Search, color: "bg-indigo-100" }
};

export default function LibraryPage() {
  const [user, setUser] = useState(null);
  const [content, setContent] = useState([]);
  const [filteredContent, setFilteredContent] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [previewDialog, setPreviewDialog] = useState({ open: false, item: null });

  // Get user session
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data } = await authClient.getSession();
        setUser(data?.user || null);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    getUser();
  }, []);

  // Load library content
  useEffect(() => {
    if (user?.id) {
      loadLibraryContent();
    }
  }, [user?.id]);

  // Filter content based on search and active tab
  useEffect(() => {
    let filtered = content;

    // Filter by tab
    if (activeTab !== "all") {
      filtered = filtered.filter(item => item.type === activeTab);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.title?.toLowerCase().includes(query) ||
        item.topic?.toLowerCase().includes(query) ||
        item.subject?.toLowerCase().includes(query) ||
        item.grade?.toLowerCase().includes(query)
      );
    }

    setFilteredContent(filtered);
  }, [content, activeTab, searchQuery]);

  const loadLibraryContent = async () => {
    setLoading(true);
    try {
      const result = await getAllLibraryContent();
      if (result.success) {
        setContent(result.content);
        setCounts(result.counts);
      } else {
        toast.error(result.error || "Failed to load library content");
      }
    } catch (error) {
      console.error("Error loading library content:", error);
      toast.error("Failed to load library content");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (contentId, contentType) => {
    try {
      const result = await deleteLibraryContent(contentId, contentType);
      if (result.success) {
        toast.success("Content deleted successfully");
        loadLibraryContent(); // Reload content
        setPreviewDialog({ open: false, item: null });
      } else {
        toast.error(result.error || "Failed to delete content");
      }
    } catch (error) {
      console.error("Error deleting content:", error);
      toast.error("Failed to delete content");
    }
  };

  const handleDownload = (item) => {
    // Implement download functionality based on content type
    toast.info("Download functionality coming soon!");
  };

  const handlePreview = (item) => {
    setPreviewDialog({ open: true, item });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const getContentIcon = (type) => {
    const IconComponent = contentTypes[type]?.icon || FileText;
    return <IconComponent className="h-5 w-5" />;
  };

  const getContentColor = (type) => {
    return contentTypes[type]?.color || "bg-gray-100";
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">My Library</h1>
        <p className="text-muted-foreground">
          Manage and organize all your created content in one place
        </p>
      </div>

      {/* Search and Stats */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search your content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Total: {counts.all || 0} items</span>
          <span>•</span>
          <span>Last updated: {formatDate(new Date())}</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          {Object.entries(contentTypes).map(([key, config]) => {
            const IconComponent = config.icon;
            const count = counts[key] || 0;
            return (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                <IconComponent className="h-4 w-4" />
                <span className="hidden sm:inline">{config.label}</span>
                <Badge variant="secondary" className="ml-1">
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Content Grid */}
        <TabsContent value={activeTab} className="mt-6">
          {filteredContent.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                {getContentIcon(activeTab)}
              </div>
              <h3 className="text-lg font-semibold mb-2">No content found</h3>
              <p className="text-muted-foreground">
                {searchQuery 
                  ? "No content matches your search criteria"
                  : `You haven't created any ${contentTypes[activeTab]?.label.toLowerCase() || 'content'} yet`
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredContent.map((item) => (
                <Card key={`${item.type}-${item._id}`} className="group hover:shadow-lg transition-shadow">
                  <CardHeader className="p-0">
                    <div className={`h-32 ${getContentColor(item.type)} flex items-center justify-center`}>
                      {getContentIcon(item.type)}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <CardTitle className="text-sm font-medium line-clamp-2 mb-2">
                      {item.title || "Untitled"}
                    </CardTitle>
                    
                    <div className="space-y-1 text-xs text-muted-foreground mb-3">
                      {item.topic && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Topic:</span>
                          <span className="line-clamp-1">{item.topic}</span>
                        </div>
                      )}
                      {item.subject && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Subject:</span>
                          <span>{item.subject}</span>
                        </div>
                      )}
                      {item.grade && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Grade:</span>
                          <span>{item.grade}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(item)}
                          className="h-6 w-6 p-0 hover:bg-blue-100"
                          title="Preview"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(item)}
                          className="h-6 w-6 p-0 hover:bg-green-100"
                          title="Download"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item._id, item.type)}
                          className="h-6 w-6 p-0 hover:bg-red-100 text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Library Dialog */}
      <LibraryDialog
        isOpen={previewDialog.open}
        onClose={() => setPreviewDialog({ open: false, item: null })}
        content={previewDialog.item}
        onDelete={handleDelete}
        onDownload={handleDownload}
      />
    </div>
  );
}