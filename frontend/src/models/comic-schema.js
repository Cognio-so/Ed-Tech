// Comic schema for MongoDB
export const ComicSchema = {
  _id: "ObjectId",
  userId: "ObjectId", // Reference to user who created the comic
  title: "String",
  topic: "String",
  subject: "String",
  grade: "String",
  instructions: "String",
  numPanels: "Number",
  language: "String", // English, Arabic
  storyPrompts: "String", // The generated story prompts
  panels: [{
    panelNumber: "Number",
    prompt: "String",
    imageBase64: "String", // Base64 encoded image data
    imageUrl: "String", // Cloudinary URL if uploaded
    cloudinaryPublicId: "String" // Cloudinary public ID for future operations
  }],
  metadata: {
    createdAt: "Date",
    updatedAt: "Date",
    tags: ["String"],
    isPublic: "Boolean",
    downloadCount: "Number",
    viewCount: "Number"
  },
  status: "String" // draft, published, archived
};

// Validation schema for comic creation
export const ComicValidationSchema = {
  title: { required: true, type: "string", maxLength: 200 },
  topic: { required: true, type: "string", maxLength: 500 },
  subject: { required: true, type: "string" },
  grade: { required: true, type: "string" },
  instructions: { required: true, type: "string", maxLength: 1000 },
  numPanels: { required: true, type: "number", min: 1, max: 20 },
  language: { required: true, type: "string", enum: ["English", "Arabic"] },
  storyPrompts: { required: true, type: "string" },
  panels: { required: true, type: "array", minLength: 1 }
};
