"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { parseAssessment, Question } from "./_components/assessment-parser";
import { generateText } from "ai";
import { getAIProvider } from "@/lib/ai";
import { getLessonItemById } from "@/data/get-lesson-item";

interface QuestionResult {
  questionId: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation?: string;
}

interface SubmissionResult {
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  questionResults: QuestionResult[];
}

export async function getSubmissionByContentId(
  contentId: string
): Promise<SubmissionResult | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return null;
  }

  try {
    // Find the most recent submission for this content (any content type)
    const submission = await (prisma as any).studentSubmission.findFirst({
      where: {
        userId: session.user.id,
        contentId: contentId,
      },
      orderBy: {
        submittedAt: "desc",
      },
    });

    if (!submission) {
      return null;
    }

    // Fetch the original content to parse questions
    const lessonItem = await getLessonItemById(contentId);

    if (!lessonItem) {
      return null;
    }

    // For assessment/quiz, parse questions and return detailed results
    if (submission.contentType === "assessment" || submission.contentType === "quiz") {
      // Parse questions to get question details
      const parsed = parseAssessment(lessonItem.content);
      const questions = parsed.questions;

      // Parse the stored responses - check if it's the old format (just responses) or new format (with questionResults)
      let parsedData: any;
      let parsedResponses: Record<string, string> = {};
      let storedQuestionResults: QuestionResult[] | null = null;
      
      try {
        parsedData = JSON.parse(submission.responses);
        
        // Check if it's the new format with questionResults
        if (parsedData.questionResults && Array.isArray(parsedData.questionResults)) {
          // New format with questionResults
          storedQuestionResults = parsedData.questionResults;
          parsedResponses = parsedData.responses || {};
        } else {
          // Old format - just responses (backward compatibility)
          parsedResponses = parsedData;
        }
      } catch {
        // If parsing fails, use empty object
        parsedResponses = {};
      }

      // If we have stored question results, use them; otherwise reconstruct
      let questionResults: QuestionResult[];
      
      if (storedQuestionResults && storedQuestionResults.length > 0) {
        // Use stored results - they already have the correct isCorrect values from AI evaluation
        questionResults = storedQuestionResults;
      } else {
        // Reconstruct question results from stored data (for old submissions)
        questionResults = questions.map((question) => {
          const studentAnswer = parsedResponses[question.id] || "";
          const correctAnswer = question.correctAnswer || "(No correct answer provided)";
          
          // Determine if correct (for MCQ/TF, compare directly)
          let isCorrect = false;
          if (question.type === "mcq" || question.type === "true_false") {
            isCorrect =
              studentAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase();
          } else {
            // For short answers, do simple comparison (we can't re-evaluate with AI here)
            // This is a limitation for old submissions - they won't have AI evaluation results
            isCorrect =
              studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
          }

          return {
            questionId: question.id,
            studentAnswer: studentAnswer || "(No answer provided)",
            correctAnswer,
            isCorrect,
            explanation: question.explanation,
          };
        });
      }

      // Calculate counts
      const correctCount = questionResults.filter((r) => r.isCorrect).length;
      const wrongCount = questionResults.length - correctCount;

      return {
        score: submission.score,
        totalQuestions: questions.length,
        correctCount,
        wrongCount,
        questionResults,
      };
    } else {
      // For non-assessment/quiz content, return simple completion result
      return {
        score: submission.score,
        totalQuestions: 0,
        correctCount: 0,
        wrongCount: 0,
        questionResults: [],
      };
    }
  } catch (error) {
    console.error("Error fetching submission:", error);
    return null;
  }
}

interface SubmitAssessmentParams {
  contentId: string;
  contentType: string;
  responses: Record<string, string>;
  timeSpent: number;
}

interface QuestionResult {
  questionId: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation?: string;
}

interface SubmissionResult {
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  questionResults: QuestionResult[];
}

