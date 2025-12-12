"use client";

import React from "react";
import Image from "next/image";
import { Mail, Facebook, Linkedin, Twitter } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-neutral-600 text-white pt-20 pb-10 px-6">
      <div className="max-w-7xl mx-auto">
        {/* TOP SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 pb-16 border-b border-white/20">
          {/* Logo + description */}
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Image
                src="/logo.png"
                alt="VidyaLabs Logo"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
              />
              <div className="text-2xl font-extrabold text-white">
                Vidya<span className="text-[#ff5b29]">Labs</span>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-white/80 max-w-xs">
              AI-powered personalized learning built for every student, teacher,
              and school in India.
            </p>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold mb-4">PLATFORM</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  className="text-white/80 hover:text-[#ff5b29] transition"
                  href="#"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  className="text-white/80 hover:text-[#ff5b29] transition"
                  href="#"
                >
                  Swarika AI Tutor
                </a>
              </li>
              <li>
                <a
                  className="text-white/80 hover:text-[#ff5b29] transition"
                  href="#"
                >
                  For Schools
                </a>
              </li>
              <li>
                <a
                  className="text-white/80 hover:text-[#ff5b29] transition"
                  href="#"
                >
                  For NGOs
                </a>
              </li>
            </ul>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white font-semibold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  className="text-white/80 hover:text-[#ff5b29] transition"
                  href="#"
                >
                  Blog
                </a>
              </li>
              <li>
                <a
                  className="text-white/80 hover:text-[#ff5b29] transition"
                  href="#"
                >
                  Case Studies
                </a>
              </li>
              <li>
                <a
                  className="text-white/80 hover:text-[#ff5b29] transition"
                  href="#"
                >
                  Teacher's Guide
                </a>
              </li>
              <li>
                <a
                  className="text-white/80 hover:text-[#ff5b29] transition"
                  href="#"
                >
                  Help Center
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  className="text-white/80 hover:text-[#ff5b29] transition"
                  href="#"
                >
                  About Us
                </a>
              </li>
              <li>
                <a
                  className="text-white/80 hover:text-[#ff5b29] transition"
                  href="#"
                >
                  Our Mission
                </a>
              </li>
              <li>
                <a
                  className="text-white/80 hover:text-[#ff5b29] transition"
                  href="#"
                >
                  JSSS Partnership
                </a>
              </li>
              <li>
                <a
                  className="text-white/80 hover:text-[#ff5b29] transition"
                  href="#"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* BOTTOM SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-center mt-8 text-xs text-white/60">
          <p>© {new Date().getFullYear()} VidyaLabs. All rights reserved.</p>

          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-[#ff5b29] transition">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-[#ff5b29] transition">
              Terms of Use
            </a>
            <a href="#" className="hover:text-[#ff5b29] transition">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
