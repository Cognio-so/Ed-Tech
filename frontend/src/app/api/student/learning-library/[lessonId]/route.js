import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/get-session';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// GET /api/student/learning-library/[lessonId]
export async function GET(request, { params }) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lessonId } = params;

    if (!lessonId) {
      return NextResponse.json(
        { error: 'Lesson ID is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    
    const lessonsCollection = db.collection('lessons');
    let content = await lessonsCollection.findOne({ _id: new ObjectId(lessonId) });
    
    if (content) {
      return NextResponse.json({
        success: true,
        content: content
      });
    }
    
    const comicsCollection = db.collection('comics');
    content = await comicsCollection.findOne({ _id: new ObjectId(lessonId) });
    
    if (content) {
      return NextResponse.json({
        success: true,
        content: {
          ...content,
          resourceType: 'comic'
        }
      });
    }
    
    return NextResponse.json(
      { error: 'Content not found' },
      { status: 404 }
    );
    
  } catch (error) {
    console.error('Error fetching lesson by ID:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lesson' },
      { status: 500 }
    );
  }
}

