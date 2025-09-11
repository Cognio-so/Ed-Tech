"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { MarkdownStyles } from "@/components/Markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Download, Copy, Check, Edit, Save, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import remarkGfm from "remark-gfm";

export default function ContentPreview({
  content,
  metadata,
  contentType,
  onGenerateSlides,
  isGeneratingSlides,
  onEditContent, 
  isEditable = true 
}) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);

  // Handle different content structures
  const getContentData = () => {
    if (contentType === 'web-search') {
      return {
        content: content?.searchQuery || '',
        metadata: content?.metadata || {},
        contentType: content?.contentType || 'web-search',
        language: content?.language || 'English',
        topic: content?.topic || 'Unknown'
      };
    }
    
    // For regular content
    return {
      content: content || '',
      metadata: metadata || {},
      contentType: metadata?.contentType || 'content',
      language: metadata?.language || 'English',
      topic: metadata?.topic || 'Unknown'
    };
  };

  const contentData = getContentData();

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(contentData.content);
      setCopied(true);
      toast.success("Content copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy content");
    }
  };

  const handleDownloadContent = () => {
    const blob = new Blob([contentData.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contentData.topic || 'content'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Content downloaded!");
  };

  const handleStartEdit = () => {
    setEditedContent(contentData.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedContent(contentData.content);
    setIsEditing(false);
    toast.info("Edit cancelled");
  };

  const handleSaveEdit = () => {
    if (onEditContent) {
      onEditContent(editedContent);
      setIsEditing(false);
      toast.success("Content updated!");
    }
  };

  // Render web search specific content
  const renderWebSearchContent = () => {
    if (contentType !== 'web-search') return null;

    return (
      <div className="space-y-6">
        {/* Search Query */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">Search Query:</h4>
          <p className="text-blue-800 text-sm">{content.searchQuery}</p>
        </div>

        {/* Search Results */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">
            Search Results ({content.searchResults?.length || 0} found):
          </h4>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {content.searchResults?.map((result, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900 text-sm mb-1 line-clamp-1">
                      {result.title}
                    </h5>
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                      {result.snippet}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span><strong>Source:</strong> {result.source}</span>
                      <span><strong>Relevance:</strong> {(result.relevanceScore * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  {result.url !== '#' && (
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              {contentType === 'web-search' ? (
                <ExternalLink className="h-5 w-5" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
              {contentType === 'web-search' ? 'Web Search Results' : 'Generated Content'}
            </CardTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline">{contentData.contentType}</Badge>
              <Badge variant="secondary">{contentData.language}</Badge>
              {contentData.metadata.instructionDepth && (
                <Badge variant="outline">{contentData.metadata.instructionDepth}</Badge>
              )}
              {contentData.metadata.contentVersion && (
                <Badge variant="outline">{contentData.metadata.contentVersion}</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveEdit}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                {isEditable && contentType !== 'web-search' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartEdit}
                    title="Edit Content"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyContent}
                  disabled={copied}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadContent}
                >
                  <Download className="h-4 w-4" />
                </Button>
                {contentData.metadata.contentType === "presentation" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onGenerateSlides(contentData.metadata)}
                    disabled={isGeneratingSlides}
                  >
                    {isGeneratingSlides ? "Generating..." : "Generate Slides"}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {contentType === 'web-search' ? (
          renderWebSearchContent()
        ) : isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contentEditor">Edit Content</Label>
              <Textarea
                id="contentEditor"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={20}
                className="font-mono text-sm"
                placeholder="Edit your content here..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleCancelEdit}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                className="min-w-[100px]"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[600px] w-full">
            <div className="prose prose-gray max-w-none markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={MarkdownStyles}
              >
                {contentData.content}
              </ReactMarkdown>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
