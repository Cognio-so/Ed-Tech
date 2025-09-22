"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Eye, 
  X, 
  FileText, 
  Presentation, 
  Image, 
  Video, 
  BookOpen, 
  Search, 
  FileCheck,
  Download,
  Trash2,
  ChevronDown,
  FileImage,
  File,
  FileText as FileDoc
} from "lucide-react";
import ContentPreview from "@/components/ui/content-preview";
import AssessmentPreview from "@/components/assessment-preview";
import PPTXViewer from "@/components/pptx-viewer";
import VideoPreview from "@/components/ui/video-preview";
import { CarouselWithControls } from "@/components/ui/carousel";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownStyles } from "../Markdown";

// Content type configurations
const contentTypes = {
  content: { label: "Content", icon: FileText, color: "bg-blue-100" },
  slides: { label: "Slides", icon: Presentation, color: "bg-purple-100" },
  comic: { label: "Comics", icon: BookOpen, color: "bg-green-100" },
  image: { label: "Images", icon: Image, color: "bg-pink-100" },
  video: { label: "Videos", icon: Video, color: "bg-red-100" },
  assessment: { label: "Assessments", icon: FileCheck, color: "bg-yellow-100" },
  websearch: { label: "Web Search", icon: Search, color: "bg-indigo-100" }
};

// Download format configurations
const downloadFormats = {
  pdf: { label: "PDF", icon: File, extension: "pdf" },
  doc: { label: "DOC", icon: FileDoc, extension: "docx" },
  pptx: { label: "PPTX", icon: Presentation, extension: "pptx" },
  image: { label: "Image", icon: FileImage, extension: "png" }
};

