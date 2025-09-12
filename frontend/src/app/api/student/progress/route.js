import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/get-session';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function POST(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('Progress API - Received data:', body);
    
    const { db } = await connectToDatabase();

    // Validate required fields
    if (!body.contentId || !body.contentType || !body.contentTitle) {
      console.error('Missing required fields:', { contentId: body.contentId, contentType: body.contentType, contentTitle: body.contentTitle });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const progressRecord = {
      studentId: new ObjectId(session.user.id),
      contentId: new ObjectId(body.contentId),
      contentType: body.contentType,
      contentTitle: body.contentTitle,
      subject: body.subject || 'Unknown',
      grade: body.grade || 'Unknown',
      status: body.status || 'in_progress',
      progress: body.progress || {
        currentStep: 0,
        totalSteps: 1,
        percentage: 0,
        timeSpent: 0,
        lastAccessedAt: new Date()
      },
      completionData: body.completionData || null,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 1,
        bookmarked: false
      }
    };

    console.log('Progress API - Creating/updating record:', progressRecord);

    // First, check if the record exists
    const existingRecord = await db.collection('studentProgress').findOne({
      studentId: new ObjectId(session.user.id),
      contentId: new ObjectId(body.contentId)
    });

    console.log('Progress API - Existing record:', existingRecord);

    let result;
    if (existingRecord) {
      // Update existing record
      result = await db.collection('studentProgress').findOneAndUpdate(
        {
          studentId: new ObjectId(session.user.id),
          contentId: new ObjectId(body.contentId)
        },
        {
          $set: {
            ...progressRecord,
            metadata: {
              ...existingRecord.metadata,
              updatedAt: new Date(),
              attempts: existingRecord.metadata?.attempts ? existingRecord.metadata.attempts + 1 : 1
            }
          }
        },
        {
          returnDocument: 'after'
        }
      );
      console.log('Progress API - Updated existing record:', result);
    } else {
      // Create new record
      result = await db.collection('studentProgress').findOneAndUpdate(
        {
          studentId: new ObjectId(session.user.id),
          contentId: new ObjectId(body.contentId)
        },
        {
          $set: progressRecord
        },
        {
          upsert: true,
          returnDocument: 'after'
        }
      );
      console.log('Progress API - Created new record:', result);
    }

    return NextResponse.json({ success: true, progress: result });
  } catch (error) {
    console.error('Error updating progress:', error);
    return NextResponse.json({ error: 'Failed to update progress', details: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get('contentId');
    
    const { db } = await connectToDatabase();

    let query = { studentId: new ObjectId(session.user.id) };
    if (contentId) {
      query.contentId = new ObjectId(contentId);
    }

    const progressItems = await db.collection('studentProgress').find(query).toArray();

    return NextResponse.json({ success: true, progress: progressItems });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 });
  }
}
