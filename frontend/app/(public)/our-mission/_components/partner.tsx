"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import ContactFormPopup from "../../_components/contact-form-popup";

export default function PartnerCtaSection() {
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  return (
    <section className="relative w-full overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#eaf7f4] via-[#eaf2fb] to-[#efe9fb]" />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-28 text-center">
        <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#0f172a] mb-6">
          Partner With Us
        </h2>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-[#64748b] mb-12 leading-relaxed">
          Whether you're an NGO, a government institution, or someone who
          believes in our mission — we'd love to hear from you.
        </p>

        <button 
          onClick={() => setIsContactFormOpen(true)}
          className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#ffb7a5] to-[#ffcfa3] px-8 py-4 text-white font-semibold shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
        >
          Get in Touch
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      <ContactFormPopup
        open={isContactFormOpen}
        onOpenChange={setIsContactFormOpen}
      />
    </section>
  );
}
