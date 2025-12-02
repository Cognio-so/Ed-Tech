"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { saveConversation } from "@/app/teacher/history/action";

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

export interface UseAITutorOptions {
  onMessage?: (message: ChatMessage) => void;
  onError?: (error: string) => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export function useAITutor(options?: UseAITutorOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const lastSavedMessagesRef = useRef<string>("");
  const isSavingRef = useRef(false);
  const { data: session } = authClient.useSession();

  const sendMessage = useCallback(
    async (
      message: string,
      messageOptions?: {
        teacherData?: Record<string, any>;
        studentData?: Record<string, any>;
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
        toast.error("Please log in to use AI Tutor");
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessageId)
        );
        setIsLoading(false);
        return;
      }

      const teacherId = session.user.id;
      const currentSessionId =
        sessionIdRef.current || `session_${teacherId}_${Date.now()}`;
      sessionIdRef.current = currentSessionId;

      try {
        const backendPayload = {
          message,
          teacher_data: messageOptions?.teacherData || null,
          student_data: messageOptions?.studentData || null,
          topic: messageOptions?.topic || null,
          subject: messageOptions?.subject || null,
          doc_url: messageOptions?.docUrl || null,
          language: messageOptions?.language || "English",
          model: messageOptions?.model || null,
        };

        const endpoint = `${BACKEND_URL}/api/teacher/${teacherId}/session/${currentSessionId}/stream-chat?stream=true`;

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
          let errorMessage = "Failed to get AI tutor response";
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
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "content" && data.data) {
                  if (data.data.chunk) {
                    accumulatedContent += data.data.chunk;
                    setStreamingContent(accumulatedContent);

                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      )
                    );
                  } else if (data.data.full_response) {
                    accumulatedContent = data.data.full_response;
                    setStreamingContent(accumulatedContent);

                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: accumulatedContent }
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
                const text = line.slice(6);
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
          }
        }

        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: accumulatedContent }
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

              saveConversation(
                messagesJson,
                undefined,
                conversationIdRef.current || undefined,
                sessionIdRef.current || undefined
              )
                .then((result) => {
                  if (result?.conversationId && !conversationIdRef.current) {
                    conversationIdRef.current = result.conversationId;
                  }
                })
                .catch(() => {})
                .finally(() => {
                  isSavingRef.current = false;
                });
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

  return {
    messages,
    isLoading,
    streamingContent,
    sendMessage,
    stop,
    clearMessages,
  };
}
