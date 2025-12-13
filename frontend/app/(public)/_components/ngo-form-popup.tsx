"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

interface NGOFormPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NGOFormPopup({
  open,
  onOpenChange,
}: NGOFormPopupProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Load script FIRST */}
      <Script
        src="https://link.msgsndr.com/js/form_embed.js"
        strategy="beforeInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Stable container */}
        <div className="relative z-10 w-full max-w-3xl h-[90vh] bg-transparent">
          {scriptLoaded && (
            <iframe
              src="https://api.leadconnectorhq.com/widget/form/s60QWopJ8a4dnorbjWqa"
              title="VidyaLabs NGO Form"
              className="w-full h-full border-none bg-transparent"
              data-layout='{"id":"INLINE"}'
              data-form-id="s60QWopJ8a4dnorbjWqa"
            />
          )}
        </div>
      </div>
    </>
  );
}