export default function LibraryDialog({ 
  isOpen, 
  onClose, 
  content, 
  onDelete, 
  onDownload 
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!content) return null;

  const getContentIcon = (type) => {
    const IconComponent = contentTypes[type]?.icon || FileText;
    return <IconComponent className="h-4 w-4" />;
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(content._id, content.type);
    }
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleDownload = (format = 'pdf') => {
    if (onDownload) {
      onDownload(content, format);
    }
  };

  const getAvailableFormats = (contentType) => {
    switch (contentType) {
      case 'comic':
      case 'image':
        return ['pdf', 'doc', 'pptx', 'image'];
      case 'content':
      case 'assessment':
        return ['pdf', 'doc'];
      case 'slides':
        return ['pptx']; // Only PPTX for slides
      case 'video':
        return ['pdf']; // Video metadata as PDF
      case 'websearch':
        return ['pdf', 'doc'];
      default:
        return ['pdf'];
    }
  };

  const renderDownloadButton = () => {
    const availableFormats = getAvailableFormats(content.type);
    
    if (availableFormats.length === 1) {
      const format = availableFormats[0];
      const formatConfig = downloadFormats[format];
      const IconComponent = formatConfig.icon;
      
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDownload(format)}
          className="h-8 px-3"
        >
          <IconComponent className="h-4 w-4 mr-1" />
          Download {formatConfig.label}
        </Button>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3"
          >
            <Download className="h-4 w-4 mr-1" />
            Download
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {availableFormats.map((format) => {
            const formatConfig = downloadFormats[format];
            const IconComponent = formatConfig.icon;
            
            return (
              <DropdownMenuItem
                key={format}
                onClick={() => handleDownload(format)}
                className="cursor-pointer"
              >
                <IconComponent className="h-4 w-4 mr-2" />
                Download as {formatConfig.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderContentPreview = () => {
    switch (content.type) {
      case 'content':
        return (
          <div className="h-full overflow-hidden">
            <ContentPreview
              content={content.generatedContent}
              metadata={content}
              isEditable={false}
            />
          </div>
        );
      
      case 'assessment':
        return (
          <div className="h-full overflow-hidden">
            <AssessmentPreview
              assessment={content}
              isEditable={false}
            />
          </div>
        );
      
      case 'slides':
        return (
          <div className="h-full overflow-hidden">
            <PPTXViewer
              presentationUrl={content.presentationUrl}
              title={content.title}
              slideCount={content.slideCount}
              status="completed"
              isEditable={false}
            />
          </div>
        );
      
      case 'video':
        return (
          <div className="h-full overflow-hidden">
            <VideoPreview
              videoUrl={content.videoUrl}
              title={content.title}
              slidesCount={content.slidesCount}
              status="completed"
              voiceName={content.voiceName}
              avatarName={content.talkingPhotoName}
              videoId={content.videoId}
              isEditable={false}
            />
          </div>
        );
      
      case 'comic':
        const comicImages = content.panels?.map(panel => panel.imageUrl || panel.imageBase64) || 
                           content.imageUrls || 
                           content.images || [];
        
        return (
          <div className="h-full flex flex-col">
            <div className="text-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold">{content.title}</h3>
              <p className="text-sm text-muted-foreground">{content.topic || content.instruction}</p>
            </div>
            <div className="flex-1 min-h-0">
              {comicImages.length > 0 ? (
                <CarouselWithControls
                  items={comicImages.map((url, i) => ({ url, index: i + 1 }))}
                  className="h-full"
                  renderItem={(p) => (
                    <div className="rounded-lg border overflow-hidden bg-gradient-to-br from-background to-muted/10 flex items-center justify-center h-full">
                      <img 
                        src={p.url} 
                        alt={`Panel ${p.index}`} 
                        className="max-h-full max-w-full object-contain rounded-lg shadow-sm" 
                      />
                    </div>
                  )}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground h-full flex items-center justify-center">
                  <div>
                    <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-sm">No comic panels available</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      
      case 'image':
        return (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <div className="relative max-w-full max-h-full">
                {content.imageUrl ? (
                  <img 
                    src={content.imageUrl} 
                    alt={content.title}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const fallbackDiv = document.createElement('div');
                      fallbackDiv.className = 'text-center py-8 text-foreground';
                      fallbackDiv.innerHTML = `
                        <div>
                          <svg class="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                          <p class="text-sm">Image failed to load</p>
                        </div>
                      `;
                      e.target.parentNode.appendChild(fallbackDiv);
                    }}
                  />
                ) : content.imageBase64 ? (
                  <img 
                    src={`data:image/png;base64,${content.imageBase64}`} 
                    alt={content.title}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                    loading="lazy"
                  />
                ) : (
                  <div className="text-center py-8 text-foreground">
                    <Image className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-sm">No image data available</p>
                  </div>
                )}
              </div>
            </div>
            {content.instructions && (
              <div className="p-4 bg-muted/50 border-t">
                <p className="text-sm text-muted-foreground">{content.instructions}</p>
              </div>
            )}
          </div>
        );
      
      case 'websearch':
        return (
          <div className="h-full flex flex-col">
            <div className="text-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold">{content.title}</h3>
              <p className="text-sm text-muted-foreground">{content.topic}</p>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownStyles}>
                  {content.searchResults || content.content || ''}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="text-center py-8 text-muted-foreground h-full flex items-center justify-center">
            <div>
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-sm">Preview not available for this content type</p>
            </div>
          </div>
        );
    }
  };

  const renderMetadata = () => {
    return (
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-3">{content.title}</h3>
        <div className="grid grid-cols-2 gap-4">
          {content.topic && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Topic:</span>
              <span className="text-sm">{content.topic}</span>
            </div>
          )}
          {content.subject && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Subject:</span>
              <span className="text-sm">{content.subject}</span>
            </div>
          )}
          {content.grade && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Grade:</span>
              <span className="text-sm">{content.grade}</span>
            </div>
          )}
          {content.createdAt && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Date:</span>
              <span className="text-sm">{new Date(content.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric"
              })}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[80vw] md:max-w-[1024px] max-h-[90vh] p-2 overflow-y-auto">
          <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-green-600" />
                Content Preview
                <Badge variant="outline" className="ml-2">
                  {contentTypes[content.type]?.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mr-4">
                {renderDownloadButton()}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="h-8 px-3 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 p-6">
            <div className="h-full flex flex-col">
              {renderMetadata()}
              <div className="flex-1 min-h-0">
                {renderContentPreview()}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Delete Content</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete "{content.title}"? This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
