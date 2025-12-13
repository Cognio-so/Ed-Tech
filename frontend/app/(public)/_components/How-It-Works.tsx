"use client";

import React from "react";

type Step = {
  number: string;
  title: string;
  desc: string;
};

const STEPS: Step[] = [
  {
    number: "1",
    title: "Teachers Upload Content",
    desc: "Upload your syllabus or choose NCERT-aligned material. AI instantly generates worksheets, assessments, and lesson plans.",
  },
  {
    number: "2",
    title: "Students Learn Adaptively",
    desc: "Each child gets a personalized learning path. Swarika, our AI tutor, explains concepts in their language, at their pace.",
  },
  {
    number: "3",
    title: "Teachers Get Insights",
    desc: "Real-time dashboards show exactly who's struggling with what so you can intervene before anyone falls behind.",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-[#FFFBF8] text-[#07312CF2] py-20">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-sm font-medium tracking-widest text-[#FF6B2C]">
            THE VIDYALABS WAY
          </span>

          <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-extrabold leading-tight">
            An AI-First Platform Built to{" "}
            <span className="text-[#FF6B2C] italic">
              Level the Playing Field
            </span>
          </h2>

          <p className="mt-6 text-base sm:text-lg text-gray-600">
            Unlike traditional LMS platforms that digitize the old way of
            teaching, VidyaLabs reimagines education from the ground up putting
            AI at the center of every interaction.
          </p>
        </div>

        {/* Steps */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-10 items-start">
          {STEPS.map((s, idx) => (
            <div
              key={s.number}
              className="relative flex flex-col items-center text-center px-4"
            >
              {idx !== 0 && (
                <div
                  aria-hidden
                  className="hidden lg:block absolute left-[-10%] top-8 w-[40%] h-px"
                >
                  <div className="w-full h-px bg-gradient-to-r from-[#FF6B2C]/60 to-transparent" />
                </div>
              )}

              {idx !== STEPS.length - 1 && (
                <div
                  aria-hidden
                  className="hidden lg:block absolute right-[-10%] top-8 w-[40%] h-px"
                >
                  <div className="w-full h-px bg-gradient-to-l from-[#FF6B2C]/60 to-transparent" />
                </div>
              )}

              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#FF6B2C] text-white font-semibold text-lg shadow-[0_10px_30px_rgba(255,107,44,0.12)] -mt-6">
                {s.number}
              </div>

              <h3 className="mt-6 text-base sm:text-lg font-semibold text-[#07312CF2]">
                {s.title}
              </h3>

              <p className="mt-3 text-sm sm:text-base text-gray-600 max-w-[360px]">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