export async function submitAssessment(
  params: SubmitAssessmentParams
): Promise<SubmissionResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  try {
    // Fetch the original content
    const lessonItem = await getLessonItemById(params.contentId);

    if (!lessonItem) {
      throw new Error("Content not found");
    }

    // Parse questions and correct answers
    const parsed = parseAssessment(lessonItem.content);
    const questions = parsed.questions;

    if (questions.length === 0) {
      throw new Error("No questions found in content");
    }

    // Evaluate each question using AI
    const questionResults: QuestionResult[] = [];
    let correctCount = 0;

    for (const question of questions) {
      const studentAnswer = params.responses[question.id] || "";
      const correctAnswer = question.correctAnswer;

      // Use AI to evaluate the answer (especially for short answers)
      let isCorrect = false;
      let explanation = question.explanation || "";

      if (question.type === "mcq" || question.type === "true_false") {
        // For MCQ and T/F, do direct comparison (normalize both answers)
        const normalizedStudentAnswer = studentAnswer.trim().toUpperCase();
        const normalizedCorrectAnswer = correctAnswer.trim().toUpperCase();
        isCorrect = normalizedStudentAnswer === normalizedCorrectAnswer;
        
        // If direct comparison fails, try AI evaluation for semantic equivalence
        // This helps with cases where the answer might be semantically correct
        if (!isCorrect) {
          try {
            const aiProvider = getAIProvider();
            const model = aiProvider("gpt-4o-mini");
            
            // Get the full option text for better context
            let correctAnswerText = correctAnswer;
            let studentAnswerText = studentAnswer;
            
            if (question.type === "mcq" && question.options) {
              // Find the full option text for correct answer
              const correctLetter = correctAnswer.trim().toUpperCase();
              const correctOption = question.options.find(
                (opt) => opt.trim().charAt(0).toUpperCase() === correctLetter
              );
              if (correctOption) {
                correctAnswerText = correctOption;
              }
              
              // Find the full option text for student answer
              const studentLetter = studentAnswer.trim().toUpperCase();
              const studentOption = question.options.find(
                (opt) => opt.trim().charAt(0).toUpperCase() === studentLetter
              );
              if (studentOption) {
                studentAnswerText = studentOption;
              }
            }
            
            const { text } = await generateText({
              model,
              prompt: `You are an educational assessment evaluator. Compare the student's answer with the correct answer and determine if they are equivalent in meaning.

Question: ${question.question}

Correct Answer: ${correctAnswerText}

Student Answer: ${studentAnswerText}

Evaluate if the student's answer is correct. Consider:
- For multiple choice questions, check if the selected option is semantically equivalent to the correct option
- Semantic equivalence (same meaning even if worded differently)
- Key concepts and facts

Respond with ONLY a JSON object in this exact format:
{
  "isCorrect": true or false,
  "explanation": "Brief explanation of why the answer is correct or incorrect"
}`,
              temperature: 0.3,
            });

            try {
              const evaluation = JSON.parse(text);
              // Only use AI result if it says correct (to avoid false positives)
              // But still prefer direct match if available
              if (evaluation.isCorrect === true) {
                isCorrect = true;
                explanation = evaluation.explanation || explanation;
              }
            } catch {
              // Keep the direct comparison result if JSON parsing fails
            }
          } catch (error) {
            // If AI evaluation fails, keep the direct comparison result
            console.error("Error evaluating answer with AI:", error);
          }
        }
      } else {
        // For short answers, use AI to evaluate
        try {
          // Use AI to evaluate short answer questions
          const aiProvider = getAIProvider();
          const model = aiProvider("gpt-4o-mini");
          const { text } = await generateText({
            model, 
            prompt: `You are an educational assessment evaluator. Compare the student's answer with the correct answer and determine if they are equivalent in meaning.

Question: ${question.question}

Correct Answer: ${correctAnswer}

Student Answer: ${studentAnswer}

Evaluate if the student's answer is correct. Consider:
- Semantic equivalence (same meaning even if worded differently)
- Key concepts and facts
- Partial correctness for complex answers

Respond with ONLY a JSON object in this exact format:
{
  "isCorrect": true or false,
  "explanation": "Brief explanation of why the answer is correct or incorrect"
}`,
            temperature: 0.3,
          });

          try {
            const evaluation = JSON.parse(text);
            isCorrect = evaluation.isCorrect === true;
            explanation = evaluation.explanation || explanation;
          } catch {
            // Fallback: simple string comparison
            isCorrect =
              studentAnswer.trim().toLowerCase() ===
              correctAnswer.trim().toLowerCase();
          }
        } catch (error) {
          console.error("Error evaluating answer with AI:", error);
          // Fallback: simple string comparison
          isCorrect =
            studentAnswer.trim().toLowerCase() ===
            correctAnswer.trim().toLowerCase();
        }
      }

      if (isCorrect) {
        correctCount++;
      }

      // Clean up explanation to remove "Rationale" and "Justification" labels
      let cleanedExplanation = explanation;
      if (cleanedExplanation) {
        cleanedExplanation = cleanedExplanation
          .replace(/^(?:Rationale|Justification):\s*/i, "")
          .trim();
      }
      
      // Ensure we have a correct answer - if empty, try to extract from question object
      let finalCorrectAnswer = correctAnswer;
      if (!finalCorrectAnswer || finalCorrectAnswer.trim() === "") {
        // Fallback: use the question's correctAnswer field directly
        finalCorrectAnswer = question.correctAnswer || "(No correct answer provided)";
        
        // If still empty, log for debugging
        if (!finalCorrectAnswer || finalCorrectAnswer === "(No correct answer provided)") {
          console.warn(`Missing correct answer for question ${question.id}. Question type: ${question.type}`);
        }
      }
      
      questionResults.push({
        questionId: question.id,
        studentAnswer: studentAnswer || "(No answer provided)",
        correctAnswer: finalCorrectAnswer,
        isCorrect,
        explanation: cleanedExplanation,
      });
    }

    // Calculate score with time bonus
    const baseScore = (correctCount / questions.length) * 100;
    
    // Time bonus: faster completion = bonus points (up to 5% bonus)
    // If completed in less than 50% of allocated time, get 5% bonus
    // Linear scaling between 50% and 100% of time
    let timeBonus = 0;
    if (params.contentType === "assessment" && lessonItem.durationOfSession) {
      const totalTime = parseDurationToSeconds(lessonItem.durationOfSession);
      if (totalTime > 0) {
        const timeRatio = params.timeSpent / totalTime;
        if (timeRatio <= 0.5) {
          timeBonus = 5;
        } else if (timeRatio < 1) {
          timeBonus = 5 * (1 - timeRatio) * 2; // Linear scaling
        }
      }
    }

    const finalScore = Math.min(100, baseScore + timeBonus);
    const wrongCount = questions.length - correctCount;

    // Save submission to database with question results for easy retrieval
    // Store both responses and questionResults in the responses field
    const submissionData = {
      responses: params.responses,
      questionResults: questionResults,
    };
    
    await (prisma as any).studentSubmission.create({
      data: {
        userId: session.user.id,
        contentId: params.contentId,
        contentType: params.contentType,
        responses: JSON.stringify(submissionData),
        score: finalScore,
        timeSpent: params.timeSpent,
      },
    });

    return {
      score: finalScore,
      totalQuestions: questions.length,
      correctCount,
      wrongCount,
      questionResults,
    };
  } catch (error) {
    console.error("Error submitting assessment:", error);
    throw new Error("Failed to submit assessment");
  }
}

