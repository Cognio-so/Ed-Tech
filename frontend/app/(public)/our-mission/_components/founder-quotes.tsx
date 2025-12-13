"use client";

import Image from "next/image";

export default function FounderQuotesSection() {
  return (
    <section className="w-full bg-[#e6e4f8] py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Quote Card 1 */}
          <div className="relative bg-white rounded-3xl p-10 shadow-xl">
            {/* Quote mark */}
            <span className="absolute top-6 left-6 text-4xl text-[#f8c7c0] font-serif">
              “
            </span>

            {/* Text */}
            <p className="font-serif text-lg leading-relaxed text-[#0f172a]">
              VidyaLabs is not just an edtech platform — it is a scalable,
              equitable, and future-ready model for bridging India's learning
              divide. A pathway to ensure that every child, regardless of
              background, can learn, grow, and thrive.
            </p>

            {/* Divider */}
            <div className="my-8 h-px w-full bg-[#d9d6ff]" />

            {/* Author */}
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full overflow-hidden">
                <Image
                  src="/Ashu professional pic.png"
                  alt="Ashutosh Upadhyay"
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="font-medium text-[#0f172a]">
                  Ashutosh Upadhyay
                </p>
                <p className="text-sm text-[#64748b]">
                  Founder, Cognio Labs
                </p>
              </div>
            </div>
          </div>

          {/* Quote Card 2 */}
          <div className="relative bg-white rounded-3xl p-10 shadow-xl">
            {/* Quote mark */}
            <span className="absolute top-6 left-6 text-4xl text-[#f8c7c0] font-serif">
              “
            </span>

            {/* Text */}
            <p className="font-serif text-lg leading-relaxed text-[#0f172a]">
              True CSR isn't about writing cheques — it's about building
              solutions that outlive us. VidyaLabs is our commitment to creating
              lasting change, one student at a time, powered by technology that
              serves humanity first.
            </p>

            {/* Divider */}
            <div className="my-8 h-px w-full bg-[#d9d6ff]" />

            {/* Author */}
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full overflow-hidden">
                <Image
                  src="/palack.png"
                  alt="Palack Jain"
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="font-medium text-[#0f172a]">
                  Palack Jain
                </p>
                <p className="text-sm text-[#64748b]">
                  Founder, AlgoHype
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
