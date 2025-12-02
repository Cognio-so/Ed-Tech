"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";

export interface UseContentStreamOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (content: string) => void;
  onError?: (error: string) => void;
}

export function useContentStream() {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamContent = useCallback(
    async (url: string, payload: any, options?: UseContentStreamOptions) => {
      if (isStreaming) return;

      setIsStreaming(true);
      setContent("");

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = "Failed to generate content";
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;
          setContent(accumulatedContent);

          if (options?.onChunk) {
            options.onChunk(chunk);
          }
        }

        if (options?.onComplete) {
          options.onComplete(accumulatedContent);
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          return;
        }

        const errorMessage = error.message || "Failed to stream content";
        toast.error(errorMessage);

        if (options?.onError) {
          options.onError(errorMessage);
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [isStreaming]
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const clear = useCallback(() => {
    setContent("");
    setIsStreaming(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    content,
    isStreaming,
    streamContent,
    stop,
    clear,
  };
}

