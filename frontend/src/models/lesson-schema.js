export const LessonSchema = {
  _id: "ObjectId",
  teacherId: "ObjectId", // Teacher who created the lesson
  assessmentId: "ObjectId", // Reference to the assessment that was added to lesson
  title: "String",
  subject: "String",
  grade: "String",
  topic: "String",
  assessmentContent: "String", // The assessment content
  lessonDescription: "String", // Description of the lesson
  learningObjectives: "String",
  duration: "Number", // Duration in minutes
  difficulty: "String",
  language: "String",
  metadata: {
    createdAt: "Date",
    updatedAt: "Date",
    tags: ["String"],
    isPublic: "Boolean",
    viewCount: "Number",
    completionCount: "Number"
  },
  status: "String" // draft, published, archived
};

export const LessonValidationSchema = {
  title: { required: true, type: "string", maxLength: 200 },
  subject: { required: true, type: "string", maxLength: 100 },
  grade: { required: true, type: "string" },
  topic: { required: true, type: "string", maxLength: 500 },
  assessmentContent: { required: true, type: "string" },
  lessonDescription: { required: false, type: "string", maxLength: 1000 },
  learningObjectives: { required: false, type: "string", maxLength: 1000 },
  duration: { required: true, type: "number", min: 5, max: 180 },
  difficulty: { required: true, type: "string", enum: ["Easy", "Medium", "Hard"] },
  language: { required: true, type: "string", enum: ["English", "Arabic"] }
};
