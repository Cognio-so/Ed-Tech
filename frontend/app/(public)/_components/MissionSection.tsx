"use client";

import React from "react";

export default function MissionSection() {
  return (
    <section className="relative w-full bg-[#07312CF2] text-white py-24 md:py-32 overflow-hidden">
      {/* dotted grid background */}
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          background: "#07312CF2",
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1.5px, transparent 1.5px)`,
          backgroundSize: "34px 34px",
          backgroundPosition: "0 0",
        }}
      />

      {/* subtle overlay for stronger contrast */}
      <div className="absolute inset-0 z-10 bg-black/5" />

      {/* content */}
      <div className="relative z-20 max-w-4xl mx-auto px-6">
        <div className="text-center mx-auto max-w-7xl">
          <span className="text-xs tracking-widest text-[#ff5b29] font-medium">
            OUR MISSION
          </span>

          <h2 className="mt-4 text-4xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-center text-white">
            Education Transforms Lives
            <br />
            <span className="text-[#ff5b29] italic">
              But Only for Those Who Can Access It
            </span>
          </h2>

          <p className="mt-6 text-sm sm:text-base md:text-lg text-white/90 leading-relaxed">
            For millions of children, that access simply does not exist. In
            India, 1 in every 3 students comes from an underprivileged family.
            Research shows personalized tutoring can boost performance by up to
            40%—yet for most families, this remains a distant dream.
          </p>

          <p className="mt-5 text-sm sm:text-base md:text-lg text-white/90 leading-relaxed">
            VidyaLabs exists to break this cycle. We're building AI-powered,
            multilingual education that gives every child a tutor, a guide, and
            a chance—regardless of their family's income or where they live.
          </p>

          <div className="mt-8">
            <p className="text-[#FFE7D6] text-base md:text-lg font-medium italic">
              हर घर शिक्षा। हर घर घाना।
            </p>
            <p className="mt-2 text-[#FFE7D6] text-sm md:text-base italic">
              Education for every home. Opportunity for every child.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
