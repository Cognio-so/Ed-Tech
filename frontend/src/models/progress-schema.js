// Progress tracking schema for student learning
export const ProgressSchema = {
  _id: "ObjectId",
  studentId: "ObjectId", // Reference to student
  contentId: "ObjectId", // Reference to the content being learned
  contentType: "String", // lesson, content, assessment, video, comic, image, slides, presentation, websearch, external
  contentTitle: "String",
  subject: "String",
  grade: "String",
  status: "String", // not_started, in_progress, completed
  progress: {
    currentStep: "Number", // Current step/panel/question
    totalSteps: "Number", // Total steps/panels/questions
    percentage: "Number", // Progress percentage (0-100)
    timeSpent: "Number", // Time spent in minutes
    lastAccessedAt: "Date"
  },
  completionData: {
    completedAt: "Date",
    score: "Number", // For assessments (0-100)
    answers: "Array", // Student answers for assessments
    correctAnswers: "Number", // Number of correct answers
    totalQuestions: "Number", // Total number of questions
    timeToComplete: "Number", // Total time to complete in minutes
    feedback: "String" // Optional feedback
  },
  metadata: {
    createdAt: "Date",
    updatedAt: "Date",
    attempts: "Number", // Number of attempts
    bookmarked: "Boolean"
  }
};

export const ProgressValidationSchema = {
  studentId: { required: true, type: "ObjectId" },
  contentId: { required: true, type: "ObjectId" },
  contentType: { 
    required: true, 
    type: "string", 
    enum: ["lesson", "content", "assessment", "video", "comic", "image", "slides", "presentation", "websearch", "external"] 
  },
  contentTitle: { required: true, type: "string", maxLength: 200 },
  subject: { required: true, type: "string" },
  grade: { required: true, type: "string" },
  status: { required: true, type: "string", enum: ["not_started", "in_progress", "completed"] },
  progress: { required: true, type: "object" },
  completionData: { required: false, type: "object" }
};
