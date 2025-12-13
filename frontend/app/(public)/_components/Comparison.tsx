"use client";

import React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ComparisonRow = {
  capability: string;
  vidyaLabs: boolean | "Partial";
  traditional: boolean | "Partial";
};

const COMPARISON_DATA: ComparisonRow[] = [
  {
    capability: "AI-Powered Content Generation",
    vidyaLabs: true,
    traditional: false,
  },
  {
    capability: "Voice AI Tutor in Regional Languages",
    vidyaLabs: true,
    traditional: false,
  },
  {
    capability: "Real-Time Student Weakness Detection",
    vidyaLabs: true,
    traditional: false,
  },
  {
    capability: "Cognitive Learning Methodology",
    vidyaLabs: true,
    traditional: false,
  },
  {
    capability: "NCERT-Grounded Material",
    vidyaLabs: true,
    traditional: "Partial",
  },
  {
    capability: "Lightweight & Fast Setup",
    vidyaLabs: true,
    traditional: false,
  },
  {
    capability: "Built for Indian Schools",
    vidyaLabs: true,
    traditional: false,
  },
];

export default function ComparisonTable() {
  return (
    <section className="w-full bg-white py-20 sm:py-24">
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-xs sm:text-sm tracking-widest text-[#FF6B2C] font-bold uppercase">
            WHY VIDYALABS?
          </span>

          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#07312CF2] leading-tight">
            Built Different from Day One
          </h2>

          <p className="mt-6 text-sm sm:text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Unlike legacy platforms that bolt on AI as an afterthought,
            VidyaLabs is AI native from the ground up.
          </p>
        </div>

        {/* Table Container */}
        <div className="rounded-3xl overflow-hidden shadow-2xl border border-gray-100">
          {/* Table Header */}
          <div className="grid grid-cols-12 bg-[#07312CF2] text-white py-4 px-6 sm:px-10 items-center">
            <div className="col-span-6 sm:col-span-5 text-sm sm:text-lg font-bold">
              Capability
            </div>
            <div className="col-span-3 sm:col-span-3.5 text-center text-sm sm:text-lg font-bold">
              VidyaLabs
            </div>
            <div className="col-span-3 sm:col-span-3.5 text-center text-sm sm:text-lg font-bold text-gray-300">
              Traditional LMS
            </div>
          </div>

          {/* Rows */}
          <div className="bg-white">
            {COMPARISON_DATA.map((row, idx) => (
              <div
                key={row.capability}
                className={cn(
                  "grid grid-cols-12 py-3 px-6 sm:px-10 items-center border-b border-gray-50 last:border-0 transition-colors hover:bg-gray-50/50",
                  idx % 2 === 0 ? "bg-white" : "bg-[#FFF9F6]" // Alternating white and very light orange/pink
                )}
              >
                {/* Capability Name */}
                <div className="col-span-6 sm:col-span-5 text-sm sm:text-base font-medium text-[#07312CF2]">
                  {row.capability}
                </div>

                {/* VidyaLabs Status */}
                <div className="col-span-3 sm:col-span-3.5 flex justify-center">
                  {row.vidyaLabs === true ? (
                    <div className="w-8 h-8 rounded-full bg-[#E0F2F1] flex items-center justify-center">
                      <Check
                        className="w-5 h-5 text-[#00897B]"
                        strokeWidth={3}
                      />
                    </div>
                  ) : row.vidyaLabs === "Partial" ? (
                    <span className="text-sm font-medium text-red-500">
                      Partial
                    </span>
                  ) : (
                    <X className="w-4 h-4 text-gray-300" strokeWidth={2} />
                  )}
                </div>

                {/* Traditional LMS Status */}
                <div className="col-span-3 sm:col-span-3.5 flex justify-center">
                  {row.traditional === true ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : row.traditional === "Partial" ? (
                    <span className="text-sm font-medium text-red-500">
                      Partial
                    </span>
                  ) : (
                    <X className="w-4 h-4 text-red-500" strokeWidth={2} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
