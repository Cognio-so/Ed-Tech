"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { saveStudentConversation } from "@/app/student/history/action";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  uploadedDocs?: Array<{
    url: string;
    filename: string;
    type: string;
  }>;
  imageUrls?: string[];
  videoUrls?: string[];
  tokenUsage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  sources?: Array<{
    href: string;
    title: string;
  }>;
}

export interface UseStudentAITutorOptions {
  onMessage?: (message: ChatMessage) => void;
  onError?: (error: string) => void;
  sessionId?: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export function useStudentAITutor(options?: UseStudentAITutorOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(options?.sessionId || null);
  const conversationIdRef = useRef<string | null>(null);
  const lastSavedMessagesRef = useRef<string>("");
  const isSavingRef = useRef(false);
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (options?.sessionId) {
      sessionIdRef.current = options.sessionId;
    }
  }, [options?.sessionId]);

  const sendMessage = useCallback(
    async (
      message: string,
      messageOptions?: {
        studentProfile?: Record<string, any>;
        pendingAssignments?: Array<Record<string, any>>;
        completedAssignments?: Array<Record<string, any>>;
        achievements?: string[];
        assessmentData?: Record<string, any>;
        topic?: string;
        subject?: string;
        docUrl?: string;
        uploadedDocs?: Array<{
          url: string;
          filename: string;
          type: string;
        }>;
        language?: string;
        model?: string;
      }
    ) => {
      if (!message.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: message,
        timestamp: new Date(),
        uploadedDocs: messageOptions?.uploadedDocs || undefined,
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setStreamingContent("");

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (!session?.user?.id) {
        toast.error("Please log in to use AI Assistant");
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessageId)
        );
        setIsLoading(false);
        return;
      }

      const studentId = session.user.id;
      const currentSessionId = sessionIdRef.current;
      
      if (!currentSessionId || currentSessionId.trim() === "") {
        setIsLoading(false);
        options?.onError?.("Session not initialized. Please wait for session to be created.");
        return;
      }
      
      sessionIdRef.current = currentSessionId;

      try {
        const backendPayload = {
          message,
          student_profile: messageOptions?.studentProfile || null,
          pending_assignments: messageOptions?.pendingAssignments || null,
          completed_assignments: messageOptions?.completedAssignments || null,
          achievements: messageOptions?.achievements || null,
          assessment_data: messageOptions?.assessmentData || null,
          topic: messageOptions?.topic || null,
          subject: messageOptions?.subject || null,
          doc_url: messageOptions?.docUrl || null,
          language: messageOptions?.language || "English",
          model: messageOptions?.model || null,
        };

        console.log("📤 Sending payload to backend:", {
          endpoint: `${BACKEND_URL}/api/student/${studentId}/session/${currentSessionId}/stream-chat?stream=true`,
          payload: backendPayload,
          studentId,
          sessionId: currentSessionId,
          completedAssignmentsCount: backendPayload.completed_assignments?.length || 0,
          pendingAssignmentsCount: backendPayload.pending_assignments?.length || 0,
        });

        const endpoint = `${BACKEND_URL}/api/student/${studentId}/session/${currentSessionId}/stream-chat?stream=true`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(backendPayload),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = "Failed to get AI assistant response";
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.detail || errorJson.error || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let accumulatedContent = "";
        let imageUrls: string[] = [];
        let videoUrls: string[] = [];
        let tokenUsage: { input_tokens: number; output_tokens: number; total_tokens: number } | undefined;
        let buffer = "";

        const sessionIdHeader = response.headers.get("X-Session-Id");
        if (sessionIdHeader) {
          const newSessionId = sessionIdHeader;
          if (sessionIdRef.current !== newSessionId) {
            sessionIdRef.current = newSessionId;
            conversationIdRef.current = null;
            lastSavedMessagesRef.current = "";
          }
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              try {
                const data = JSON.parse(buffer.trim());
                console.log("📥 Received final buffered data:", data.type);
              } catch (e) {
                console.warn("⚠️ Could not parse final buffer:", buffer.substring(0, 100));
              }
            }
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            const line = buffer.substring(0, newlineIndex);
            buffer = buffer.substring(newlineIndex + 1);
            
            if (line.trim().startsWith("data: ")) {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;
              
              try {
                const data = JSON.parse(jsonStr);
                console.log("📥 Received data from backend:", data.type, data.data ? Object.keys(data.data) : "no data");

                if (data.type === "content" && data.data) {
                  if (data.data.chunk) {
                    let chunk = data.data.chunk;
                    
                    chunk = chunk.replace(/Image\s+generated\s+successfully:\s*/gi, "");
                    chunk = chunk.replace(/data:image\/[^,\s\)\]]+/g, "");
                    
                    accumulatedContent += chunk;
                    setStreamingContent(accumulatedContent);

                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      )
                    );
                  } else if (data.data.full_response) {
                    let cleanedContent = data.data.full_response;
                    
                    cleanedContent = cleanedContent.replace(
                      /Image\s+generated\s+successfully:\s*data:image\/[^\s\)\]]+/gi,
                      ""
                    );
                    
                    cleanedContent = cleanedContent.replace(
                      /data:image\/[^\s\)\]]+/g,
                      ""
                    );
                    
                    // Don't replace newlines as they are needed for markdown
                    cleanedContent = cleanedContent.trim();
                    
                    if (!cleanedContent || cleanedContent.trim().length === 0) {
                      cleanedContent = "";
                    }
                    
                    accumulatedContent = cleanedContent;
                    setStreamingContent(accumulatedContent);

                    if (data.data.image_result) {
                      const imageResult = data.data.image_result;
                      if (typeof imageResult === "string") {
                        if (imageResult.startsWith("data:image/")) {
                          imageUrls = [imageResult];
                        } else {
                          imageUrls = [imageResult];
                        }
                      } else if (Array.isArray(imageResult)) {
                        imageUrls = imageResult;
                      }
                      console.log("🖼️ Extracted image URLs:", imageUrls.length);
                    }

                    if (data.data.img_urls && Array.isArray(data.data.img_urls)) {
                      imageUrls = [...imageUrls, ...data.data.img_urls];
                      console.log("🖼️ Extracted img_urls:", data.data.img_urls.length);
                    }

                    if (data.data.video_urls && Array.isArray(data.data.video_urls)) {
                      videoUrls = data.data.video_urls;
                      console.log("🎥 Extracted video URLs:", videoUrls.length);
                    }

                    if (data.data.token_usage) {
                      tokenUsage = data.data.token_usage;
                    }

                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? {
                              ...msg,
                              content: accumulatedContent,
                              imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
                              videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
                              tokenUsage,
                            }
                          : msg
                      )
                    );
                  }
                } else if (data.type === "done") {
                  if (data.data?.session_id) {
                    const newSessionId = data.data.session_id;
                    if (sessionIdRef.current !== newSessionId) {
                      sessionIdRef.current = newSessionId;
                      conversationIdRef.current = null;
                      lastSavedMessagesRef.current = "";
                    }
                  }
                } else if (data.type === "error") {
                  throw new Error(data.data?.error || "Unknown error");
                }
              } catch (e) {
                const jsonStr = line.slice(6).trim();
                
                if (jsonStr && !jsonStr.endsWith("}") && !jsonStr.endsWith("]")) {
                  buffer = line + "\n" + buffer;
                  console.log("⚠️ JSON parse failed (incomplete end), buffering for next chunk...");
                  break;
                }

                if (e instanceof SyntaxError && jsonStr.length > 100) {
                     buffer = line + "\n" + buffer;
                     console.log("⚠️ JSON parse failed (likely split), buffering...");
                     break;
                 }
                
                console.error("Error parsing stream data:", e instanceof Error ? e.message : String(e));
                if (e instanceof SyntaxError) {
                  console.error("JSON syntax error - line length:", jsonStr.length);
                  console.error("First 200 chars:", jsonStr.substring(0, 200));
                  console.error("Last 200 chars:", jsonStr.substring(Math.max(0, jsonStr.length - 200)));
                  
                  if (jsonStr.length > 10000) {
                    buffer = line + "\n" + buffer;
                    console.log("⚠️ Very long JSON string detected, buffering for completion...");
                    break;
                  }
                }
                
                const textMatch = line.match(/data:\s*(.+)/);
                if (textMatch && textMatch[1]) {
                  const text = textMatch[1];
                  accumulatedContent += text;
                  setStreamingContent(accumulatedContent);

                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    )
                  );
                }
              }
            } else if (line.trim()) {
              console.warn("Unexpected line format:", line.substring(0, 100));
            }
          }
        }

        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: accumulatedContent,
                  imageUrls: imageUrls.length > 0 ? imageUrls : msg.imageUrls,
                  videoUrls: videoUrls.length > 0 ? videoUrls : msg.videoUrls,
                  tokenUsage: tokenUsage || msg.tokenUsage,
                }
              : msg
          );

          if (session?.user?.id && updated.length > 0) {
            const messagesJson = JSON.stringify(
              updated.map((msg) => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp.toISOString(),
                uploadedDocs: msg.uploadedDocs,
                imageUrls: msg.imageUrls,
                videoUrls: msg.videoUrls,
                tokenUsage: msg.tokenUsage,
                sources: msg.sources,
              }))
            );

            if (
              messagesJson !== lastSavedMessagesRef.current &&
              !isSavingRef.current
            ) {
              lastSavedMessagesRef.current = messagesJson;
              isSavingRef.current = true;

              // Use setTimeout to ensure this runs after render, not during
              setTimeout(() => {
                saveStudentConversation(
                  messagesJson,
                  undefined,
                  conversationIdRef.current || undefined,
                  sessionIdRef.current || undefined
                )
                  .then((result) => {
                    if (result?.success && result?.conversationId && !conversationIdRef.current) {
                      conversationIdRef.current = result.conversationId;
                    } else if (result?.error) {
                      console.warn("Failed to save conversation:", result.error);
                    }
                  })
                  .catch((error) => {
                    console.error("Error saving conversation:", error);
                  })
                  .finally(() => {
                    isSavingRef.current = false;
                  });
              }, 0);
            }
          }

          return updated;
        });

        if (options?.onMessage) {
          options.onMessage({
            ...assistantMessage,
            content: accumulatedContent,
          });
        }

        setStreamingContent("");
      } catch (error: any) {
        if (error.name === "AbortError") {
          return;
        }

        const errorMessage = error.message || "Failed to send message";
        toast.error(errorMessage);

        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessageId)
        );

        if (options?.onError) {
          options.onError(errorMessage);
        }
      } finally {
        setIsLoading(false);
        setStreamingContent("");
        abortControllerRef.current = null;
      }
    },
    [isLoading, options, session?.user?.id]
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setStreamingContent("");
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingContent("");
    sessionIdRef.current = null;
    conversationIdRef.current = null;
    lastSavedMessagesRef.current = "";
  }, []);

  const addVoiceMessage = useCallback(
    (content: string, role: "user" | "assistant") => {
      const message: ChatMessage = {
        id: `${role}-voice-${Date.now()}`,
        role,
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, message]);
    },
    []
  );

  return {
    messages,
    isLoading,
    streamingContent,
    sendMessage,
    stop,
    clearMessages,
    addVoiceMessage,
  };
}

