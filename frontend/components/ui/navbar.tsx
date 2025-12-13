"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
  import { LogInIcon, Menu } from "lucide-react";
import {  buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="w-full border-b border-gray-200 bg-white sticky top-0 z-50">
      <nav className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-3 sm:px-4 lg:px-6">
        {/* Left - Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <Image
            src="/logo.png"
            alt="VidyaLabs Logo"
            width={32}
            height={32}
            className="h-7 w-7 sm:h-8 sm:w-8 object-contain"
          />
          <span className="text-xl sm:text-2xl font-bold text-[#07312CF2] whitespace-nowrap">
            Vidya<span className="text-[#ff5b29]">Labs</span>
          </span>
        </Link>

        {/* Center - Desktop Menu */}
        <div className="hidden md:flex items-center gap-6 lg:gap-10 text-sm font-medium">
          <Link
            href="#features"
            className="text-gray-700 hover:text-[#ff5b29] transition-colors whitespace-nowrap"
          >
            Features
          </Link>
          <Link
            href="#ai-tutor"
            className="text-gray-700 hover:text-[#ff5b29] transition-colors whitespace-nowrap"
          >
            AI-Tutor
          </Link>
          <Link
            href="/our-mission"
            className="text-gray-700 hover:text-[#ff5b29] transition-colors whitespace-nowrap"
          >
            Our Mission
          </Link>
          <Link
            href="#impact-stories"
            className="text-gray-700 hover:text-[#ff5b29] transition-colors whitespace-nowrap"
          >
            Impact Stories
          </Link>
        </div>

        {/* Right - CTA */}
        <div className="hidden md:flex items-center">
          <Link
            href="/login"
            className={buttonVariants({
              variant: "default",
              className:
                "whitespace-nowrap bg-[#ff5b29] hover:bg-[#ff4a18] text-white",
            })}
          >
            <LogInIcon className="size-4 mr-2" />
            Login
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild aria-label="Open navigation menu">
              <button className="p-2 hover:bg-[#FFE7D6] rounded-md transition-colors text-gray-700">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>

            <SheetContent
              side="right"
              className="w-[280px] sm:w-[320px] bg-white"
            >
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SheetDescription className="sr-only">
                Main navigation menu with links to features, AI-Tutor, mission,
                impact stories, and login
              </SheetDescription>

              <div className="mt-8 flex flex-col gap-4">
                <Link
                  href="#features"
                  onClick={() => setOpen(false)}
                  className="text-lg font-medium text-gray-700 hover:text-[#ff5b29] transition-colors py-2 px-4 rounded-md hover:bg-[#FFE7D6]"
                >
                  Features
                </Link>

                <Link
                  href="#ai-tutor"
                  onClick={() => setOpen(false)}
                  className="text-lg font-medium text-gray-700 hover:text-[#ff5b29] transition-colors py-2 px-4 rounded-md hover:bg-[#FFE7D6]"
                >
                  AI-Tutor
                </Link>

                <Link
                  href="#mission"
                  onClick={() => setOpen(false)}
                  className="text-lg font-medium text-gray-700 hover:text-[#ff5b29] transition-colors py-2 px-4 rounded-md hover:bg-[#FFE7D6]"
                >
                  Our Mission
                </Link>

                <Link
                  href="#impact-stories"
                  onClick={() => setOpen(false)}
                  className="text-lg font-medium text-gray-700 hover:text-[#ff5b29] transition-colors py-2 px-4 rounded-md hover:bg-[#FFE7D6]"
                >
                  Impact Stories
                </Link>

                <div className="pt-4 mt-4 ">
                  <Link
                    href="/login"
                    className={buttonVariants({
                      variant: "default",
                      className:
                        "justify-center w-full bg-[#ff5b29] hover:bg-[#ff4a18] text-white",
                    })}
                    onClick={() => setOpen(false)}
                  >
                    <LogInIcon className="size-4 mr-2" />
                    Login
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
