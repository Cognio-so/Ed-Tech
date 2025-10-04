'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from '@/lib/get-session';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

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

// Helper function to get cookies for fetch requests
async function getFetchHeaders() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  
  return {
    'Content-Type': 'application/json',
    'Cookie': cookieHeader
  };
}

// Server-side API functions for server actions
export async function getAllStudentContent() {
  try {
    const headers = await getFetchHeaders();
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/student/learning-library`, {
      method: 'GET',
      headers,
      cache: 'no-store' // Ensure fresh data
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching content:', error);
    throw new Error(error.message || 'Failed to fetch content');
  }
}

export async function getLessonById(lessonId) {
  try {
    const headers = await getFetchHeaders();
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/student/learning-library/${lessonId}`, {
      method: 'GET',
      headers,
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching lesson by ID:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function updateStudentProgress(contentId, completionData = {}) {
  try {
    // Validate input data
    if (!contentId) {
      throw new Error('Content ID is required');
    }

    // Ensure completionData is serializable
    const cleanCompletionData = JSON.parse(JSON.stringify(completionData));

    const headers = await getFetchHeaders();
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/student/learning-library/progress`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contentId,
        completionData: cleanCompletionData
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    
    // Revalidate the learning library page
    revalidatePath('/student/learning-library');
    
    return data;
  } catch (error) {
    console.error('Error updating student progress:', error);
    throw new Error(error.message || 'Failed to update progress');
  }
}

export async function getLessonStats() {
  try {
    const headers = await getFetchHeaders();
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/student/learning-library/stats`, {
      method: 'GET',
      headers,
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching lesson stats:', error);
    throw new Error(error.message || 'Failed to fetch lesson statistics');
  }
}
