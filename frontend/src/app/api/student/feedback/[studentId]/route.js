import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";

export async function GET(request, { params }) {
  try {
    const { studentId } = await params; // FIXED: Add await here
    
    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Student ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    
    const student = await db.collection('user').findOne(
      { _id: new ObjectId(studentId) },
      { projection: { feedback: 1 } }
    );

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const activeFeedback = (student.feedback || []).filter(fb => fb.isActive);

    return NextResponse.json({
      success: true,
      feedback: activeFeedback
    });
  } catch (error) {
    console.error("Error fetching student feedback:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}
