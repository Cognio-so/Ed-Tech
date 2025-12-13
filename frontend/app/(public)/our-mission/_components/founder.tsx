"use client";

import Image from "next/image";
import Link from "next/link";

export default function FounderSection() {
  return (
    <section className="w-full bg-[#fbffb8] py-24">
      <div className="max-w-7xl mx-auto px-6 text-center">
        {/* Pill */}
        <div className="mb-6">
          <span className="inline-block rounded-full bg-[#ffb7a5] px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
            Founded by
          </span>
        </div>

        {/* Heading */}
        <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#0f172a] mb-16">
          The Team Behind VidyaLabs
        </h2>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 justify-center max-w-3xl mx-auto">
          {/* Card 1 */}
          <div className="bg-white rounded-3xl shadow-xl px-10 py-12">
            <div className="flex justify-center mb-6">
              <div className="h-24 w-24 rounded-full overflow-hidden ring-4 ring-white">
                <Image
                  src="/Ashu professional pic.png"
                  alt="Ashutosh Upadhyay"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <h3 className="font-serif text-xl text-[#0f172a]">
              Ashutosh Upadhyay
            </h3>
            <p className="mt-2 text-sm text-[#64748b]">
              Founder , Cognio Labs
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-3xl shadow-xl px-10 py-12">
            <div className="flex justify-center mb-6">
              <div className="h-24 w-24 rounded-full overflow-hidden ring-4 ring-white">
                <Image
                  src="/palack.png"
                  alt="Palack Jain"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <h3 className="font-serif text-xl text-[#0f172a]">
              Palack Jain
            </h3>
            <p className="mt-2 text-sm text-[#64748b]">
              Founder, AlgoHype
            </p>
          </div>
        </div>

        {/* Bottom Note */}
        <div className="mt-16 max-w-2xl mx-auto rounded-2xl bg-[#fff6c9] px-8 py-6 text-sm text-[#475569]">
          Built by{" "}
          <span className="font-semibold text-[#ff7a7a]">
           <Link href="https://cognio.so" target="_blank" className="underline">Cognio Labs</Link>
          </span>{" "}
          as our commitment to using the technology we develop in service of
          society at large.
        </div>
      </div>
    </section>
  );
} 
