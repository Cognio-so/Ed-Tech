import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;

// Helper function to upload base64 image to Cloudinary
export async function uploadImageToCloudinary(base64Image, folder = 'ai-images') {
  try {
    // Ensure the base64 data is properly formatted as a data URL
    const dataUrl = base64Image.startsWith('data:') 
      ? base64Image 
      : `data:image/png;base64,${base64Image}`;
    
    const result = await cloudinary.uploader.upload(dataUrl, {
      folder: folder,
      resource_type: 'image',
      format: 'png',
      quality: 'auto',
      fetch_format: 'auto'
    });
    
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
