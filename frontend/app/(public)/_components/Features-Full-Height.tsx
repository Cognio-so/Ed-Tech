"use client";

import { Check } from "lucide-react";

type Feature = {
  id: string;
  title: string;
  highlight?: string;
  description: string;
  bullets: string[];
  mockupType: "two-blocks" | "three-blocks" | "progress-blocks";
};

const FEATURES: Feature[] = [
  {
    id: "content-gen",
    title: "AI-Powered",
    highlight: "Content Generation",
    description:
      "Stop spending nights creating worksheets. Generate assessments, quizzes, lesson plans, and even comics—all grounded in your actual textbooks.",
    bullets: [
      "Worksheets and exams aligned to NCERT or any curriculum",
      "Auto-generated PowerPoints and visual learning aids",
      "Comics and engaging content for difficult concepts",
      "Detailed web reports for parent communication",
    ],
    mockupType: "two-blocks",
  },
  {
    id: "analytics",
    title: "Real-Time",
    highlight: "Student Analytics",
    description:
      "See exactly which concepts each student struggles with. No more guessing—just data-driven decisions that help every child succeed.",
    bullets: [
      "Individual student progress tracking",
      "Concept-level weakness identification",
      "Automated alerts for at-risk students",
      "Class-wide performance heatmaps",
    ],
    mockupType: "three-blocks",
  },
  {
    id: "cognitive",
    title: "Cognitive",
    highlight: "Learning System",
    description:
      "Built on proven learning science. Our platform teaches concepts the way the brain actually learns—through Socratic questioning and adaptive repetition.",
    bullets: [
      "Socratic dialogue-based concept building",
      "Spaced repetition for long-term retention",
      "Adaptive difficulty based on responses",
      "Multi-modal content (text, visual, audio)",
    ],
    mockupType: "progress-blocks",
  },
];

// Browser Window Mockup Component
function BrowserMockup({
  type,
}: {
  type: "two-blocks" | "three-blocks" | "progress-blocks";
}) {
  return (
    <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Browser Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
        {/* Browser Control Dots */}
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
          <div className="w-3 h-3 rounded-full bg-green-400"></div>
        </div>
      </div>

      {/* Browser Content */}
      <div className="p-6 bg-white min-h-[280px] md:min-h-[340px]">
        {type === "two-blocks" && (
          <div className="space-y-4">
            <div className="h-32 bg-gray-100 rounded-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-2 bg-[#FF6B2C]/30"></div>
            </div>
            <div className="h-32 bg-gray-100 rounded-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-2 bg-[#FF6B2C]/30"></div>
            </div>
          </div>
        )}

        {type === "three-blocks" && (
          <div className="flex gap-4">
            <div className="flex-1 h-40 bg-gray-100 rounded-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#FF6B2C]/20 to-[#FF6B2C]/10"></div>
            </div>
            <div className="flex-1 h-40 bg-gray-100 rounded-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#FF6B2C]/20 to-[#FF6B2C]/10"></div>
            </div>
            <div className="flex-1 h-40 bg-gray-100 rounded-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#FF6B2C]/20 to-[#FF6B2C]/10"></div>
            </div>
          </div>
        )}

        {type === "progress-blocks" && (
          <div className="space-y-4">
            <div className="h-24 bg-gray-100 rounded-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1/3 h-2 bg-[#FF6B2C]/40"></div>
            </div>
            <div className="h-8 bg-gray-100 rounded-lg"></div>
            <div className="h-8 bg-gray-100 rounded-lg"></div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FeaturesSection() {
  return (
    <section className="w-full bg-[#07312CF2] text-white py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16 md:mb-20">
          <span className="block text-xs sm:text-sm tracking-wider text-[#FF6B2C] font-medium uppercase">
            PLATFORM FEATURES
          </span>

          <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight">
            Everything Teachers Need, <br /> Nothing They Don&apos;t
          </h2>

          <p className="mt-6 max-w-2xl mx-auto text-sm sm:text-base text-gray-300">
            A lightweight, powerful platform that works the way you work—not the
            other way around.
          </p>
        </div>

        {/* Feature Blocks */}
        <div className="space-y-24 md:space-y-32">
          {FEATURES.map((f, idx) => {
            const isEven = idx % 2 === 0; // 0,2 → Text Left | Image Right

            return (
              <article
                key={f.id}
                className="w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center"
              >
                {/* TEXT BLOCK */}
                <div className={isEven ? "lg:order-1" : "lg:order-2"}>
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight">
                    {f.title}{" "}
                    <span className="text-[#FF6B2C] italic">{f.highlight}</span>
                  </h3>

                  <p className="mt-4 sm:mt-6 text-sm sm:text-base text-gray-300 max-w-lg leading-relaxed">
                    {f.description}
                  </p>

                  <ul className="mt-6 sm:mt-8 space-y-3 max-w-lg">
                    {f.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-3 text-sm sm:text-base text-gray-200"
                      >
                        <Check className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* BROWSER MOCKUP BLOCK */}
                <div className={isEven ? "lg:order-2" : "lg:order-1"}>
                  <BrowserMockup type={f.mockupType} />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
