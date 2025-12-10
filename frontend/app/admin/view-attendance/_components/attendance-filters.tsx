"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttendanceFiltersProps {
  grades: Array<{ id: string; name: string }>;
  initialDate: Date;
  initialGradeId: string;
}

export function AttendanceFilters({ grades, initialDate, initialGradeId }: AttendanceFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date>(initialDate);
  const [selectedGradeId, setSelectedGradeId] = React.useState<string>(initialGradeId);

  // Sync with URL params when they change
  React.useEffect(() => {
    const urlDate = searchParams.get("date");
    const urlGradeId = searchParams.get("gradeId") || "all";
    
    if (urlDate) {
      const date = new Date(urlDate);
      if (!isNaN(date.getTime())) {
        setSelectedDate(date);
      }
    }
    setSelectedGradeId(urlGradeId);
  }, [searchParams]);

  const updateFilters = React.useCallback((date: Date, gradeId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", format(date, "yyyy-MM-dd"));
    if (gradeId && gradeId !== "all") {
      params.set("gradeId", gradeId);
    } else {
      params.delete("gradeId");
    }
    router.push(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filter Attendance</CardTitle>
        <CardDescription>Select a date and grade to view attendance records</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full sm:w-[280px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setCalendarOpen(false);
                    updateFilters(date, selectedGradeId);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Select
            value={selectedGradeId}
            onValueChange={(value) => {
              setSelectedGradeId(value);
              updateFilters(selectedDate, value);
            }}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select Grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {grades.map((grade) => (
                <SelectItem key={grade.id} value={grade.id}>
                  {grade.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

