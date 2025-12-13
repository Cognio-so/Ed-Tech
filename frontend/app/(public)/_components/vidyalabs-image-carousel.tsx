"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

const VIDYALABS_IMAGES = [
  "/Vidya Labs - AI Lesson Plan.png",
  "/Vidya Labs - Content Creation.png",
  "/Vidya Labs - Student Achievements.png",
  "/Vidya Labs - Student Dashboard.png",
];

export default function VidyaLabsImageCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % VIDYALABS_IMAGES.length);
    }, 3000); // Change image every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl sm:rounded-3xl">
      {VIDYALABS_IMAGES.map((imageSrc, index) => (
        <div
          key={imageSrc}
          className={`absolute inset-0 transition-opacity duration-500 ${
            index === currentIndex ? "opacity-100" : "opacity-0"
          }`}
        >
         <div className="absolute inset-0 p-4 sm:p-5 md:p-6">
  <Image
    src={imageSrc}
    alt={`VidyaLabs Feature ${index + 1}`}
    fill
    className="object-contain bg-white rounded-2xl"
    priority={index === 0}
  />
</div>


        </div>
      ))}
    </div>
  );
}
