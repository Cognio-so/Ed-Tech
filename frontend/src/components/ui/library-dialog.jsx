"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Trash2
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

  const handleDownload = () => {
    if (onDownload) {
      onDownload(content);
    }
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
            <div className="text-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold">{content.title}</h3>
              <p className="text-sm text-muted-foreground">{content.topic}</p>
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <div className="relative max-w-full max-h-full">
                <img 
                  src={content.imageUrl} 
                  alt={content.title}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                />
                <div className="absolute top-2 right-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleDownload}
                    className="h-8 w-8 p-0"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
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
        <h3 className="text-lg font-semibold">{content.title}</h3>
        <p className="text-sm text-muted-foreground">{content.topic}</p>
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="h-8 px-3"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
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
