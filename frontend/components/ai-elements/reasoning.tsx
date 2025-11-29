"use client";

import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { memo } from "react";
import { Shimmer } from "./shimmer";

export type ReasoningProps = ComponentProps<"div"> & {
  isStreaming?: boolean;
  triggerMessage?: string; // Custom message to display
};

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    triggerMessage,
    ...props
  }: ReasoningProps) => {
    // Remove emojis from the message
    const cleanMessage = triggerMessage
      ? triggerMessage.replace(/[🌐📄🤖✅]/g, '').trim()
      : "Thinking...";

    return (
      <div
        className={cn(
          "not-prose mb-4 flex items-center gap-2 text-muted-foreground text-base",
          className
        )}
        {...props}
      >
        {isStreaming ? (
          <Shimmer duration={3}>{cleanMessage}</Shimmer>
        ) : (
          <span>{cleanMessage}</span>
        )}
      </div>
    );
  }
);

Reasoning.displayName = "Reasoning";

