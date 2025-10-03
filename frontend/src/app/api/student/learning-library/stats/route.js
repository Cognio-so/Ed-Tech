import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/get-session';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

function normalizeGrades(userGrades) {
  const normalizedGrades = [];
  
  userGrades.forEach(grade => {
    normalizedGrades.push(grade);
    
    if (grade.startsWith('Grade ')) {
      const withoutGrade = grade.replace('Grade ', '');
      if (/^\d+$/.test(withoutGrade)) {
        normalizedGrades.push(withoutGrade);
      }
    } else if (/^\d+$/.test(grade)) {
      const withGrade = `Grade ${grade}`;
      normalizedGrades.push(withGrade);
    }
  });
  
  return [...new Set(normalizedGrades)];
}

// GET /api/student/learning-library/stats
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('user');
    const progressCollection = db.collection('progress');
    const lessonsCollection = db.collection('lessons');

    const user = await usersCollection.findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { grades: 1 } }
    );
    
    if (!user || !user.grades || user.grades.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No grade assigned.',
        stats: {
          totalLessons: 0,
          completedLessons: 0,
          totalTimeSpent: 0,
          totalSubjects: 0
        }
      });
    }

    const normalizedGrades = normalizeGrades(user.grades);
    const studentId = new ObjectId(session.user.id);

    // Parallel queries for stats
    const [totalLessons, completedCount, timeSpentResult, subjects] = await Promise.all([
      lessonsCollection.countDocuments({
        grade: { $in: normalizedGrades },
        status: 'published'
      }),
      progressCollection.countDocuments({
        studentId: studentId,
        status: 'completed'
      }),
      progressCollection.aggregate([
        { $match: { studentId: studentId } },
        { $group: { _id: null, totalTime: { $sum: '$progress.timeSpent' } } }
      ]).toArray(),
      lessonsCollection.distinct('subject', {
        grade: { $in: normalizedGrades },
        status: 'published'
      })
    ]);

    const totalTimeSpent = timeSpentResult.length > 0 ? timeSpentResult[0].totalTime : 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalLessons,
        completedLessons: completedCount,
        totalTimeSpent,
        totalSubjects: subjects.length
      }
    });

  } catch (error) {
    console.error('Error fetching lesson stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lesson statistics' },
      { status: 500 }
    );
  }
}

