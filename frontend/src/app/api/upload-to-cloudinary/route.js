import { NextResponse } from 'next/server';
import { uploadImageToCloudinary } from '@/lib/cloudinary';

export async function POST(request) {
  try {
    const { base64Image, folder = 'ai-comics' } = await request.json();
    
    if (!base64Image) {
      return NextResponse.json(
        { success: false, error: 'No image data provided' },
        { status: 400 }
      );
    }

    // Pass the full data URL to uploadImageToCloudinary - it will handle the formatting
    const result = await uploadImageToCloudinary(base64Image, folder);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        url: result.url,
        publicId: result.publicId
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
