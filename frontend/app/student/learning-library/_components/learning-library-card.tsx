"use client";

import * as React from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

export interface LearningLibraryCardProps {
  id: string;
  title: string;
  imageUrl?: string;
  imageAlt?: string;
  contentType: string;
  grade?: string | null;
  subject?: string | null;
  topic?: string | null;
  date?: Date | string;
  onStartLearning: () => void;
  className?: string;
  hasSubmission?: boolean;
}

export function LearningLibraryCard({
  id,
  title,
  imageUrl,
  imageAlt,
  contentType,
  grade,
  subject,
  topic,
  date,
  onStartLearning,
  className,
  hasSubmission = false,
}: LearningLibraryCardProps) {
  const formatDate = (date?: Date | string) => {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getTypeLabel = () => {
    const typeMap: Record<string, string> = {
      assessment: "Assessment",
      lesson_plan: "Lesson Plan",
      presentation: "Presentation",
      quiz: "Quiz",
      worksheet: "Worksheet",
      slide: "Slide",
      image: "Image",
      video: "Video",
      comic: "Comic",
      web: "Web",
    };
    return typeMap[contentType] || "Content";
  };

  return (
    <Card
      className={cn(
        "overflow-hidden flex flex-col w-full p-0 gap-0 bg-card border-border",
        className
      )}
    >
      {/* Image section */}
      <div className="relative w-full aspect-video bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt || title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <div className="text-center p-4">
              <p className="text-sm font-medium text-muted-foreground">
                {title}
              </p>
            </div>
          </div>
        )}
        {/* Type badge overlay */}
        <div className="absolute top-2 left-2">
          <Badge
            variant="secondary"
            className="bg-black/80 text-white border-0"
          >
            {getTypeLabel()}
          </Badge>
        </div>
      </div>

      {/* Content section */}
      <CardHeader className="flex-1 px-6 pt-4 bg-card">
        <h3 className="font-semibold text-lg leading-tight line-clamp-2 text-foreground">
          {title}
        </h3>
        <div className="space-y-1 text-sm text-muted-foreground mt-2">
          {topic && (
            <div>
              <span className="font-medium">Topic:</span> {topic}
            </div>
          )}
          {subject && (
            <div>
              <span className="font-medium">Subject:</span> {subject}
            </div>
          )}
          {grade && (
            <div>
              <span className="font-medium">Grade:</span> {grade}
            </div>
          )}
          {date && (
            <div>
              <span className="font-medium">Date:</span> {formatDate(date)}
            </div>
          )}
        </div>
      </CardHeader>

      {/* Start Learning / View Results / View Preview button */}
      <div className="px-6 pb-6 mt-4">
        <Button
          variant="default"
          size="lg"
          className="w-full"
          onClick={onStartLearning}
        >
          {hasSubmission ? (
            <>
              <Eye className="h-4 w-4 mr-2" />
              {contentType === "assessment" || contentType === "quiz" ? "View Results" : "View Preview"}
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Start Learning
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

