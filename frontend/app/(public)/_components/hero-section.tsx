"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function Hero() {
  return (
    <div className="min-h-screen w-full bg-white relative overflow-hidden">
      {/* Morning Haze Background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 100%, rgba(253, 224, 71, 0.4) 0%, transparent 60%),
            radial-gradient(circle at 50% 100%, rgba(251, 191, 36, 0.4) 0%, transparent 70%),
            radial-gradient(circle at 50% 100%, rgba(244, 114, 182, 0.5) 0%, transparent 80%)
          `,
        }}
      />

      {/* Actual Hero Section (Everything stays SAME) */}
      <section className="relative w-full min-h-screen flex items-center justify-center py-6 sm:py-10 lg:py-14 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 xl:gap-20 items-center">
          {/* LEFT SIDE TEXT */}
          <div className="text-center lg:text-left">
            <Badge className="inline-block px-3 sm:px-4 py-1 sm:py-2 bg-[#FFE7D6] text-[#ff5b29] text-xs sm:text-sm font-medium border-0">
              A CSR Initiative by <Link href="https://cognio.so" target="_blank" className="text-[#07312CF2] underline animate-pulse">CognioLabs</Link>
            </Badge>

            <h1 className="mt-4 sm:mt-6 text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-extrabold leading-tight text-[#07312CF2] max-w-xl">
              <span className="whitespace-nowrap">Give Every Student</span>
              <br className="hidden sm:block" />
              <span className="text-[#ff5b29] italic">a Personal Tutor</span>
              <br />
              That Never Sleeps
            </h1>

            <p className="mt-4 sm:mt-6 text-base sm:text-lg text-gray-600 max-w-xl mx-auto lg:mx-0">
              VidyaLabs is an AI-powered teaching platform that gives every student
              a patient, multilingual tutor and gives every teacher 10+ hours back
              each week. Built for Indian classrooms. Designed for the children who
              need it most.
            </p>

            {/* CTA BUTTONS */}
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-center lg:justify-start gap-3 sm:gap-4">
              <Button className="bg-[#ff5b29] hover:bg-[#ff4a18] text-white px-4 sm:px-6 py-3 sm:py-4 lg:py-6 xl:py-8 rounded-full text-sm sm:text-base lg:text-lg shadow-md w-full sm:w-auto">
                Apply For NGO&apos;s Access
              </Button>

              <Button
                variant="outline"
                className="text-primary px-4 sm:px-6 py-3 sm:py-4 lg:py-6 xl:py-8 rounded-full text-sm sm:text-base lg:text-lg w-full sm:w-auto"
              >
                Contact Us
              </Button>
            </div>
          </div>

          {/* RIGHT SIDE IMAGE */}
          <div className="relative flex justify-center mt-8 lg:mt-0">
            <div className="relative w-full max-w-[280px] h-[180px] sm:max-w-[360px] sm:h-[230px] md:max-w-[420px] md:h-[270px] lg:max-w-[480px] lg:h-[310px] xl:max-w-[520px] xl:h-[340px] bg-white rounded-2xl sm:rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] sm:shadow-[0_20px_60px_rgba(0,0,0,0.1)] overflow-hidden">
              <Image
                src="/hero-illustration.png"
                alt="VidyaLabs Dashboard"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
