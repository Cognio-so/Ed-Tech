"use server";

import { requireAdmin } from "@/data/get-admin";
import { getAttendanceByDate } from "@/data/get-attendance";

export async function getAttendanceForAdmin(date: string, gradeId?: string) {
  await requireAdmin();
  
  try {
    const attendance = await getAttendanceByDate(date, gradeId);
    return { success: true, data: attendance };
  } catch (error: any) {
    console.error("Error fetching attendance:", error);
    return { success: false, data: [], error: error.message };
  }
}

