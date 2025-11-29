"use client";

import * as React from "react";
import { useSidebar } from "@/components/ui/sidebar";
import Image from "next/image";
import logo from "@/public/DruidX logo.png";
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
        {/* <Image
          src={logo}
          alt="DruidX Logo"
          className="w-8 h-8 rounded-full transition-all duration-300"
        /> */}
        {showName && (
          <span className="text-xl font-semibold text-foreground transition-opacity duration-300 flex items-center gap-2">
            <Shield className="size-5"/>
            ED-TECH
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