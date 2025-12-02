"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  User,
  ExternalLink,
  Download,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface UploadedDoc {
  url: string;
  filename: string;
  type: string;
}

interface Source {
  href: string;
  title: string;
}

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  uploadedDocs?: UploadedDoc[];
  imageUrls?: string[];
  videoUrls?: string[];
  tokenUsage?: TokenUsage;
  sources?: Source[];
}

export interface ChatMessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
  streamingContent?: string;
  className?: string;
}

export function ChatMessageComponent({
  message,
  isStreaming = false,
  streamingContent,
  className,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  const isUser = message.role === "user";
  const displayContent =
    isStreaming && streamingContent ? streamingContent : message.content;

  const handleDownload = async (url: string, filename?: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename || url.split("/").pop() || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleExternalLink = (
    e: React.MouseEvent<HTMLElement>,
    url: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return "🖼️";
    if (type === "application/pdf") return "📄";
    if (type.includes("word") || type.includes("document")) return "📝";
    if (type === "text/markdown") return "📋";
    if (type === "application/json") return "📊";
    return "📄";
  };

  const getFileTypeLabel = (type: string) => {
    if (type.startsWith("image/")) return "Image";
    if (type === "application/pdf") return "PDF";
    if (type.includes("word") || type.includes("document")) return "Word";
    if (type === "text/markdown") return "Markdown";
    if (type === "application/json") return "JSON";
    return "File";
  };

  const handleCopy = async () => {
    if (!displayContent) return;
    try {
      await navigator.clipboard.writeText(displayContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  return (
    <div className={cn("w-full max-w-5xl mx-auto break-words", className)}>
      <Message from={isUser ? "user" : "assistant"}>
        {isUser ? (
          <>
            <MessageContent variant="flat">
              <div className="space-y-2">
                {message.uploadedDocs && message.uploadedDocs.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {message.uploadedDocs.map((doc, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-muted/60 border border-border rounded-lg px-2 py-1 text-xs"
                      >
                        <span className="text-sm">{getFileIcon(doc.type)}</span>
                        <div className="flex flex-col min-w-0">
                          <span
                            className="font-medium truncate max-w-[100px]"
                            title={doc.filename}
                          >
                            {doc.filename}
                          </span>
                          <span className="text-xs opacity-70">
                            {getFileTypeLabel(doc.type)}
                          </span>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                <Response sources={message.sources}>{displayContent}</Response>
              </div>
            </MessageContent>
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback>
                <User className="size-4 text-primary" />
              </AvatarFallback>
            </Avatar>
          </>
        ) : (
          <MessageContent variant="flat">
            <div className="flex items-start gap-3 pl-2">
              <div className="bg-transparent relative size-8 flex-shrink-0 rounded-full p-0.5">
                <div className="bg-transparent h-full w-full overflow-hidden rounded-full flex items-center justify-center">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-muted text-primary-foreground border border-primary/30">
                      <Sparkles className="size-4 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {message.imageUrls && message.imageUrls.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-2 sm:mb-4">
                    {message.imageUrls.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={url}
                          alt={`Generated image ${idx + 1}`}
                          className="w-full h-auto rounded-lg border border-border"
                          loading="lazy"
                        />
                        <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 flex gap-1 sm:gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDownload(
                                url,
                                `image-${idx + 1}.${
                                  url.split(".").pop()?.split("?")[0] || "png"
                                }`
                              );
                            }}
                            className="p-1.5 sm:p-2 bg-background/80 rounded-md hover:bg-background/90 transition-colors cursor-pointer"
                            title="Download image"
                          >
                            <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                          <button
                            onClick={(e) => handleExternalLink(e, url)}
                            className="p-1.5 sm:p-2 bg-background/80 rounded-md hover:bg-background/90 transition-colors cursor-pointer"
                            title="Open in new tab"
                          >
                            <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {message.videoUrls && message.videoUrls.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 sm:gap-4 mb-2 sm:mb-4">
                    {message.videoUrls.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <video
                          src={url}
                          controls
                          className="w-full h-auto rounded-lg border border-border"
                          preload="metadata"
                        >
                          Your browser does not support the video tag.
                        </video>
                        <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 flex gap-1 sm:gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDownload(
                                url,
                                `video-${idx + 1}.${
                                  url.split(".").pop()?.split("?")[0] || "mp4"
                                }`
                              );
                            }}
                            className="p-1.5 sm:p-2 bg-background/80 rounded-md backdrop-blur-sm hover:bg-background/90 transition-colors cursor-pointer"
                            title="Download video"
                          >
                            <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                          <button
                            onClick={(e) => handleExternalLink(e, url)}
                            className="p-1.5 sm:p-2 bg-background/80 rounded-md backdrop-blur-sm hover:bg-background/90 transition-colors cursor-pointer"
                            title="Open in new tab"
                          >
                            <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {displayContent ? (
                  <div className="bg-muted/60 border border-border rounded-lg p-2 sm:p-3 md:p-4 break-words">
                    <Response sources={message.sources}>
                      {displayContent}
                    </Response>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2 mt-1.5 sm:mt-2">
                      <div className="text-[10px] sm:text-xs opacity-70 text-muted-foreground">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        {message.tokenUsage && !isStreaming && (
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 lg:gap-3 text-[10px] sm:text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5 sm:gap-1">
                              <span className="opacity-70">Input:</span>
                              <span className="font-medium">
                                {message.tokenUsage.input_tokens.toLocaleString()}
                              </span>
                            </span>
                            <span className="flex items-center gap-0.5 sm:gap-1">
                              <span className="opacity-70">Output:</span>
                              <span className="font-medium">
                                {message.tokenUsage.output_tokens.toLocaleString()}
                              </span>
                            </span>
                            <span className="flex items-center gap-0.5 sm:gap-1">
                              <span className="opacity-70">Total:</span>
                              <span className="font-medium text-primary">
                                {message.tokenUsage.total_tokens.toLocaleString()}
                              </span>
                            </span>
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 sm:h-7 sm:w-7 text-muted-foreground"
                          onClick={handleCopy}
                          title="Copy response"
                        >
                          {copied ? (
                            <Check className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                          ) : (
                            <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : isStreaming ? (
                  <div className="bg-muted/60 border border-border rounded-lg p-2 sm:p-3 md:p-4">
                    <Shimmer
                      duration={2}
                      className="text-xs sm:text-sm md:text-[15px] text-muted-foreground"
                    >
                      Thinking...
                    </Shimmer>
                  </div>
                ) : null}
              </div>
            </div>
          </MessageContent>
        )}
      </Message>
    </div>
  );
}

export interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  streamingContent?: string;
  className?: string;
}

export function ChatMessages({
  messages,
  isLoading = false,
  streamingContent,
  className,
}: ChatMessagesProps) {
  if (messages.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-full px-4",
          className
        )}
      >
        <div className="text-center">
          <p className="text-base sm:text-lg md:text-xl text-purple-300/80 font-medium">
            What can I help with?
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-0", className)}>
      {messages.map((message, index) => {
        const isLastMessage = index === messages.length - 1;
        const isStreaming =
          isLoading && isLastMessage && message.role === "assistant";

        return (
          <ChatMessageComponent
            key={message.id}
            message={message}
            isStreaming={isStreaming}
            streamingContent={isStreaming ? streamingContent : undefined}
          />
        );
      })}
    </div>
  );
}
