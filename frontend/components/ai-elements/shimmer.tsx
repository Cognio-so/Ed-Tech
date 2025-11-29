"use client";

import { cn } from "@/lib/utils";
import { memo } from "react";

export type ShimmerProps = {
  children: React.ReactNode;
  className?: string;
  duration?: number;
};

export const Shimmer = memo(
  ({ children, className, duration = 3 }: ShimmerProps) => {
    return (
      <span
        className={cn(
          "inline-block relative",
          "bg-clip-text text-transparent bg-gradient-to-r bg-[length:200%_auto]",
          "from-primary via-primary/60 to-primary",
          "animate-[shimmer_3s_ease-in-out_infinite]",
          className
        )}
        style={{
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          animationDuration: `${duration}s`,
        }}
      >
        {children}
      </span>
    );
  }
);

Shimmer.displayName = "Shimmer";

