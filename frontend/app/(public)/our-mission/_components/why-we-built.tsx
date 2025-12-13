"use client";

import Image from "next/image";

export default function WhyWeBuiltThisSection() {
  return (
    <section className="relative w-full bg-[#eaf6f1] overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        
        {/* LEFT SIDE – Image */}
        <div className="flex justify-center lg:justify-start">
          <div className="relative h-[320px] w-[320px] sm:h-[380px] sm:w-[380px] rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white/70">
            <Image
              src="/ashu-teach.png" // place image in /public
              alt="Why we built VidyaLabs"
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>

        {/* RIGHT SIDE – Content */}
        <div>
          {/* Pill */}
          <div className="mb-6">
            <span className="inline-block rounded-full bg-[#ffb7a5] px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
              Why we built this
            </span>
          </div>

          {/* Heading */}
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#0f172a] leading-tight mb-8">
            Brilliance Held Back by Access, Not Ability
          </h2>

          {/* Paragraphs */}
          <div className="space-y-6 text-[#475569] text-base leading-relaxed max-w-xl">
            <p>
              For years, we watched educational inequality unfold through our
              partnership with{" "}
              <span className="font-medium text-[#334155]">
                Jhuggi Jhopri Shiksha Seva Sanstha
              </span>
              , an NGO that has spent over a decade serving underserved learners.
            </p>

            <p>
              We saw brilliant children held back not by ability, but by access.
              The same spark of curiosity, the same hunger to learn but without
              the resources to nurture it.
            </p>

            {/* Highlight Box */}
            <div className="relative bg-[#f3efe7] p-6 rounded-xl border-l-4 border-[#ff9b9b] text-[#1f2937] font-medium">
              At Cognio Labs, we build cutting edge AI systems for businesses
              around the world. But technology without purpose felt incomplete.
            </div>

            <p>
              So we asked ourselves:{" "}
              <span className="font-semibold text-[#334155]">
                What if we could give every child a tutor?
              </span>
              <br />
              What if the same AI we build for enterprises could serve the
              children who need it most?
            </p>

            <p className="italic text-[#334155] font-medium">
              VidyaLabs is our answer.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
