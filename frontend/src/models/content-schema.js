// Content schema for MongoDB
export const ContentSchema = {
  _id: "ObjectId",
  userId: "ObjectId", // Reference to user who created the content
  title: "String",
  contentType: "String", // lesson, presentation, worksheet, etc.
  subject: "String",
  grade: "String",
  topic: "String",
  objective: "String",
  emotionalConsideration: "String",
  language: "String", // english, arabic
  adaptiveLearning: "Boolean",
  includeAssessment: "Boolean",
  multimediaSuggestions: "Boolean",
  instructionDepth: "String", // simplified, selected, enriched
  contentVersion: "String", // simplified, selected, enriched
  generatedContent: "String", // The actual generated content (markdown)
  presentation: "Object", // For presentation content type
  metadata: {
    createdAt: "Date",
    updatedAt: "Date",
    tags: ["String"],
    isPublic: "Boolean",
    downloadCount: "Number"
  },
  status: "String" // draft, published, archived
};

// Validation schema for content creation
export const ContentValidationSchema = {
  title: { required: true, type: "string", maxLength: 200 },
  contentType: { required: true, type: "string", enum: ["lesson", "presentation", "worksheet", "assessment"] },
  subject: { required: true, type: "string" },
  grade: { required: true, type: "string" },
  topic: { required: true, type: "string", maxLength: 500 },
  objective: { required: true, type: "string", maxLength: 1000 },
  language: { required: true, type: "string", enum: ["english", "arabic"] },
  generatedContent: { required: true, type: "string" }
};
