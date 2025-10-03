import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const grade = searchParams.get('grade');

    if (!grade) {
      return NextResponse.json({
        success: false,
        error: 'Grade parameter is required'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const curriculumCollection = db.collection('curriculum');
    
    // Find all subjects for the given grade
    const curriculumDocs = await curriculumCollection.find({ 
      grade: { $regex: new RegExp(`^${grade}$`, 'i') } 
    }).toArray();
    
    const subjects = [...new Set(curriculumDocs.map(doc => doc.subject.trim()))]
      .filter(subject => subject)
      .sort((a, b) => a.localeCompare(b));
    
    return NextResponse.json({
      success: true,
      subjects: subjects,
      grade: grade
    });

  } catch (error) {
    console.error('Error fetching subjects for grade:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch subjects',
      subjects: []
    }, { status: 500 });
  }
}
