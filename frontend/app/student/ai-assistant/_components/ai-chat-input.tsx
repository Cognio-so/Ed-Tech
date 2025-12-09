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
import { ArrowUp, AudioLines, Paperclip, X, Sparkles, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LiveWaveform } from "@/components/ui/live-waveform";
import { useStudentVoiceStream } from "@/hooks/use-student-voice-stream";
import { useFileUpload, type FileWithPreview } from "@/hooks/use-file-uploader";

export interface ChatInputProps {
  onSend: (
    message: string,
    options?: {
      docUrl?: string;
      uploadedDocs?: Array<{
        url: string;
        filename: string;
        type: string;
      }>;
      model?: string;
    }
  ) => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  hasMessages?: boolean;
  studentId?: string;
  sessionId?: string;
  studentName?: string;
  grade?: string;
  subject?: string;
  pendingAssignments?: Array<Record<string, any>>;
  completedAssignments?: Array<Record<string, any>>;
  onTranscription?: (text: string, role: "user" | "assistant") => void;
}

export const MODEL_MAPPING = [
  {
    frontendValue: "gemini_2_5_flash",
    displayName: "Gemini 2.5 Flash",
    backendName: "google/gemini-2.5-flash",
  },
  {
    frontendValue: "gemini_2_5_pro",
    displayName: "Gemini 2.5 Pro",
    backendName: "google/gemini-2.5-pro",
  },
  {
    frontendValue: "gemini_2_5_flash_lite",
    displayName: "Gemini 2.5 Flash-lite",
    backendName: "google/gemini-2.5-flash-lite",
  },
  {
    frontendValue: "gpt_4_1",
    displayName: "GPT 4.1",
    backendName: "openai/gpt-4.1",
  },
  { frontendValue: "gpt_5", displayName: "GPT 5", backendName: "openai/gpt-5" },
  {
    frontendValue: "gpt_5_thinking_high",
    displayName: "GPT 5 Thinking High",
    backendName: "openai/gpt-5-thinking-high",
  },
  {
    frontendValue: "gpt_5_mini",
    displayName: "GPT 5 mini",
    backendName: "openai/gpt-5-mini",
  },
  {
    frontendValue: "gpt_5_nano",
    displayName: "GPT 5 nano",
    backendName: "openai/gpt-5-nano",
  },
  {
    frontendValue: "gpt_4o",
    displayName: "GPT-4o",
    backendName: "openai/gpt-4o",
  },
  {
    frontendValue: "claude_sonnet_4_5",
    displayName: "Claude Sonnet 4.5",
    backendName: "anthropic/claude-4.5-sonnet",
  },
  {
    frontendValue: "claude_opus_4_1",
    displayName: "Claude Opus 4.1",
    backendName: "anthropic/claude-4.1-opus",
  },
  {
    frontendValue: "claude_haiku_3_5",
    displayName: "Claude Haiku 3.5",
    backendName: "anthropic/claude-3.5-haiku",
  },
  {
    frontendValue: "grok_4_fast",
    displayName: "Grok 4 Fast",
    backendName: "x-ai/grok-4-fast",
  },
  {
    frontendValue: "deepseek_v3_1",
    displayName: "DeepSeek V3.1",
    backendName: "deepseek/deepseek-chat-v3.1",
  },
  {
    frontendValue: "meta_llama_3_3_70b",
    displayName: "meta/llama 3.3 70b",
    backendName: "meta-llama/llama-3.3-70b-instruct:free",
  },
  {
    frontendValue: "kimi_k2_0905",
    displayName: "Kimi K2 0905",
    backendName: "moonshotai/kimi-k2-0905",
  },
];