/**
 * Submit non-assessment content (lesson_plan, worksheet, quiz, presentation, etc.)
 * This gives a 100% score for viewing/completing the content
 */
export async function submitContentCompletion(
  contentId: string,
  contentType: string,
  timeSpent: number = 0
): Promise<{ success: boolean; score: number }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  try {
    // Save submission with 100% score
    await (prisma as any).studentSubmission.create({
      data: {
        userId: session.user.id,
        contentId: contentId,
        contentType: contentType,
        responses: JSON.stringify({ completed: true }),
        score: 100,
        timeSpent: timeSpent,
      },
    });

    return { success: true, score: 100 };
  } catch (error) {
    console.error("Error submitting content completion:", error);
    throw new Error("Failed to submit content completion");
  }
}

function parseDurationToSeconds(duration: string): number {
  if (!duration) return 0;

  let totalSeconds = 0;

  // Match hours
  const hourMatch = duration.match(/(\d+)\s*h(?:our)?s?/i);
  if (hourMatch) {
    totalSeconds += parseInt(hourMatch[1]) * 3600;
  }

  // Match minutes
  const minuteMatch = duration.match(/(\d+)\s*m(?:inute)?s?/i);
  if (minuteMatch) {
    totalSeconds += parseInt(minuteMatch[1]) * 60;
  }

  // If no matches, try to parse as just a number (assume minutes)
  if (totalSeconds === 0) {
    const numberMatch = duration.match(/(\d+)/);
    if (numberMatch) {
      totalSeconds = parseInt(numberMatch[1]) * 60;
    }
  }

  return totalSeconds;
}

