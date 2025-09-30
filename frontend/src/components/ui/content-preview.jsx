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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Copy, Check, Edit, Save, X, ExternalLink, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import remarkGfm from "remark-gfm";

// Dynamic imports for PDF and DOC generation
const generatePDF = async (content, filename) => {
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const lineHeight = 7;
  const maxLineWidth = pageWidth - (margin * 2);
  
  // Convert markdown to plain text for PDF
  const plainText = content
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/`(.*?)`/g, '$1') // Remove code
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
    .replace(/^\s*[-*+]\s/gm, '• '); // Convert lists to bullets
  
  const lines = doc.splitTextToSize(plainText, maxLineWidth);
  let currentY = margin;
  
  doc.setFontSize(12);
  
  for (let i = 0; i < lines.length; i++) {
    if (currentY + lineHeight > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }
    
    doc.text(lines[i], margin, currentY);
    currentY += lineHeight;
  }
  
  doc.save(`${filename}.pdf`);
};

const generateDOCX = async (content, filename) => {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  
  // Parse markdown content into structured elements
  const lines = content.split('\n');
  const docElements = [];
  
  for (const line of lines) {
    if (!line.trim()) {
      docElements.push(new Paragraph({ text: "" }));
      continue;
    }
    
    // Handle headers
    if (line.startsWith('# ')) {
      docElements.push(new Paragraph({
        text: line.replace('# ', ''),
        heading: HeadingLevel.HEADING_1
      }));
    } else if (line.startsWith('## ')) {
      docElements.push(new Paragraph({
        text: line.replace('## ', ''),
        heading: HeadingLevel.HEADING_2
      }));
    } else if (line.startsWith('### ')) {
      docElements.push(new Paragraph({
        text: line.replace('### ', ''),
        heading: HeadingLevel.HEADING_3
      }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Handle bullet points
      docElements.push(new Paragraph({
        text: line.replace(/^[-*]\s/, ''),
        bullet: { level: 0 }
      }));
    } else {
      // Handle regular text with basic formatting
      const textRuns = [];
      let currentText = line;
      
      // Handle bold text
      currentText = currentText.replace(/\*\*(.*?)\*\*/g, (match, text) => {
        textRuns.push(new TextRun({ text, bold: true }));
        return '\u0000'; // Placeholder
      });
      
      // Handle italic text
      currentText = currentText.replace(/\*(.*?)\*/g, (match, text) => {
        textRuns.push(new TextRun({ text, italics: true }));
        return '\u0000'; // Placeholder
      });
      
      // Split by placeholders and add regular text
      const parts = currentText.split('\u0000');
      const finalRuns = [];
      
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          finalRuns.push(new TextRun({ text: parts[i] }));
        }
        if (i < textRuns.length) {
          finalRuns.push(textRuns[i]);
        }
      }
      
      docElements.push(new Paragraph({
        children: finalRuns.length > 0 ? finalRuns : [new TextRun({ text: line })]
      }));
    }
  }
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: docElements
    }]
  });
  
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

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
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('pdf');
  const [isDownloading, setIsDownloading] = useState(false);

  // Handle different content structures
  const getContentData = () => {
    // If content is a string, use it directly
    if (typeof content === 'string') {
      return {
        content: content,
        metadata: metadata || {},
        contentType: contentType || metadata?.contentType || 'content',
        language: metadata?.language || 'English',
        topic: metadata?.topic || metadata?.title || 'Unknown'
      };
    }

    // If content is an object, extract the appropriate field
    if (typeof content === 'object' && content !== null) {
      const contentText = content.generatedContent || 
                         content.content || 
                         content.instruction || 
                         content.topic || 
                         content.title || 
                         '';
      
      return {
        content: contentText,
        metadata: metadata || content || {},
        contentType: contentType || content.resourceType || content.type || metadata?.contentType || 'content',
        language: metadata?.language || content.language || 'English',
        topic: metadata?.topic || content.topic || content.title || 'Unknown'
      };
    }
    
    // Fallback for web-search
    if (contentType === 'web-search') {
      return {
        content: content?.searchQuery || '',
        metadata: content?.metadata || {},
        contentType: content?.contentType || 'web-search',
        language: content?.language || 'English',
        topic: content?.topic || 'Unknown'
      };
    }
    
    // Default fallback
    return {
      content: content || '',
      metadata: metadata || {},
      contentType: contentType || 'content',
      language: 'English',
      topic: 'Unknown'
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

  const handleDownloadContent = async () => {
    if (!downloadFormat) {
      toast.error("Please select a download format");
      return;
    }

    setIsDownloading(true);
    const filename = contentData.topic || 'content';

    try {
      switch (downloadFormat) {
        case 'md':
          const blob = new Blob([contentData.content], { type: 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${filename}.md`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          break;
          
        case 'pdf':
          await generatePDF(contentData.content, filename);
          break;
          
        case 'docx':
          await generateDOCX(contentData.content, filename);
          break;
          
        default:
          throw new Error('Unsupported format');
      }
      
      toast.success(`Content downloaded as ${downloadFormat.toUpperCase()}!`);
      setShowDownloadDialog(false);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(`Failed to download as ${downloadFormat.toUpperCase()}`);
    } finally {
      setIsDownloading(false);
    }
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
    <>
      <Card className="w-full dark:bg-secondary">
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
                    onClick={() => setShowDownloadDialog(true)}
                    className="flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3" />
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
                {contentData.content ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={MarkdownStyles}
                  >
                    {contentData.content}
                  </ReactMarkdown>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-sm">No content available</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Download Format Selection Dialog */}
      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Download Content</DialogTitle>
            <DialogDescription>
              Choose the format for downloading your content.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="format">Download Format</Label>
              <Select value={downloadFormat} onValueChange={setDownloadFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="md">Markdown (.md)</SelectItem>
                  <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                  <SelectItem value="docx">Word Document (.docx)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              <p><strong>Markdown:</strong> Plain text with formatting markers</p>
              <p><strong>PDF:</strong> Formatted document, good for printing</p>
              <p><strong>Word:</strong> Editable document with formatting</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDownloadDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDownloadContent} 
              disabled={isDownloading || !downloadFormat}
            >
              {isDownloading ? "Downloading..." : "Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
