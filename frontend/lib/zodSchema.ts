import { z } from "zod";

export const teamMemberInviteSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "teacher", "student"]),
  message: z.string().optional(),
});

export type TeamMemberInviteValues = z.infer<typeof teamMemberInviteSchema>;

const topicQuestionConfigSchema = z.object({
  topicName: z.string().min(1, "Topic name is required"),
  longAnswerCount: z.number().min(0, "Count must be 0 or greater"),
  shortAnswerCount: z.number().min(0, "Count must be 0 or greater"),
  mcqCount: z.number().min(0, "Count must be 0 or greater"),
  trueFalseCount: z.number().min(0, "Count must be 0 or greater"),
}).refine(
  (data) => {
    const total = data.longAnswerCount + data.shortAnswerCount + data.mcqCount + data.trueFalseCount;
    return total > 0;
  },
  {
    message: "At least one question type must be specified for each topic",
    path: ["longAnswerCount"],
  }
);

export const examGeneratorSchema = z.object({
  organisationName: z.string().min(1, "Organisation name is required"),
  examName: z.enum(["Annual", "Unit test", "Half yearly", "class test"]),
  duration: z.string().min(1, "Duration is required"),
  grade: z.string().min(1, "Grade is required"),
  subject: z.string().min(1, "Subject is required"),
  language: z.enum(["English", "Hindi"]),
  difficultyLevel: z.string().min(1, "Difficulty level is required"),
  topics: z.array(topicQuestionConfigSchema).min(1, "At least one topic is required"),
  customPrompt: z.string().optional(),
});

export type ExamGeneratorValues = z.infer<typeof examGeneratorSchema>;
export type TopicQuestionConfigValues = z.infer<typeof topicQuestionConfigSchema>;