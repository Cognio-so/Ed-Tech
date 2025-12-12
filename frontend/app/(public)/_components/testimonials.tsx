"use client";

import React from "react";

type Testimonial = {
  quote: string;
  badge: string;
  name: string;
  title: string;
  initials: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "For the first time, I can see exactly which students need help with which concepts. The AI-generated worksheets save me hours every week—and they’re actually aligned with what I’m teaching.",
    badge: "Saves 8+ hours weekly",
    name: "Ritu Sharma",
    title: "Science Teacher, Govt. School, Delhi",
    initials: "RS",
  },
  {
    quote:
      "Swarika has been a game-changer for our students. Children who were too shy to ask questions in class now learn confidently—because an AI doesn't judge them.",
    badge: "30% improvement in test scores",
    name: "Anil Kumar",
    title: "Principal, JJSSS Partner School",
    initials: "AK",
  },
  {
    quote:
      "Other platforms are complicated and built for Western schools. VidyaLabs understands Indian education—the NCERT syllabus, the languages, the challenges we face.",
    badge: "Adopted across 3 campuses",
    name: "Priya Menon",
    title: "Academic Director, Private School Group",
    initials: "PM",
  },
];

export default function Testimonials() {
  return (
    <section className="bg-[#FFFBF8] py-16">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-xs tracking-widest text-[#FF6B2C] font-medium">
            IMPACT STORIES
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-4xl font-extrabold text-[#07312CF2]">
            What Educators Are Saying
          </h2>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t) => (
            <blockquote
              key={t.name}
              className="bg-white rounded-2xl p-6 md:p-8 shadow-[0_20px_40px_rgba(16,24,40,0.06)] border border-white"
              aria-label={`Testimonial from ${t.name}`}
            >
              <div className="text-gray-700/90 text-base leading-relaxed">
                <span className="text-3xl text-[#F6AFA0] mr-2 align-top">
                  “
                </span>
                <p className="inline">{t.quote}</p>
              </div>

              <div className="mt-6">
                <span className="inline-block bg-[#E9F6EE] text-[#0F9D58] text-xs font-medium px-3 py-1 rounded-full">
                  {t.badge}
                </span>
              </div>

              <footer className="mt-6 flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white"
                  style={{
                    background: "linear-gradient(180deg,#FF7A2E,#FF502A)",
                  }}
                  aria-hidden
                >
                  {t.initials}
                </div>

                <div>
                  <div className="text-sm font-semibold text-[#07312CF2]">
                    {t.name}
                  </div>
                  <div className="text-xs text-gray-500">{t.title}</div>
                </div>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
