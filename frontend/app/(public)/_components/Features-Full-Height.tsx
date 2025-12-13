"use client";

import { Check } from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";

type FeatureItem = {
  title: string;
  description: string;
  points: string[];
  outcome: string;
};

type TabContent = {
  id: "teacher" | "student";
  label: string;
  features: FeatureItem[];
};

const TAB_CONTENT: TabContent[] = [
  {
    id: "teacher",
    label: "Teacher",
    features: [
      {
        title: "Teach More. Prepare Less.",
        description:
          "AI-powered tools that cut prep time dramatically without compromising quality.",
        points: [
          "Content Creation, Done in Minutes",
          "Generate worksheets, quizzes, lesson plans, presentations, and even comics fully aligned with your curriculum.",
          "Curriculum-Aligned by Default",
          "NCERT, CBSE, ICSE, IB, or custom syllabi your content always stays on track.",
        ],
        outcome: "",
      },
      {
        title: "See Every Student Clearly",
        description: "Real-time analytics reveal who's struggling, where, and why before it's too late.",
        points: [
          "Data, Not Guesswork",
          "Concept-level insights, class heatmaps, and early alerts help you intervene with confidence.",
          "Reports Parents Actually Understand",
          "Auto-generated progress reports that are clear, detailed, and shareable.",
        ],
        outcome: "",
      },
    ],
  },
  {
    id: "student",
    label: "Student",
    features: [
      {
        title: "Learning That Thinks With You",
        description: "Built on cognitive science students learn by reasoning, not memorizing.",
        points: [
          "Personalized, Always",
          "Every learner gets a unique path based on strengths, weaknesses, and pace.",
          "Understand Concepts, Not Just Answers",
          "Socratic questioning helps students think through problems step by step.",
        ],
        outcome: "",
      },
      {
        title: "Remember What You Learn",
        description: "Spaced repetition ensures concepts stick long after exams are over.",
        points: [
          "Learn Your Way",
          "Text, visuals, audio, and interactive feedback—learning that adapts to every style.",
          "Confidence Through Clarity",
          "Students always know where they stand, what they've mastered, and what's next.",
        ],
        outcome: "",
      },
    ],
  },
];

export default function FeaturesSection() {
  const [activeTab, setActiveTab] = useState<"teacher" | "student">("teacher");

  // Auto-switch tabs every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev === "teacher" ? "student" : "teacher"));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const currentContent = TAB_CONTENT.find((tab) => tab.id === activeTab)!;

  return (
    <section className="w-full bg-[#07312CF2] text-white py-20 md:py-28 relative overflow-hidden">
      {/* Bottom Fade Grid Background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: "20px 30px",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 100%, #000 60%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 100%, #000 60%, transparent 100%)",
        }}
      />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16 md:mb-20">
          <span className="block text-xs sm:text-sm tracking-wider text-[#FF6B2C] font-medium uppercase">
            PLATFORM FEATURES
          </span>

          <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight">
            Everything Teachers Need, <br /> Nothing They Don&apos;t
          </h2>

          <p className="mt-6 max-w-2xl mx-auto text-sm sm:text-base text-gray-300">
            Our platform is designed around real classrooms and real learning reducing teacher workload while dramatically improving student outcomes.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex gap-2 p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
            {TAB_CONTENT.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-full text-sm sm:text-base font-medium transition-all duration-300 ${
                  activeTab === tab.id
                    ? "bg-white text-[#07312CF2] shadow-md"
                    : "bg-transparent text-white/70 hover:text-white"
                }`}
                aria-label={`Switch to ${tab.label} view`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          {/* Header with Tag */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#07312CF2]">
              {currentContent.label === "Teacher" ? "Teacher" : "Student"}
            </h3>
          </div>

          {/* Features - Two rows with two columns each - Show only first feature, alternating between teacher/student */}
          <div className="bg-gray-50 rounded-xl p-6 md:p-8 lg:p-10">
            {(() => {
              // Get the first feature from current tab
              const feature = currentContent.features[0];
              // Alternate layout: teacher = image left, student = image right
              const isImageLeft = activeTab === "teacher";

              return (
                <>
                  {/* Row 1: Image and Text */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-10 items-center mb-8 md:mb-10">
                    {/* Image Column */}
                    <div className={`${isImageLeft ? "md:order-1" : "md:order-2"} order-2 relative w-full h-[200px] md:h-[250px] lg:h-[270px] rounded-lg overflow-hidden bg-white shadow-md`}>
                      <Image
                        src={activeTab === "teacher" ? "/Vidya Labs - AI Lesson Plan.png" : "/Vidya Labs - Student Achievements.png"}
                        alt={activeTab === "teacher" ? "AI Lesson Plan" : "Student Achievements"}
                        fill
                        className="object-contain "
                        priority
                      />
                    </div>

                    {/* Text Column */}
                    <div className={`${isImageLeft ? "md:order-2" : "md:order-1"} order-1`}>
                      <h4 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#07312CF2] mb-3">
                        {feature.title}
                      </h4>
                      <p className="text-base sm:text-lg text-gray-600 mb-4">
                        {feature.description}
                      </p>
                    </div>
                  </div>

                  {/* Row 2: Text and Image (reversed) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-10 items-center">
                    {/* Text Column */}
                    <div className={`${isImageLeft ? "md:order-1" : "md:order-2"} order-1`}>
                      <div className="space-y-4">
                        {feature.points.map((point, pointIdx) => {
                          // Every even index (0, 2, 4...) is a feature name (bold)
                          // Every odd index (1, 3, 5...) is a description
                          const isFeatureName = pointIdx % 2 === 0;
                          return isFeatureName ? (
                            <div key={pointIdx} className="space-y-1">
                              <div className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-[#ff5b29] mt-0.5 flex-shrink-0" />
                                <h5 className="text-base sm:text-lg font-semibold text-[#07312CF2]">
                                  {point}
                                </h5>
                              </div>
                              {feature.points[pointIdx + 1] && (
                                <p className="text-sm sm:text-base text-gray-600 ml-7">
                                  {feature.points[pointIdx + 1]}
                                </p>
                              )}
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>

                    {/* Image Column */}
                    <div className={`${isImageLeft ? "md:order-2" : "md:order-1"} order-2 relative w-full h-[200px] md:h-[250px] lg:h-[280px] rounded-lg overflow-hidden bg-white shadow-md`}>
                      <Image
                        src={activeTab === "teacher" ? "/Vidya Labs - Content Creation.png" : "/Vidya Labs - Student Dashboard.png"}
                        alt={activeTab === "teacher" ? "Content Creation" : "Student Dashboard"}
                        fill
                        className="object-contain "
                        priority
                      />
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </section>
  );
}