const getBackendName = (frontendValue: string): string | undefined => {
  const model = MODEL_MAPPING.find((m) => m.frontendValue === frontendValue);
  return model?.backendName;
};

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
  studentId,
  sessionId,
  studentName,
  grade,
  subject,
  pendingAssignments,
  completedAssignments,
  onTranscription,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini_2_5_flash");
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

  // File uploader hook - only enable backend integration if sessionId is available
  const [fileUploadState, fileUploadActions] = useFileUpload({
    maxFiles: 5,
    maxSize: 50 * 1024 * 1024, // 50MB
    accept:
      "image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,application/json,text/plain",
    multiple: true,
    uploadToR2: true,
    // Only send to backend if we have a valid sessionId from backend
    backendUrl: sessionId && sessionId.trim() !== "" ? BACKEND_URL : undefined,
    userId: studentId,
    sessionId: sessionId && sessionId.trim() !== "" ? sessionId : undefined,
    userType: "student",
    onFilesAdded: (files: FileWithPreview[]) => {
      toast.success(`${files.length} file(s) uploaded successfully`);
    },
    onUploadError: ({ fileId, error }) => {
      toast.error(`Failed to upload file: ${error}`);
    },
  });

  const uploadedDocs: UploadedDoc[] = fileUploadState.files
    .map((file) => {
      if (file.file instanceof File) {
        // File is still being uploaded or hasn't been uploaded yet
        return null;
      }
      // File has been uploaded and is now FileMetadata
      return {
        url: file.file.url,
        filename: file.file.name,
        type: file.file.type,
      };
    })
    .filter((doc): doc is UploadedDoc => doc !== null); // Only include files with URLs (uploaded to R2)

  const isUploading = fileUploadState.isUploading;

  const { status, isRecording, error, connect, disconnect, toggleMute } =
    useStudentVoiceStream();

  useEffect(() => {
    if (status === "connected") {
      setVoiceMode(true);
      setIsListening(isRecording);
    } else if (status === "disconnected" || status === "idle") {
      setVoiceMode(false);
      setIsListening(false);
    }
  }, [status, isRecording]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSend = useCallback(() => {
    if (
      (message.trim() || uploadedDocs.length > 0) &&
      !isLoading &&
      !isUploading
    ) {
      const backendModelName = getBackendName(selectedModel);
      onSend(message.trim() || "Files attached", {
        docUrl: uploadedDocs.length > 0 ? uploadedDocs[0].url : undefined,
        uploadedDocs: uploadedDocs.length > 0 ? uploadedDocs : undefined,
        model: backendModelName,
      });

      setMessage("");
      fileUploadActions.clearFiles();
    }
  }, [
    message,
    isLoading,
    isUploading,
    onSend,
    uploadedDocs,
    selectedModel,
    fileUploadActions,
  ]);

  const removeDocument = useCallback(
    (index: number) => {
      const fileToRemove = fileUploadState.files[index];
      if (fileToRemove) {
        fileUploadActions.removeFile(fileToRemove.id);
      }
    },
    [fileUploadState.files, fileUploadActions]
  );

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

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

  const handleVoiceToggle = useCallback(async () => {
    if (status === "connected" || status === "connecting") {
      console.log("🔴 Disconnecting voice...");
      await disconnect();
    } else {
      if (!studentId || !sessionId) {
        toast.error("Session not initialized. Please refresh the page.");
        return;
      }

      console.log("🟢 Connecting voice...");

      await connect({
        sessionId,
        studentId,
        studentName: studentName || "Student",
        grade: grade || "General",
        subject: subject || "",
        pendingAssignments: pendingAssignments || [],
        completedAssignments: completedAssignments || [],
        voice: "shimmer",
        onTranscription,
      });
    }
  }, [
    status,
    studentId,
    sessionId,
    studentName,
    grade,
    subject,
    pendingAssignments,
    completedAssignments,
    connect,
    disconnect,
    onTranscription,
  ]);

  return (
    <div
      className={cn(
        "w-full max-w-4xl mx-auto",
        hasMessages ? "" : "px-2 sm:px-4",
        className
      )}
    >
      {uploadedDocs.length > 0 && (
        <div className="mb-2 sm:mb-3 flex flex-wrap gap-1.5 sm:gap-2">
          {uploadedDocs.map((doc, index) => (
            <div
              key={index}
              className="flex items-center gap-1.5 sm:gap-2 bg-muted/50 border border-border rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm"
            >
              <span className="text-base sm:text-lg">
                {getFileIcon(doc.type)}
              </span>
              <div className="flex flex-col min-w-0">
                <span
                  className="font-medium truncate max-w-[80px] sm:max-w-[120px]"
                  title={doc.filename}
                >
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
          {voiceMode ? (
            <div className="min-h-[80px] flex items-center justify-center">
              <LiveWaveform
                active={isListening}
                processing={false}
                height={70}
                barWidth={3}
                barGap={2}
                mode="static"
                fadeEdges={true}
                barColor="primary"
                historySize={100}
              />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                isUploading ? "Uploading documents..." : "Ask anything..."
              }
              disabled={disabled || isLoading || isUploading}
              className="w-full min-h-[40px] sm:min-h-[44px] max-h-[120px] sm:max-h-[180px] resize-none outline-none text-sm sm:text-base leading-snug bg-transparent placeholder:text-muted-foreground disabled:opacity-50 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding"
              rows={2}
            />
          )}
        </div>
        <div className="flex flex-col gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2">
          <input {...fileUploadActions.getInputProps()} className="hidden" />

          <div className="flex md:hidden items-center justify-between gap-1.5">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6 sm:h-7 sm:w-7 rounded-full"
                disabled={disabled || isLoading || isUploading}
                onClick={fileUploadActions.openFileDialog}
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
                    {MODEL_MAPPING.map((model) => (
                      <SelectItem
                        key={model.frontendValue}
                        value={model.frontendValue}
                        className="text-xs sm:text-sm"
                      >
                        {model.displayName}
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={canSend ? handleSend : handleVoiceToggle}
              disabled={disabled || isLoading || isUploading}
              size="icon"
              className={cn(
                "h-6 w-6 sm:h-7 sm:w-7 rounded-full",
                !canSend && voiceMode && "bg-green-600 hover:bg-green-700"
              )}
              title={
                canSend
                  ? "Send message"
                  : voiceMode
                  ? "Stop voice mode"
                  : "Start voice chat"
              }
            >
              {canSend ? (
                <ArrowUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              ) : voiceMode ? (
                <Mic className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              ) : (
                <AudioLines className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              )}
            </Button>
          </div>

          <div className="hidden md:flex items-center justify-between gap-2 lg:gap-3">
            <div className="flex items-center gap-1.5 lg:gap-2">
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={disabled || isLoading || isUploading}
              >
                <SelectTrigger className="h-7 px-2 rounded-md text-sm border-border bg-muted hover:bg-accent focus:ring-0 focus:ring-offset-0 min-w-[180px] lg:min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-[400px] overflow-y-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-1 p-2">
                    {MODEL_MAPPING.map((model) => (
                      <SelectItem
                        key={model.frontendValue}
                        value={model.frontendValue}
                        className="text-sm"
                      >
                        {model.displayName}
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
                disabled={disabled || isLoading || isUploading}
                onClick={fileUploadActions.openFileDialog}
                title="Attach file"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </Button>
              <Button
                onClick={canSend ? handleSend : handleVoiceToggle}
                disabled={disabled || isLoading || isUploading}
                size="icon"
                className={cn(
                  "h-7 w-7 rounded-full",
                  !canSend && voiceMode && "bg-green-600 hover:bg-green-700"
                )}
                title={
                  canSend
                    ? "Send message"
                    : voiceMode
                    ? "Stop voice mode"
                    : "Start voice chat"
                }
              >
                {canSend ? (
                  <ArrowUp className="h-3.5 w-3.5" />
                ) : voiceMode ? (
                  <Mic className="h-3.5 w-3.5" />
                ) : (
                  <AudioLines className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
