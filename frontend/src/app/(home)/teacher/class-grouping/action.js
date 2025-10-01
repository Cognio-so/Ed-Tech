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
      const progressData = await db.collection('progress')
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
        notes: student.notes || '',
        feedback: student.feedback || [] // NEW: Add feedback array
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

export async function addStudentFeedback(studentId, feedbackData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    // Create feedback object with metadata
    const feedback = {
      id: `feedback_${Date.now()}`,
      teacherId: session.user.id,
      teacherName: session.user.name || session.user.email,
      message: feedbackData.message,
      topics: feedbackData.topics || [],
      focusAreas: feedbackData.focusAreas || [],
      strengths: feedbackData.strengths || [],
      improvements: feedbackData.improvements || [],
      priority: feedbackData.priority || 'medium',
      createdAt: new Date(),
      isActive: true
    };
    
    // Add feedback to student's feedback array
    await db.collection('user').updateOne(
      { _id: new ObjectId(studentId) },
      { 
        $push: { feedback: feedback },
        $set: { updatedAt: new Date() }
      }
    );
    
    return {
      success: true,
      message: "Student feedback added successfully",
      feedback: feedback
    };
  } catch (error) {
    console.error("Error adding student feedback:", error);
    return {
      success: false,
      error: "Failed to add student feedback"
    };
  }
}

export async function getStudentFeedback(studentId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    // Get student with feedback
    const student = await db.collection('user').findOne(
      { _id: new ObjectId(studentId) },
      { projection: { feedback: 1, name: 1, email: 1 } }
    );

    if (!student) {
      return {
        success: false,
        error: "Student not found"
      };
    }
    
    return {
      success: true,
      feedback: student.feedback || [],
      student: {
        name: student.name,
        email: student.email
      }
    };
  } catch (error) {
    console.error("Error fetching student feedback:", error);
    return {
      success: false,
      error: "Failed to fetch student feedback"
    };
  }
}

export async function updateStudentFeedback(studentId, feedbackId, updatedData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    // Update specific feedback item in array
    await db.collection('user').updateOne(
      { 
        _id: new ObjectId(studentId),
        'feedback.id': feedbackId
      },
      { 
        $set: { 
          'feedback.$.message': updatedData.message,
          'feedback.$.topics': updatedData.topics || [],
          'feedback.$.focusAreas': updatedData.focusAreas || [],
          'feedback.$.strengths': updatedData.strengths || [],
          'feedback.$.improvements': updatedData.improvements || [],
          'feedback.$.priority': updatedData.priority || 'medium',
          'feedback.$.updatedAt': new Date()
        }
      }
    );
    
    return {
      success: true,
      message: "Feedback updated successfully"
    };
  } catch (error) {
    console.error("Error updating student feedback:", error);
    return {
      success: false,
      error: "Failed to update student feedback"
    };
  }
}

export async function deleteStudentFeedback(studentId, feedbackId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    // Remove feedback from array
    await db.collection('user').updateOne(
      { _id: new ObjectId(studentId) },
      { 
        $pull: { feedback: { id: feedbackId } },
        $set: { updatedAt: new Date() }
      }
    );
    
    return {
      success: true,
      message: "Feedback deleted successfully"
    };
  } catch (error) {
    console.error("Error deleting student feedback:", error);
    return {
      success: false,
      error: "Failed to delete student feedback"
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
    const progressData = await db.collection('progress')
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