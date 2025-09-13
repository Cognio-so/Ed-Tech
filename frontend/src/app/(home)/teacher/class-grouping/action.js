"use server";

import { connectToDatabase } from "@/lib/db";
import { getServerSession } from "@/lib/get-session";
import { ObjectId } from "mongodb";

// Helper function to calculate student performance from progress data
function calculateStudentPerformance(progressData) {
  if (!progressData || progressData.length === 0) {
    return {
      overall: 0,
      assignments: 0,
      quizzes: 0,
      participation: 0
    };
  }

  const completedWithScores = progressData.filter(p => 
    p.status === 'completed' && p.completionData?.score !== undefined
  );

  if (completedWithScores.length === 0) {
    return {
      overall: 0,
      assignments: 0,
      quizzes: 0,
      participation: 0
    };
  }

  const averageScore = Math.round(
    completedWithScores.reduce((sum, p) => sum + p.completionData.score, 0) / completedWithScores.length
  );

  // Calculate different performance metrics based on content type
  const assignments = progressData.filter(p => p.contentType === 'assessment');
  const quizzes = progressData.filter(p => p.contentType === 'lesson');
  const participation = progressData.filter(p => p.contentType === 'content');

  const assignmentScore = assignments.length > 0 ? 
    Math.round(assignments.reduce((sum, p) => sum + (p.completionData?.score || 0), 0) / assignments.length) : 0;
  
  const quizScore = quizzes.length > 0 ? 
    Math.round(quizzes.reduce((sum, p) => sum + (p.completionData?.score || 0), 0) / quizzes.length) : 0;
  
  const participationScore = participation.length > 0 ? 
    Math.round(participation.reduce((sum, p) => sum + (p.progress?.percentage || 0), 0) / participation.length) : 0;

  return {
    overall: averageScore,
    assignments: assignmentScore,
    quizzes: quizScore,
    participation: participationScore
  };
}

export async function getStudents() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    // Get all users with student role
    const students = await db.collection('user')
      .find({ role: 'student' })
      .toArray();

    // Get progress data for all students
    const studentIds = students.map(s => new ObjectId(s._id));
    const progressData = await db.collection('studentProgress')
      .find({ studentId: { $in: studentIds } })
      .toArray();

    // Group progress data by student
    const progressByStudent = {};
    progressData.forEach(progress => {
      const studentId = progress.studentId.toString();
      if (!progressByStudent[studentId]) {
        progressByStudent[studentId] = [];
      }
      progressByStudent[studentId].push(progress);
    });

    // Transform students data with calculated metrics
    const studentsWithMetrics = students.map(student => {
      const studentProgress = progressByStudent[student._id.toString()] || [];
      const performance = calculateStudentPerformance(studentProgress);

      return {
        _id: student._id.toString(),
        name: student.name || 'Unknown Student',
        email: student.email,
        grades: student.grades || [], // Keep as array
        subjects: student.subjects || [], // Keep as array
        performance,
        lastActive: student.lastLogin || student.createdAt,
        group: student.group || 'Group A', // Default group assignment
        notes: student.notes || ''
      };
    });

    return {
      success: true,
      students: studentsWithMetrics
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
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    // Update the student's group in the user collection
    await db.collection('user').updateOne(
      { _id: new ObjectId(studentId) },
      { $set: { group: newGroup, updatedAt: new Date() } }
    );
    
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
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    // Update the student's notes in the user collection
    await db.collection('user').updateOne(
      { _id: new ObjectId(studentId) },
      { $set: { notes: notes, updatedAt: new Date() } }
    );
    
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
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    // Get all students with their progress data
    const students = await db.collection('user')
      .find({ role: 'student' })
      .toArray();

    if (students.length === 0) {
      return {
        success: true,
        statistics: {
          totalStudents: 0,
          averagePerformance: 0,
          gradeDistribution: {},
          groupDistribution: {},
          performanceRanges: {
            excellent: 0,
            good: 0,
            average: 0,
            needsImprovement: 0
          }
        }
      };
    }

    // Get progress data for all students
    const studentIds = students.map(s => new ObjectId(s._id));
    const progressData = await db.collection('studentProgress')
      .find({ studentId: { $in: studentIds } })
      .toArray();

    // Group progress data by student
    const progressByStudent = {};
    progressData.forEach(progress => {
      const studentId = progress.studentId.toString();
      if (!progressByStudent[studentId]) {
        progressByStudent[studentId] = [];
      }
      progressByStudent[studentId].push(progress);
    });

    // Calculate statistics
    let totalPerformance = 0;
    let performanceCount = 0;

    const gradeDistribution = {};
    const groupDistribution = {};
    const performanceRanges = {
      excellent: 0,
      good: 0,
      average: 0,
      needsImprovement: 0
    };

    students.forEach(student => {
      const studentProgress = progressByStudent[student._id.toString()] || [];
      const performance = calculateStudentPerformance(studentProgress);

      // Grade distribution - handle grades as array
      if (student.grades && Array.isArray(student.grades) && student.grades.length > 0) {
        student.grades.forEach(grade => {
          gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
        });
      }

      // Group distribution
      const group = student.group || 'Group A';
      groupDistribution[group] = (groupDistribution[group] || 0) + 1;

      // Performance ranges
      if (performance.overall >= 90) {
        performanceRanges.excellent++;
      } else if (performance.overall >= 80) {
        performanceRanges.good++;
      } else if (performance.overall >= 70) {
        performanceRanges.average++;
      } else {
        performanceRanges.needsImprovement++;
      }

      // Accumulate for averages
      if (performance.overall > 0) {
        totalPerformance += performance.overall;
        performanceCount++;
      }
    });

    const stats = {
      totalStudents: students.length,
      averagePerformance: performanceCount > 0 ? Math.round(totalPerformance / performanceCount) : 0,
      gradeDistribution,
      groupDistribution,
      performanceRanges
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