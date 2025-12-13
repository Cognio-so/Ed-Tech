"use client";

import * as React from "react";
import { useSidebar } from "@/components/ui/sidebar";
import Image from "next/image";
import { Shield } from "lucide-react";

interface TeamSwitcherProps {
  showName?: boolean;
}

export function TeamSwitcher({
  showName = true,
}: TeamSwitcherProps) {
  const { state } = useSidebar();
  const isExpanded = state === "expanded";

  return (
    <div className="flex items-center justify-between w-full px-2 py-2">
  <div className="flex items-center gap-2 mr-2">
    {isExpanded ? (
      <>
        <Image
          src="/logo.png"
          alt="VidyaLabs Logo"
          width={32}
          height={32}
          className="h-7 w-7 sm:h-8 sm:w-8 object-contain"
        />
        {showName && (
          <span className="text-xl font-semibold text-foreground transition-opacity duration-300 flex items-center gap-2">
            VidyaLabs
          </span>
        )}
      </>
    ) : (
      <span className="text-lg font-bold text-primary"><Shield className="size-5"/></span>
    )}
  </div>
</div>

  );
}