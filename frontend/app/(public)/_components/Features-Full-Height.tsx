"use client";

import { Check } from "lucide-react";
import { useState, useEffect } from "react";

type FeatureItem = {
  title: string;
  description: string;
  points: string[];
  outcome: string;
};

type TabContent = {
  id: "teacher" | "student";
  label: string;
  tag: string;
  features: FeatureItem[];
};

const TAB_CONTENT: TabContent[] = [
  {
    id: "teacher",
    label: "Teacher",
    tag: "For Educators",
    features: [
      {
        title: "AI-Powered Content Creation",
        description:
          "Create high-quality academic material in minutes, not hours.",
        points: [
          "Auto-generate worksheets, quizzes, assessments, and exams",
          "Lesson plans aligned to NCERT, CBSE, ICSE, IB, or any custom curriculum",
          "One-click PowerPoints and visual learning aids",
          "Comics and story-based explanations for complex or abstract topics",
          "Content grounded in your actual textbooks and syllabus",
          "Ready-to-share parent reports and academic summaries",
        ],
        outcome: "Outcome: Less preparation time, more teaching impact.",
      },
      {
        title: "Real-Time Classroom & Student Analytics",
        description: "See exactly what's happening in your classroom—instantly.",
        points: [
          "Individual student progress dashboards",
          "Concept-level weakness detection (not just scores)",
          "Automated alerts for at-risk or falling-behind students",
          "Class-wide performance heatmaps",
          "Data-driven insights to plan targeted interventions",
        ],
        outcome: "Outcome: No guesswork. Clear, actionable teaching decisions.",
      },
      {
        title: "Smart Assessment & Evaluation",
        description: "Assess learning with precision and fairness.",
        points: [
          "AI-assisted grading and evaluation",
          "Performance tracking across time, topics, and difficulty levels",
          "Objective insights into learning gaps—not just rote errors",
          "Exportable reports for schools and parents",
        ],
        outcome:
          "Outcome: Faster evaluation, deeper understanding of student needs.",
      },
      {
        title: "Teacher-First Design",
        description: "Built to support teachers, not overwhelm them.",
        points: [
          "Lightweight, intuitive interface",
          "Minimal setup and training required",
          "Works with existing teaching workflows",
          "Designed for real classrooms—not tech demos",
        ],
        outcome:
          "Outcome: Technology that adapts to teachers, not the other way around.",
      },
    ],
  },
  {
    id: "student",
    label: "Student",
    tag: "For Learners",
    features: [
      {
        title: "Cognitive Learning System",
        description: "Learning built on how the brain actually learns.",
        points: [
          "Socratic dialogue-based learning (guided questioning, not spoon-feeding)",
          "Spaced repetition for long-term retention",
          "Adaptive difficulty based on student responses",
          "Concept reinforcement instead of rote memorization",
        ],
        outcome: "Outcome: Strong foundations, not surface-level learning.",
      },
      {
        title: "Personalized Learning Paths",
        description:
          "Every student learns differently—so the platform adapts.",
        points: [
          "AI identifies individual strengths and weaknesses",
          "Tailored explanations based on understanding level",
          "Dynamic adjustment of pace and difficulty",
          "No two students get the exact same learning journey",
        ],
        outcome: "Outcome: Personalized tutoring at scale.",
      },
      {
        title: "Multi-Modal Learning Experience",
        description: "Learn in the format that works best.",
        points: [
          "Text-based explanations",
          "Visual aids and diagrams",
          "Audio explanations for better comprehension",
          "Interactive questions and feedback loops",
        ],
        outcome: "Outcome: Better understanding, higher engagement.",
      },
      {
        title: "Continuous Feedback & Progress Visibility",
        description: "Students always know where they stand.",
        points: [
          "Real-time feedback on answers",
          "Clear indicators of improvement and mastery",
          "Encouragement through progress milestones",
          "Reduced exam anxiety through continuous assessment",
        ],
        outcome: "Outcome: Confident learners who understand their progress.",
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
            A lightweight, powerful platform that works the way you work—not the
            other way around.
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
            <span className="inline-block px-3 py-1 bg-[#07312CF2] text-white text-xs sm:text-sm font-medium rounded-full">
              {currentContent.tag}
            </span>
          </div>

          {/* Features Grid - 2x2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
            {currentContent.features.map((feature, idx) => (
              <div
                key={idx}
                className={`${
                  idx < 2 ? "border-b border-gray-200 pb-6 md:pb-0 md:border-b-0" : "pb-6 md:pb-0"
                } ${
                  idx % 2 === 0 ? "md:border-r md:border-gray-200 md:pr-8" : "md:pl-8"
                }`}
              >
                <h4 className="text-xl sm:text-2xl font-bold text-[#07312CF2] mb-2">
                  {feature.title}
                </h4>
                <p className="text-base sm:text-lg text-gray-600 mb-4">
                  {feature.description}
                </p>

                <ul className="space-y-3 mb-4">
                  {feature.points.map((point, pointIdx) => (
                    <li
                      key={pointIdx}
                      className="flex items-start gap-3 text-sm sm:text-base text-gray-700"
                    >
                      <Check className="w-5 h-5 text-[#07312CF2] mt-0.5 flex-shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>

                <p className="text-sm sm:text-base font-medium text-[#07312CF2] mt-4">
                  {feature.outcome}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
