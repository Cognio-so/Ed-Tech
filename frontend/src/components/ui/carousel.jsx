"use client";
import React, { useRef, useEffect, useState, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Carousel({ className, children, orientation = "horizontal", ...props }) {
  return (
    <div className={cn("relative overflow-hidden", className)} {...props}>
      {children}
    </div>
  );
}

// FORWARDED REF so external controllers can scroll
export const CarouselContent = forwardRef(function CarouselContent(
  { className, children },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex snap-x snap-mandatory overflow-x-auto scroll-smooth scrollbar-hide -ml-2 md:-ml-4",
        className
      )}
      style={{ scrollSnapType: "x mandatory" }}
    >
      {children}
    </div>
  );
});

export function CarouselItem({ className, children, basis = "basis-full" }) {
  return (
    <div
      className={cn(
        "pl-2 md:pl-4 snap-start shrink-0",
        basis,
        className
      )}
    >
      {children}
    </div>
  );
}

export function CarouselPrevious({ className, onClick, disabled }) {
  return (
    <button
      className={cn(
        "absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-background/90 backdrop-blur-sm border shadow-lg p-2 transition-all duration-200 hover:bg-background hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      aria-label="Previous slide"
      onClick={onClick}
      type="button"
      disabled={disabled}
    >
      <ChevronLeft className="h-4 w-4" />
    </button>
  );
}

export function CarouselNext({ className, onClick, disabled }) {
  return (
    <button
      className={cn(
        "absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-background/90 backdrop-blur-sm border shadow-lg p-2 transition-all duration-200 hover:bg-background hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      aria-label="Next slide"
      onClick={onClick}
      type="button"
      disabled={disabled}
    >
      <ChevronRight className="h-4 w-4" />
    </button>
  );
}

// Enhanced controller with better navigation and indicators
export function CarouselWithControls({ items = [], renderItem, className, showIndicators = true }) {
  const ref = useRef(null);
  const [index, setIndex] = useState(0);

  // Safety check for items
  if (!items || !Array.isArray(items)) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No items to display</p>
      </div>
    );
  }

  const scrollTo = (i) => {
    if (!ref.current || i < 0 || i >= items.length) return;
    const container = ref.current;
    const itemWidth = container.scrollWidth / items.length;
    container.scrollTo({
      left: i * itemWidth,
      behavior: "smooth"
    });
    setIndex(i);
  };

  const onPrev = () => {
    const newIndex = Math.max(0, index - 1);
    scrollTo(newIndex);
  };

  const onNext = () => {
    const newIndex = Math.min(items.length - 1, index + 1);
    scrollTo(newIndex);
  };

  // Handle scroll events to update current index
  useEffect(() => {
    const container = ref.current;
    if (!container || items.length === 0) return;

    const handleScroll = () => {
      const itemWidth = container.scrollWidth / items.length;
      const currentIndex = Math.round(container.scrollLeft / itemWidth);
      setIndex(currentIndex);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [items.length]);

  useEffect(() => {
    setIndex(0);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No items to display</p>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <Carousel className="w-full">
        <CarouselContent ref={ref} className="-ml-2 md:-ml-4">
          {items.map((item, i) => (
            <CarouselItem key={i} className="pl-2 md:pl-4 basis-full">
              {renderItem(item, i)}
            </CarouselItem>
          ))}
        </CarouselContent>
        
        {items.length > 1 && (
          <>
            <CarouselPrevious 
              onClick={onPrev} 
              disabled={index === 0}
            />
            <CarouselNext 
              onClick={onNext} 
              disabled={index === items.length - 1}
            />
          </>
        )}
      </Carousel>

      {/* Indicators */}
      {showIndicators && items.length > 1 && (
        <div className="flex justify-center mt-4 space-x-2">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-200",
                i === index 
                  ? "bg-primary w-6" 
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Counter */}
      {items.length > 1 && (
        <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium border shadow-sm">
          {index + 1} / {items.length}
        </div>
      )}
    </div>
  );
}
