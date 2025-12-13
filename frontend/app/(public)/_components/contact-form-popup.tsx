"use client";

import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface ContactFormPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ContactFormPopup({
  open,
  onOpenChange,
}: ContactFormPopupProps) {
  useEffect(() => {
    if (open) {
      // Load the form embed script when dialog opens
      const script = document.createElement("script");
      script.src = "https://link.msgsndr.com/js/form_embed.js";
      script.async = true;
      document.body.appendChild(script);

      return () => {
        // Cleanup script on unmount
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      };
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full p-0 border-none">
        <div className="w-full h-[432px] rounded-lg overflow-hidden">
          <iframe
            src="https://api.leadconnectorhq.com/widget/form/ON2NAMRArsOHH2WmxsvL"
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              border: "none",
              borderRadius: "4px",
            }}
            id="popup-ON2NAMRArsOHH2WmxsvL"
            data-layout='{"id":"POPUP"}'
            data-trigger-type="alwaysShow"
            data-trigger-value=""
            data-activation-type="alwaysActivated"
            data-activation-value=""
            data-deactivation-type="neverDeactivate"
            data-deactivation-value=""
            data-form-name="VidyaLabs Interest Form "
            data-height="432"
            data-layout-iframe-id="popup-ON2NAMRArsOHH2WmxsvL"
            data-form-id="ON2NAMRArsOHH2WmxsvL"
            title="VidyaLabs Interest Form "
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
