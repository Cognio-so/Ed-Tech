export const AssessmentSchema = {
  _id: "ObjectId",
  userId: "ObjectId", 
  title: "String",
  subject: "String",
  grade: "String", 
  topic: "String",
  duration: "Number", 
  difficulty: "String", 
  language: "String", 
  numQuestions: "Number", 
  questionTypes: {
    mcq: "Boolean",
    true_false: "Boolean", 
    short_answer: "Boolean"
  },
  questionDistribution: {
    mcq: "Number",
    true_false: "Number",
    short_answer: "Number"
  },
  learningObjectives: "String",
  anxietyTriggers: "String",
  customPrompt: "String",
  generatedContent: "String", 
  metadata: {
    createdAt: "Date",
    updatedAt: "Date",
    tags: ["String"],
    isPublic: "Boolean",
    downloadCount: "Number",
    shareCount: "Number"
  },
  status: "String", 
  version: "Number" 
};

export const AssessmentValidationSchema = {
  title: { required: true, type: "string", maxLength: 200 },
  subject: { required: true, type: "string", maxLength: 100 },
  grade: { required: true, type: "string" },
  topic: { required: true, type: "string", maxLength: 500 },
  duration: { required: true, type: "number", min: 5, max: 180 },
  difficulty: { required: true, type: "string", enum: ["Easy", "Medium", "Hard"] },
  language: { required: true, type: "string", enum: ["english", "arabic"] },
  numQuestions: { required: true, type: "number", min: 1, max: 50 },
  questionTypes: { required: true, type: "object" },
  questionDistribution: { required: true, type: "object" }
};
