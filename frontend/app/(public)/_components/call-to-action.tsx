"use client";

import React from "react";
import { Check } from "lucide-react";

export default function CallToAction() {
  return (
    <section className="bg-[#FFFBF5] py-24 px-6">
      <div
        className="
        max-w-5xl mx-auto 
        rounded-[32px] 
        py-16 px-10 md:px-16
        text-center 
        text-white
        shadow-xl 
        "
        style={{
          background: "linear-gradient(90deg, #FF6B2C 0%, #FF8A3D 100%)",
        }}
      >
        {/* Heading */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-4">
          Ready to Transform How Your Students Learn?
        </h2>

        <p className="text-white/90 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed mb-10">
          Join hundreds of schools already using VidyaLabs to give every student
          the personalized attention they deserve.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
          <button
            className="
              bg-white text-[#FF6B2C] 
              font-semibold 
              px-8 py-3 
              rounded-full 
              shadow-sm 
              hover:bg-white/90
              transition
              text-sm
            "
            suppressHydrationWarning
          >
            Start Your Free Trial
          </button>

          <button
            className="
              bg-transparent text-white 
              border border-white 
              font-semibold 
              px-8 py-3 
              rounded-full 
              hover:bg-white/10
              transition
              text-sm
            "
            suppressHydrationWarning
          >
            Schedule a Demo
          </button>
        </div>

        {/* Perks / bullets */}
        <div className="flex flex-col sm:flex-row justify-center gap-6 text-white/90 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-white" /> No credit card required
          </div>

          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-white" /> Free onboarding support
          </div>

          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-white" /> Cancel anytime
          </div>
        </div>
      </div>
    </section>
  );
}
