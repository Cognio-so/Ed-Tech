"use client";

import { cn } from "@/lib/utils";
import { memo } from "react";
import Markdown from "@/components/ui/markdown";

type ResponseProps = {
  children: string;
  className?: string;
  sources?: Array<{ href: string; title: string }>;
};

export const Response = memo(
  ({ className, children, sources, ...props }: ResponseProps) => (
    <Markdown
      content={children}
      sources={sources}
      className={cn(
        "max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 break-words text-[0.9375rem] leading-7",
        className
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";