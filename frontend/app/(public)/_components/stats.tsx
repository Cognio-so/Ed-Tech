"use client";

import React from "react";

type Stat = {
  value: string;
  label: string;
};

const STATS: Stat[] = [
  { value: "10,000+", label: "Students Empowered" },
  { value: "500+", label: "Teachers Supported" },
  { value: "12+", label: "Regional Languages" },
  { value: "NCERT", label: "Curriculum Aligned" },
];

export default function Stats() {
  return (
    <section className="relative w-full py-16 overflow-hidden">
      {/* 🔵 Dotted Background Layer */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: "#07312CF2", // Deep navy
          backgroundImage: `
            radial-gradient(circle, rgba(255, 255, 255, 0.15) 1.5px, transparent 1.5px)
          `,
          backgroundSize: "32px 32px",
          backgroundPosition: "0 0",
        }}
      />

      {/* 🔸 Stats Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div
          className="
            grid
            grid-cols-1
            sm:grid-cols-2
            lg:grid-cols-4
            gap-y-10
            lg:gap-y-0
            text-center
          "
        >
          {STATS.map((s, idx) => (
            <div
              key={s.label}
              className={`
                relative
                flex flex-col items-center justify-center
                px-6 lg:px-8
                ${
                  idx !== STATS.length - 1
                    ? "lg:border-r lg:border-r-white/10"
                    : ""
                }
              `}
            >
              <p className="text-4xl font-extrabold text-[#FF6B2C]">
                {s.value}
              </p>

              <p className="mt-2 text-sm text-white/70 max-w-[12rem]">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
