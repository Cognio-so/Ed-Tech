"use client";

import { GraduationCap, BadgeCheck, Users } from "lucide-react";

export default function OurCommitmentSection() {
  return (
    <section className="w-full bg-white py-24">
      <div className="max-w-7xl mx-auto px-6 text-center">
        {/* Pill */}
        <div className="mb-6">
          <span className="inline-block rounded-full bg-[#ffb7a5] px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
            Our Commitment
          </span>
        </div>

        {/* Heading */}
        <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#0f172a] mb-16">
          Education Should Be a Right, Not a Privilege
        </h2>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Card 1 */}
          <div className="rounded-3xl bg-white p-10 shadow-xl">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ffd6d6]">
              <GraduationCap className="h-6 w-6 text-[#ff7a7a]" />
            </div>

            <h3 className="font-serif text-xl text-[#0f172a] mb-4">
              Free for Government Institutions
            </h3>

            <p className="text-sm text-[#64748b] leading-relaxed">
              We partner with government schools to bring VidyaLabs to public
              education — at no cost.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-3xl bg-white p-10 shadow-xl">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ffe2b8]">
              <BadgeCheck className="h-6 w-6 text-[#f59e0b]" />
            </div>

            <h3 className="font-serif text-xl text-[#0f172a] mb-4">
              Free for NGO Partners
            </h3>

            <p className="text-sm text-[#64748b] leading-relaxed">
              Any NGO working with underprivileged students can access VidyaLabs
              completely free.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-3xl bg-white p-10 shadow-xl">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e0f2fe]">
              <Users className="h-6 w-6 text-[#0ea5e9]" />
            </div>

            <h3 className="font-serif text-xl text-[#0f172a] mb-4">
              Co-Created with Partners
            </h3>

            <p className="text-sm text-[#64748b] leading-relaxed">
              We build alongside the institutions that know their students best.
              VidyaLabs evolves through collaboration.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
