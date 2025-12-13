"use client";

import Image from "next/image";

export default function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#eef1ff] via-[#eef7ff] to-[#e9f7f2]" />

      {/* Subtle Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20 lg:py-24 xl:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-8 sm:gap-10 md:gap-12 lg:gap-16">
          
          {/* LEFT – Image */}
          <div className="relative flex justify-center lg:justify-start order-2 lg:order-1">
            <div className="relative h-48 w-48 xs:h-56 xs:w-56 sm:h-64 sm:w-64 md:h-72 md:w-72 lg:h-80 lg:w-80 xl:h-96 xl:w-96 rounded-full overflow-hidden shadow-2xl ring-2 sm:ring-4 ring-white">
              <Image
                src="/guruji.jpg"
                alt="Acharya Sudarshan"
                fill
                className="object-cover"
                priority
                sizes="(max-width: 640px) 192px, (max-width: 768px) 224px, (max-width: 1024px) 256px, (max-width: 1280px) 320px, 384px"
              />
            </div>
          </div>

          {/* RIGHT – Text */}
          <div className="flex flex-col items-center text-center lg:items-center lg:text-center max-w-xl mx-auto order-1 lg:order-2">
            
            {/* Collaboration + Logo */}
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Image
                src="/science-divine-logo.png"
                alt="Science Divine"
                width={60}
                height={60}
                className="object-contain w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-[70px] lg:h-[70px]"
              />
              <p className="text-xs sm:text-sm md:text-base font-bold tracking-wide sm:tracking-widest uppercase text-gray-600 px-2 text-center sm:text-left">
                In collaboration with Science Divine
              </p>
            </div>

            {/* Main Heading */}
            <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-5xl font-semibold text-gray-900 leading-tight px-2">
              हर घर शिक्षा। हर घर ध्यान।
            </h1>

            {/* Accent Line */}
            <div className="mt-3 sm:mt-4 mb-4 sm:mb-6 h-[2px] sm:h-[3px] w-12 sm:w-16 rounded-full bg-orange-400" />

            {/* Subheading */}
            <p className="text-sm sm:text-base md:text-lg text-gray-600 px-4 sm:px-0 max-w-lg">
              Universal learning. Universal awareness. Universal opportunity.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
