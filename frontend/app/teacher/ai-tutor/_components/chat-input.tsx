"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUp,
  AudioLines,
  Paperclip,
  X,
  Loader2,
  Globe,
  Telescope,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ChatInputProps {
  onSend: (message: string, options?: {
    docUrl?: string;
    uploadedDocs?: Array<{
      url: string;
      filename: string;
      type: string;
    }>;
    model?: string;
  }) => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  hasMessages?: boolean;
}

const MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-lite" },
  { value: "gpt-5", label: "GPT 5" },
  { value: "gpt-5-mini", label: "GPT 5 mini" },
  { value: "gpt-40", label: "GPT-40" },
  { value: "claude-opus-4.1", label: "Claude Opus 4.1" },
  { value: "grok-4-fast", label: "Grok 4 Fast" },
  { value: "meta-llama-3.3-70b", label: "meta/llama 3.3 70b" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gpt-4.1", label: "GPT 4.1" },
  { value: "gpt-5-thinking-high", label: "GPT 5 Thinking High" },
  { value: "gpt-5-nano", label: "GPT 5 nano" },
  { value: "claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
  { value: "claude-haiku-3.5", label: "Claude Haiku 3.5" },
  { value: "deepseek-v3.1", label: "DeepSeek V3.1" },
  { value: "kimi-k2-0905", label: "Kimi K2 0905" },
  { value: "Gemini 3 pro", label: "Gemini 3 pro" },
  { value: "x-ai/grok-4.1-fast", label: "Grok 4.1 Fast" },
];

interface UploadedDoc {
  url: string;
  filename: string;
  type: string;
}

export function ChatInput({
  onSend,
  isLoading = false,
  disabled = false,
  className,
  hasMessages = false,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [deepSearch, setDeepSearch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSend = useCallback(() => {
    if ((message.trim() || uploadedDocs.length > 0) && !isLoading && !isUploading) {
      onSend(message.trim() || "Files attached", {
        docUrl: uploadedDocs.length > 0 ? uploadedDocs[0].url : undefined,
        uploadedDocs: uploadedDocs.length > 0 ? uploadedDocs : undefined,
        model: selectedModel,
      });

      setMessage("");
      setUploadedDocs([]);
    }
  }, [message, isLoading, isUploading, onSend, uploadedDocs, selectedModel]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const allowedTypes = [
        "image/",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/markdown",
        "application/json",
        "text/plain",
      ];

      const totalFiles = uploadedDocs.length + files.length;
      if (totalFiles > 5) {
        toast.error(`You can only upload up to 5 documents at once.`);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      setIsUploading(true);
      const newDocs: UploadedDoc[] = [];

      try {
        for (const file of Array.from(files)) {
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            newDocs.push({
              url: data.url || data.fileUrl,
              filename: file.name,
              type: file.type,
            });
          }
        }

        if (newDocs.length > 0) {
          setUploadedDocs((prev) => [...prev, ...newDocs]);
          toast.success(`${newDocs.length} file(s) uploaded successfully`);
        }
      } catch (error) {
        console.error("Error uploading file:", error);
        toast.error("Failed to upload file(s)");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [uploadedDocs.length]
  );

  const removeDocument = useCallback((index: number) => {
    setUploadedDocs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleVoiceClick = useCallback(() => {
    toast.info("Voice input coming soon!");
  }, []);

  const canSend = Boolean(message.trim() || uploadedDocs.length > 0);

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

  return (
    <div className={cn("w-full max-w-4xl mx-auto", hasMessages ? "" : "px-2 sm:px-4", className)}>
      {/* Show uploaded files */}
      {uploadedDocs.length > 0 && (
        <div className="mb-2 sm:mb-3 flex flex-wrap gap-1.5 sm:gap-2">
          {uploadedDocs.map((doc, index) => (
            <div
              key={index}
              className="flex items-center gap-1.5 sm:gap-2 bg-muted/50 border border-border rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm"
            >
              <span className="text-base sm:text-lg">{getFileIcon(doc.type)}</span>
              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate max-w-[80px] sm:max-w-[120px]" title={doc.filename}>
                  {doc.filename}
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  {getFileTypeLabel(doc.type)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => removeDocument(index)}
              >
                <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="relative bg-muted/20 rounded-xl sm:rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-1.5 sm:p-2">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isUploading ? "Uploading documents..." : "Ask anything..."}
            disabled={isLoading || isUploading}
            className="w-full min-h-[40px] sm:min-h-[44px] max-h-[120px] sm:max-h-[180px] resize-none outline-none text-sm sm:text-base leading-snug bg-transparent placeholder:text-muted-foreground disabled:opacity-50 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding"
            rows={2}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,application/json,text/plain"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Mobile Controls */}
          <div className="flex md:hidden items-center justify-between gap-1.5">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6 sm:h-7 sm:w-7 rounded-full"
                disabled={isLoading || isUploading}
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
              >
                <Paperclip className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </Button>
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={isLoading || isUploading}
              >
                <SelectTrigger className="h-6 sm:h-7 px-1.5 sm:px-2 rounded-5xl text-xs sm:text-sm border-border bg-muted hover:bg-accent focus:ring-0 focus:ring-offset-0 w-[120px] sm:w-[160px]">
                  <div className="flex items-center gap-1">
                    <Sparkles className="size-3 sm:size-4 text-primary" />
                    <SelectValue className="text-xs sm:text-sm" />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-[300px] sm:max-h-[400px] overflow-y-auto">
                  <div className="grid grid-cols-1 gap-1 p-2">
                    {MODELS.map((model) => (
                      <SelectItem key={model.value} value={model.value} className="text-xs sm:text-sm">
                        {model.label}
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSend}
              disabled={!canSend || isLoading || isUploading}
              size="icon"
              className="h-6 w-6 sm:h-7 sm:w-7 rounded-full"
            >
              {canSend ? <ArrowUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <AudioLines className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
            </Button>
          </div>

          {/* Desktop Controls */}
          <div className="hidden md:flex items-center justify-between gap-2 lg:gap-3">
            <div className="flex items-center gap-1.5 lg:gap-2">
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={isLoading || isUploading}
              >
                <SelectTrigger className="h-7 px-2 rounded-md text-sm border-border bg-muted hover:bg-accent focus:ring-0 focus:ring-offset-0 min-w-[180px] lg:min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-[400px] overflow-y-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-1 p-2">
                    {MODELS.map((model) => (
                      <SelectItem key={model.value} value={model.value} className="text-sm">
                        {model.label}
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5 lg:gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-full"
                disabled={isLoading || isUploading}
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </Button>
              <Button
                onClick={handleSend}
                disabled={!canSend || isLoading || isUploading}
                size="icon"
                className="h-7 w-7 rounded-full"
                title="Send message"
              >
                {canSend ? <ArrowUp className="h-3.5 w-3.5" /> : <AudioLines className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
