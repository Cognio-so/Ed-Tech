"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Search, Eye, Download, Trash2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownStyles } from "@/components/Markdown";
import { toast } from "sonner";
import WebSearchForm from "./web-search-form";
import { searchWeb, saveWebSearch, getWebSearches, updateWebSearch, deleteWebSearch } from "./action";
import { authClient } from "@/lib/auth-client";

export default function WebSearchPage() {
  const [user, setUser] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savedSearches, setSavedSearches] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Get user session on component mount
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

  // Load saved searches when user is available
  useEffect(() => {
    if (user?.id) {
      loadSavedSearches();
    }
  }, [user?.id]);

  const loadSavedSearches = async () => {
    setLoadingSaved(true);
    try {
      const result = await getWebSearches();
      if (result.success) {
        setSavedSearches(result.data || []);
      } else {
        setSavedSearches([]);
      }
    } catch (error) {
      console.error("Failed to load saved searches:", error);
      setSavedSearches([]);
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleSearch = async (formData) => {
    setIsLoading(true);
    setError(null);
    setSearchResults(null);

    try {
      const result = await searchWeb(formData);
      setSearchResults(result);
      toast.success("Web search completed successfully!");
    } catch (err) {
      setError(err.message || "Failed to perform web search");
      toast.error("Failed to perform web search");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = (item) => {
    setPreviewItem(item);
    setPreviewOpen(true);
  };

  const handleDelete = async (id) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return;
    }

    try {
      const result = await deleteWebSearch(id, user.id);
      if (result.success) {
        setSavedSearches(prev => prev.filter(item => item.id !== id));
        toast.success("Web search deleted successfully");
      }
    } catch (error) {
      console.error("Failed to delete web search:", error);
      toast.error("Failed to delete web search");
    }
  };

  const handleDownloadMd = (content, filename = 'web-search.md') => {
    try {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Web search downloaded successfully');
    } catch (error) {
      console.error('Failed to download web search', error);
      toast.error('Failed to download web search');
    }
  };

  const handleSave = async () => {
    if (!searchResults) {
      toast.error('No content to save');
      return;
    }

    if (!user?.id) {
      toast.error("User not authenticated");
      return;
    }

    try {
      const result = await saveWebSearch(searchResults, user.id);
      if (result.success) {
        // Reload saved searches
        await loadSavedSearches();
        setSearchResults(null);
        toast.success('Web search saved successfully');
      }
    } catch (error) {
      console.error("Failed to save web search:", error);
      toast.error("Failed to save web search");
    }
  };

  const handleDownloadCurrent = () => {
    if (!searchResults) {
      toast.error('No content to download');
      return;
    }
    handleDownloadMd(searchResults.content, `${searchResults.metadata?.topic || 'web-search'}.md`);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border bg-card p-6 shadow-sm dark:bg-secondary">
        <WebSearchForm onSubmit={handleSearch} isLoading={isLoading} />

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {searchResults && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Generated Content</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleDownloadCurrent}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
            
            <div className="p-4 border rounded-xl bg-background dark:bg-secondary">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownStyles}>
                  {searchResults.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>

      {savedSearches && savedSearches.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Saved Web Searches</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={loadSavedSearches}
              disabled={loadingSaved}
            >
              {loadingSaved ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {savedSearches.map((item) => (
              <div key={item.id} className="group relative overflow-hidden rounded-2xl border bg-card shadow-sm hover:shadow-md transition-shadow p-4 dark:bg-secondary">
                <div className="text-sm font-semibold line-clamp-2">{item.metadata?.topic || 'Web Search'}</div>
                <div className="text-xs text-muted-foreground">{item.metadata?.subject} • {item.metadata?.contentType}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{formatTime(item.createdAt)}</div>
                <div className="mt-3 text-xs text-muted-foreground line-clamp-4">
                  {item.content?.slice(0, 220)}{item.content?.length > 220 ? '…' : ''}
                </div>
                <div className="mt-3 flex items-center gap-2 justify-end">
                  <Button size="icon" variant="outline" onClick={() => handlePreview(item)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => handleDownloadMd(item.content || '', `${item.metadata?.topic || 'web-search'}.md`)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="h-4 w-4 text-primary" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[90vw] md:max-w-[1024px] max-h-[98vh] overflow-y-auto p-0">
          <div className="relative w-full min-h-[600px] sm:min-h-[700px] h-auto">
            <DialogHeader className="p-6 pb-4">
              <DialogTitle>{previewItem?.metadata?.topic || 'Preview'}</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6 space-y-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownStyles}>
                  {previewItem?.content || ''}
                </ReactMarkdown>
              </div>
              <div className="text-xs text-muted-foreground pt-4 border-t">
                {previewItem?.metadata?.subject} • {previewItem?.metadata?.contentType} • {formatTime(previewItem?.createdAt)}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

