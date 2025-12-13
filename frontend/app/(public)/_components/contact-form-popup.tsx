"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ContactFormPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ContactFormPopup({
  open,
  onOpenChange,
}: ContactFormPopupProps) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Container */}
      <div className="relative w-full max-w-2xl h-[85vh]">
        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute -top-10 right-0 text-white hover:opacity-80"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Scroll Area */}
        <ScrollArea className="h-full w-full rounded-xl overflow-hidden">
          <iframe
            src="https://api.leadconnectorhq.com/widget/form/ON2NAMRArsOHH2WmxsvL"
            title="VidyaLabs Interest Form"
            className="w-full h-[900px] border-none bg-transparent"
          />
        </ScrollArea>
      </div>
    </div>
  );
}
