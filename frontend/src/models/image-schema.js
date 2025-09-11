// Image schema for MongoDB
export const ImageSchema = {
  _id: "ObjectId",
  userId: "ObjectId", 
  title: "String",
  topic: "String",
  subject: "String",
  grade: "String",
  instructions: "String",
  visualType: "String", 
  language: "String", 
  difficultyFlag: "Boolean",
  imageUrl: "String", // Cloudinary URL
  cloudinaryPublicId: "String", // Cloudinary public ID for future operations
  imageBase64: "String", // Base64 encoded image data (backup)
  metadata: {
    createdAt: "Date",
    updatedAt: "Date",
    tags: ["String"],
    isPublic: "Boolean",
    downloadCount: "Number",
    viewCount: "Number"
  },
  status: "String" 
};

export const ImageValidationSchema = {
  title: { required: true, type: "string", maxLength: 200 },
  topic: { required: true, type: "string", maxLength: 500 },
  subject: { required: true, type: "string" },
  grade: { required: true, type: "string" },
  instructions: { required: true, type: "string", maxLength: 1000 },
  visualType: { required: true, type: "string", enum: ["image", "chart", "diagram"] },
  language: { required: true, type: "string", enum: ["English", "Arabic"] },
  difficultyFlag: { required: false, type: "boolean" },
  imageUrl: { required: true, type: "string" }
};
