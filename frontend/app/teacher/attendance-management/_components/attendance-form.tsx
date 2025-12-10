"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, CheckCircle2, XCircle, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { markAttendance, getAttendance } from "../action";

interface Student {
  id: string;
  name: string;
  email: string;
  image: string | null;
  grade: {
    id: string;
    name: string;
  } | null;
}

interface AttendanceRecord {
  studentId: string;
  gradeId: string;
  status: "present" | "absent";
  notes?: string;
}

interface AttendanceFormProps {
  students: Student[];
  gradeId: string;
}

export function AttendanceForm({ students, gradeId }: AttendanceFormProps) {
  const [date, setDate] = useState<Date>(new Date());
  const [attendance, setAttendance] = useState<Record<string, "present" | "absent" | null>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Load existing attendance for the selected date
  useEffect(() => {
    const loadAttendance = async () => {
      if (!date) return;

      setLoading(true);
      try {
        const dateStr = format(date, "yyyy-MM-dd");
        const result = await getAttendance(dateStr, gradeId);
        
        if (result.success && result.data) {
          const attendanceMap: Record<string, "present" | "absent"> = {};
          
          result.data.forEach((record) => {
            attendanceMap[record.studentId] = record.status as "present" | "absent";
          });
          
          setAttendance(attendanceMap);
        }
      } catch (error) {
        console.error("Error loading attendance:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAttendance();
  }, [date, gradeId]);

  const handleStatusChange = (studentId: string, status: "present" | "absent") => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSave = async () => {
    if (!date) {
      toast.error("Please select a date");
      return;
    }

    const records: AttendanceRecord[] = students
      .filter((student) => attendance[student.id] !== null && attendance[student.id] !== undefined)
      .map((student) => ({
        studentId: student.id,
        gradeId: student.grade?.id || gradeId,
        status: attendance[student.id]!,
      }));

    if (records.length === 0) {
      toast.error("Please mark attendance for at least one student");
      return;
    }

    setSaving(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const result = await markAttendance(dateStr, records);

      if (result.success) {
        toast.success(`Attendance marked for ${result.count} student(s)`);
        // Reload attendance to show updated data
        const dateStr = format(date, "yyyy-MM-dd");
        const reloadResult = await getAttendance(dateStr, gradeId);
        if (reloadResult.success && reloadResult.data) {
          const attendanceMap: Record<string, "present" | "absent"> = {};
          reloadResult.data.forEach((record) => {
            attendanceMap[record.studentId] = record.status as "present" | "absent";
          });
          setAttendance(attendanceMap);
        }
      }
    } catch (error: any) {
      console.error("Error saving attendance:", error);
      toast.error(error.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(attendance).filter((s) => s === "present").length;
  const absentCount = Object.values(attendance).filter((s) => s === "absent").length;
  const unmarkedCount = students.length - presentCount - absentCount;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select Date</CardTitle>
          <CardDescription>Choose the date for marking attendance</CardDescription>
        </CardHeader>
        <CardContent>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(selectedDate) => {
                  if (selectedDate) {
                    setDate(selectedDate);
                    setCalendarOpen(false);
                  }
                }}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mark Attendance</CardTitle>
              <CardDescription>
                {format(date, "EEEE, MMMM d, yyyy")}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Present: {presentCount}
              </Badge>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                Absent: {absentCount}
              </Badge>
              {unmarkedCount > 0 && (
                <Badge variant="outline">
                  Unmarked: {unmarkedCount}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No students found in this grade.
            </div>
          ) : (
            <div className="space-y-3">
              {students.map((student) => {
                const status = attendance[student.id] || null;
                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={student.image || undefined} alt={student.name} />
                        <AvatarFallback>
                          {student.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{student.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{student.email}</p>
                      </div>
                      {student.grade && (
                        <Badge variant="secondary">{student.grade.name}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-6">
                      <Button
                        variant={status === "present" ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          status === "present" && "bg-green-600 hover:bg-green-700"
                        )}
                        onClick={() => handleStatusChange(student.id, "present")}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Present
                      </Button>
                      <Button
                        variant={status === "absent" ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          status === "absent" && "bg-red-600 hover:bg-red-700"
                        )}
                        onClick={() => handleStatusChange(student.id, "absent")}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Absent
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || loading || Object.keys(attendance).length === 0}
          size="lg"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Attendance
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

