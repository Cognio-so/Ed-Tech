"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  sessionId?: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export function useAITutor(options?: UseAITutorOptions) {
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
      const currentSessionId = sessionIdRef.current;

      if (!currentSessionId || currentSessionId.trim() === "") {
        setIsLoading(false);
        options?.onError?.(
          "Session not initialized. Please wait for session to be created."
        );
        return;
      }

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

        // Log the payload being sent to backend
        console.log("📤 Sending payload to backend:", {
          endpoint: `${BACKEND_URL}/api/teacher/${teacherId}/session/${currentSessionId}/stream-chat?stream=true`,
          payload: backendPayload,
          teacherId,
          sessionId: currentSessionId,
        });

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
        let imageUrls: string[] = [];
        let videoUrls: string[] = [];
        let tokenUsage:
          | {
              input_tokens: number;
              output_tokens: number;
              total_tokens: number;
            }
          | undefined;
        let buffer = ""; // Buffer for incomplete JSON lines

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
            // Process any remaining buffer
            if (buffer.trim()) {
              try {
                const data = JSON.parse(buffer.trim());
                console.log("📥 Received final buffered data:", data.type);
                // Process final buffered data if needed
              } catch (e) {
                console.warn(
                  "⚠️ Could not parse final buffer:",
                  buffer.substring(0, 100)
                );
              }
            }
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete lines (ending with \n)
          // Keep processing while we have complete lines
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            const line = buffer.substring(0, newlineIndex);
            buffer = buffer.substring(newlineIndex + 1);

            if (line.trim().startsWith("data: ")) {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              try {
                const data = JSON.parse(jsonStr);
                console.log(
                  "📥 Received data from backend:",
                  data.type,
                  data.data ? Object.keys(data.data) : "no data"
                );

                if (data.type === "content" && data.data) {
                  if (data.data.chunk) {
                    let chunk = data.data.chunk;

                    // Remove "Image generated successfully:" prefix if present in chunk
                    chunk = chunk.replace(
                      /Image\s+generated\s+successfully:\s*/gi,
                      ""
                    );

                    // Remove base64 data URLs from chunks
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

                    // Remove "Image generated successfully: data:image/..." pattern
                    // This regex matches "Image generated successfully:" followed by a data URL (handles very long base64 strings)
                    cleanedContent = cleanedContent.replace(
                      /Image\s+generated\s+successfully:\s*data:image\/[^\s\)\]]+/gi,
                      ""
                    );

                    // Also remove standalone base64 data URLs that might be in the text
                    // This removes data:image/... patterns that appear in the content
                    cleanedContent = cleanedContent.replace(
                      /data:image\/[^\s\)\]]+/g,
                      ""
                    );

                    // Clean up multiple spaces, newlines, and trailing punctuation
                    // Don't replace newlines as they are needed for markdown
                    cleanedContent = cleanedContent.trim();

                    // If content is empty or only whitespace after cleaning, set to empty string
                    if (!cleanedContent || cleanedContent.trim().length === 0) {
                      cleanedContent = "";
                    }

                    accumulatedContent = cleanedContent;
                    setStreamingContent(accumulatedContent);

                    // Extract image URLs from response
                    if (data.data.image_result) {
                      const imageResult = data.data.image_result;
                      if (typeof imageResult === "string") {
                        // Base64 data URL
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

                    // Extract img_urls array if present
                    if (
                      data.data.img_urls &&
                      Array.isArray(data.data.img_urls)
                    ) {
                      imageUrls = [...imageUrls, ...data.data.img_urls];
                      console.log(
                        "🖼️ Extracted img_urls:",
                        data.data.img_urls.length
                      );
                    }

                    // Extract video URLs if present
                    if (
                      data.data.video_urls &&
                      Array.isArray(data.data.video_urls)
                    ) {
                      videoUrls = data.data.video_urls;
                      console.log("🎥 Extracted video URLs:", videoUrls.length);
                    }

                    // Extract token usage
                    if (data.data.token_usage) {
                      tokenUsage = data.data.token_usage;
                    }

                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? {
                              ...msg,
                              content: accumulatedContent,
                              imageUrls:
                                imageUrls.length > 0 ? imageUrls : undefined,
                              videoUrls:
                                videoUrls.length > 0 ? videoUrls : undefined,
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
                // If JSON parsing fails, check if it's incomplete
                const jsonStr = line.slice(6).trim();

                // Check for incomplete JSON indicators - crude check
                // If it doesn't end with a closing brace/bracket, it's definitely incomplete
                if (
                  jsonStr &&
                  !jsonStr.endsWith("}") &&
                  !jsonStr.endsWith("]")
                ) {
                  // Might be incomplete - add back to buffer
                  buffer = line + "\n" + buffer;
                  console.log(
                    "⚠️ JSON parse failed (incomplete end), buffering for next chunk..."
                  );
                  break; // Wait for more data
                }

                // If it ends with brace but still fails, it might be a split string inside JSON
                // We should try to buffer it too, but be careful of infinite loops
                // Only buffer if we haven't seen this exact line failure before?
                // Simpler: if it's very long, assume split.
                if (e instanceof SyntaxError && jsonStr.length > 100) {
                  buffer = line + "\n" + buffer;
                  console.log(
                    "⚠️ JSON parse failed (likely split), buffering..."
                  );
                  break;
                }

                console.error(
                  "Error parsing stream data:",
                  e instanceof Error ? e.message : String(e)
                );
                if (e instanceof SyntaxError) {
                  console.error(
                    "JSON syntax error - line length:",
                    jsonStr.length
                  );
                  console.error("First 200 chars:", jsonStr.substring(0, 200));
                  console.error(
                    "Last 200 chars:",
                    jsonStr.substring(Math.max(0, jsonStr.length - 200))
                  );

                  // If it's a syntax error and the string is very long, it might be a split base64
                  // Try to recover by waiting for more chunks
                  if (jsonStr.length > 10000) {
                    buffer = line + "\n" + buffer;
                    console.log(
                      "⚠️ Very long JSON string detected, buffering for completion..."
                    );
                    break;
                  }
                }

                // Try to extract any text content from the line as fallback
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
              // Handle lines that don't start with "data: " but might be continuation
              // This shouldn't happen in SSE format, but handle gracefully
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
                saveConversation(
                  messagesJson,
                  undefined,
                  conversationIdRef.current || undefined,
                  sessionIdRef.current || undefined
                )
                  .then((result) => {
                    if (
                      result?.success &&
                      result?.conversationId &&
                      !conversationIdRef.current
                    ) {
                      conversationIdRef.current = result.conversationId;
                    } else if (result?.error) {
                      console.warn(
                        "Failed to save conversation:",
                        result.error
                      );
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

          // Final save when streaming completes
          setMessages((prev) => {
            const finalMessages = prev.map((msg) =>
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

            // Save final state
            if (session?.user?.id && finalMessages.length > 0) {
              const messagesJson = JSON.stringify(
                finalMessages.map((msg) => ({
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

                setTimeout(() => {
                  saveConversation(
                    messagesJson,
                    undefined,
                    conversationIdRef.current || undefined,
                    sessionIdRef.current || undefined
                  )
                    .then((result) => {
                      if (
                        result?.success &&
                        result?.conversationId &&
                        !conversationIdRef.current
                      ) {
                        conversationIdRef.current = result.conversationId;
                      } else if (result?.error) {
                        console.warn(
                          "Failed to save conversation:",
                          result.error
                        );
                      }
                    })
                    .catch((error) => {
                      console.error("Error saving conversation:", error);
                    })
                    .finally(() => {
                      isSavingRef.current = false;
                    });
                }, 100);
              }
            }

            return finalMessages;
          });
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
      setMessages((prev) => {
        // Check if there's a recent voice message of the same role to update
        const lastMessage = prev[prev.length - 1];
        const isRecentVoiceMessage = 
          lastMessage && 
          lastMessage.role === role && 
          lastMessage.id?.startsWith(`${role}-voice-`) &&
          Date.now() - lastMessage.timestamp.getTime() < 5000; // Within 5 seconds
        
        let updated: ChatMessage[];
        if (isRecentVoiceMessage) {
          // Update the last message instead of creating a new one
          updated = prev.map((msg, idx) => 
            idx === prev.length - 1 
              ? { ...msg, content } 
              : msg
          );
        } else {
          // Create a new message
          const message: ChatMessage = {
            id: `${role}-voice-${Date.now()}`,
            role,
            content,
            timestamp: new Date(),
          };
          updated = [...prev, message];
        }
        
        // Save conversation when voice message is added
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

            setTimeout(() => {
              saveConversation(
                messagesJson,
                undefined,
                conversationIdRef.current || undefined,
                sessionIdRef.current || undefined
              )
                .then((result) => {
                  if (
                    result?.success &&
                    result?.conversationId &&
                    !conversationIdRef.current
                  ) {
                    conversationIdRef.current = result.conversationId;
                  } else if (result?.error) {
                    console.warn(
                      "Failed to save conversation:",
                      result.error
                    );
                  }
                })
                .catch((error) => {
                  console.error("Error saving conversation:", error);
                })
                .finally(() => {
                  isSavingRef.current = false;
                });
            }, 100);
          }
        }
        
        return updated;
      });
    },
    [session?.user?.id]
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
