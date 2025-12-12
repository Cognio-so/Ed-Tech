"use client";

import React from "react";
import { GraduationCap, Users, Languages } from "lucide-react";

type Card = {
  icon: React.ReactNode;
  title: string;
  desc: string;
  stat: string;
};

const CARDS: Card[] = [
  {
    icon: <GraduationCap className="w-6 h-6 text-primary" />,
    title: "The Tutoring Gap",
    desc: "70% of families cannot afford private tutoring—the very advantage that gives other students a massive head start in board exams and competitive tests.",
    stat: "70%",
  },
  {
    icon: <Users className="w-6 h-6 text-primary" />,
    title: "Overwhelmed Teachers",
    desc: "Teachers managing 40+ students have no way to identify individual weaknesses or provide personalized attention to each child.",
    stat: "1:40",
  },
  {
    icon: <Languages className="w-6 h-6 text-primary" />,
    title: "Language Barriers",
    desc: "Most EdTech platforms only work in English. Children in rural areas struggle with content that doesn't speak their mother tongue.",
    stat: "22+",
  },
];

export default function RealitySection() {
  return (
    <section className="bg-[#FFFBF8] text-[#07312CF2] py-20">
      <div className="max-w-7xl mx-auto px-6">
        {/* header */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="block text-sm tracking-wider text-[#FF6B2C] font-medium">
            THE REALITY
          </span>

          <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-extrabold leading-tight">
            120 Million Children in India Can't
            <br />
            Access Personal Tutoring
          </h2>

          <p className="mt-6 text-sm sm:text-base text-gray-600">
            While wealthier students get mentors, coaches, and tutors—most
            children rely solely on overcrowded classrooms and textbooks.
          </p>
        </div>

        {/* cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {CARDS.map((c, idx) => (
            <article
              key={c.title}
              className="relative bg-white rounded-2xl border border-white shadow-sm p-6 md:p-8 min-h-[250px] flex flex-col justify-between transition-all duration-300 hover:shadow-[0_10px_40px_rgba(255,107,44,0.15)] hover:shadow-primary/20 group"
            >
              {/* Gradient shadow overlay on hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

              {/* icon + title + desc */}
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#FFF0EB] group-hover:bg-primary/10 transition-colors duration-300">
                  {c.icon}
                </div>

                <h3 className="mt-6 text-lg font-semibold text-[#07312CF2]">
                  {c.title}
                </h3>

                <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                  {c.desc}
                </p>
              </div>

              {/* stat */}
              <div className="mt-6 relative z-10">
                <span className="text-2xl sm:text-3xl font-extrabold text-[#FF6B2C]">
                  {c.stat}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
