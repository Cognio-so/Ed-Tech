"use server";

import { connectToDatabase } from "@/lib/db";
import { authClient } from "@/lib/auth-client";

// Mock student data - replace with actual database queries
const mockStudents = [
  {
    _id: "1",
    name: "Alice Johnson",
    email: "alice.johnson@school.edu",
    grade: "Grade 9",
    subject: "Mathematics",
    performance: {
      overall: 85,
      assignments: 88,
      quizzes: 82,
      participation: 90
    },
    attendance: 95,
    lastActive: "2024-01-15T10:30:00Z",
    group: "Group A",
    strengths: ["Problem Solving", "Critical Thinking"],
    weaknesses: ["Time Management"],
    notes: "Excellent student, needs help with time management"
  },
  {
    _id: "2",
    name: "Bob Smith",
    email: "bob.smith@school.edu",
    grade: "Grade 9",
    subject: "Mathematics",
    performance: {
      overall: 72,
      assignments: 75,
      quizzes: 68,
      participation: 80
    },
    attendance: 88,
    lastActive: "2024-01-14T14:20:00Z",
    group: "Group B",
    strengths: ["Collaboration"],
    weaknesses: ["Conceptual Understanding", "Test Anxiety"],
    notes: "Works well in groups, struggles with individual assessments"
  },
  {
    _id: "3",
    name: "Carol Davis",
    email: "carol.davis@school.edu",
    grade: "Grade 10",
    subject: "Science",
    performance: {
      overall: 92,
      assignments: 95,
      quizzes: 89,
      participation: 95
    },
    attendance: 98,
    lastActive: "2024-01-15T09:15:00Z",
    group: "Group A",
    strengths: ["Research Skills", "Presentation", "Leadership"],
    weaknesses: [],
    notes: "Top performer, can help mentor other students"
  },
  {
    _id: "4",
    name: "David Wilson",
    email: "david.wilson@school.edu",
    grade: "Grade 9",
    subject: "Mathematics",
    performance: {
      overall: 78,
      assignments: 80,
      quizzes: 75,
      participation: 85
    },
    attendance: 92,
    lastActive: "2024-01-13T16:45:00Z",
    group: "Group C",
    strengths: ["Creativity", "Communication"],
    weaknesses: ["Mathematical Concepts"],
    notes: "Creative thinker, needs more practice with core concepts"
  },
  {
    _id: "5",
    name: "Emma Brown",
    email: "emma.brown@school.edu",
    grade: "Grade 10",
    subject: "Science",
    performance: {
      overall: 88,
      assignments: 90,
      quizzes: 85,
      participation: 92
    },
    attendance: 96,
    lastActive: "2024-01-15T11:30:00Z",
    group: "Group B",
    strengths: ["Analytical Thinking", "Lab Work"],
    weaknesses: ["Written Communication"],
    notes: "Strong in practical work, needs improvement in written reports"
  },
  {
    _id: "6",
    name: "Frank Miller",
    email: "frank.miller@school.edu",
    grade: "Grade 9",
    subject: "Mathematics",
    performance: {
      overall: 65,
      assignments: 70,
      quizzes: 60,
      participation: 75
    },
    attendance: 85,
    lastActive: "2024-01-12T13:20:00Z",
    group: "Group C",
    strengths: ["Effort", "Persistence"],
    weaknesses: ["Mathematical Foundation", "Confidence"],
    notes: "Hard worker, needs additional support and confidence building"
  }
];

export async function getStudents() {
  try {
    // In a real application, you would fetch from database
    // const { db } = await connectToDatabase();
    // const students = await db.collection('students').find({}).toArray();
    
    return {
      success: true,
      students: mockStudents
    };
  } catch (error) {
    console.error("Error fetching students:", error);
    return {
      success: false,
      error: "Failed to fetch students"
    };
  }
}

export async function updateStudentGroup(studentId, newGroup) {
  try {
    // In a real application, you would update the database
    // const { db } = await connectToDatabase();
    // await db.collection('students').updateOne(
    //   { _id: studentId },
    //   { $set: { group: newGroup } }
    // );
    
    return {
      success: true,
      message: "Student group updated successfully"
    };
  } catch (error) {
    console.error("Error updating student group:", error);
    return {
      success: false,
      error: "Failed to update student group"
    };
  }
}

export async function updateStudentNotes(studentId, notes) {
  try {
    // In a real application, you would update the database
    // const { db } = await connectToDatabase();
    // await db.collection('students').updateOne(
    //   { _id: studentId },
    //   { $set: { notes: notes } }
    // );
    
    return {
      success: true,
      message: "Student notes updated successfully"
    };
  } catch (error) {
    console.error("Error updating student notes:", error);
    return {
      success: false,
      error: "Failed to update student notes"
    };
  }
}

export async function getClassStatistics() {
  try {
    const students = mockStudents;
    
    const stats = {
      totalStudents: students.length,
      averagePerformance: Math.round(students.reduce((sum, s) => sum + s.performance.overall, 0) / students.length),
      averageAttendance: Math.round(students.reduce((sum, s) => sum + s.attendance, 0) / students.length),
      gradeDistribution: students.reduce((acc, student) => {
        acc[student.grade] = (acc[student.grade] || 0) + 1;
        return acc;
      }, {}),
      groupDistribution: students.reduce((acc, student) => {
        acc[student.group] = (acc[student.group] || 0) + 1;
        return acc;
      }, {}),
      performanceRanges: {
        excellent: students.filter(s => s.performance.overall >= 90).length,
        good: students.filter(s => s.performance.overall >= 80 && s.performance.overall < 90).length,
        average: students.filter(s => s.performance.overall >= 70 && s.performance.overall < 80).length,
        needsImprovement: students.filter(s => s.performance.overall < 70).length
      }
    };
    
    return {
      success: true,
      statistics: stats
    };
  } catch (error) {
    console.error("Error fetching class statistics:", error);
    return {
      success: false,
      error: "Failed to fetch class statistics"
    };
  }
}