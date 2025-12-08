export type QuestionType = "mcq" | "true_false" | "short_answer";

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[]; // For MCQ: ["A. Option 1", "B. Option 2", ...]
  correctAnswer: string; // For MCQ: "A", "B", etc. For T/F: "True" or "False". For short answer: the answer text
  explanation?: string; // Rationale/explanation for the answer
}

export interface ParsedAssessment {
  questions: Question[];
  overview?: string;
  learningObjectives?: string[];
}

/**
 * Simple parser: Extract questions from "Question X: [Type]" format
 */
export function parseAssessment(content: string): ParsedAssessment {
  const questions: Question[] = [];

  // Find Questions section
  const questionsMatch = content.match(/##\s+Questions\s*([\s\S]*?)(?=##|$)/i);
  const questionsSection = questionsMatch ? questionsMatch[1] : content;

  // Map question type string to internal type
  const mapQuestionType = (type: string): QuestionType => {
    const normalizedType = type.toLowerCase().trim();
    if (normalizedType.includes("multiple choice") || normalizedType.includes("mcq")) {
      return "mcq";
    }
    if (normalizedType.includes("true") && normalizedType.includes("false")) {
      return "true_false";
    }
    if (normalizedType.includes("short answer") || normalizedType.includes("short")) {
      return "short_answer";
    }
    // Try to guess from content if type is ambiguous
    return "short_answer";
  };

  // Extract questions using pattern: "Question X: [Type]" or "Question X: Type"
  // Supports optional brackets around type
  const questionRegex = /Question\s+(\d+):\s*(?:\[)?([^\]\n]+?)(?:\])?\s*\n([\s\S]*?)(?=Question\s+\d+:|$)/gi;
  let match;

  // Search in both questions section and full content if needed
  let searchContent = questionsSection;
  if (questionsSection.length < 50 && content.length > 50) {
    searchContent = content;
  }

  while ((match = questionRegex.exec(searchContent)) !== null) {
    const questionNumber = match[1];
    const typeString = match[2].trim();
    let questionContent = match[3].trim();
    
    // Sometimes the type capture group might grab too much if brackets aren't used
    // If typeString looks like it contains the question text, we need to adjust
    // But since we use \n in regex, type should be on the same line as "Question X:"

    const questionType = mapQuestionType(typeString);
    let questionText = questionContent;
    let options: string[] = [];
    let correctAnswer = "";
    let explanation = "";

    // Extract correct answer
    const answerMatch = questionContent.match(/Correct\s+Answer:\s*([^\n]+)/i);
    if (answerMatch) {
      // Remove asterisks and other markdown characters from the answer
      correctAnswer = answerMatch[1].trim().replace(/[*`_]/g, "");
      // Remove answer line from question text
      questionText = questionText.replace(/Correct\s+Answer:.*$/gim, "").trim();
    }

    // Extract explanation (Rationale or Justification)
    const explanationMatch = questionContent.match(/(?:Rationale|Justification):\s*([\s\S]*?)(?=Question\s+\d+:|$)/i);
    if (explanationMatch) {
      explanation = explanationMatch[1].trim();
      questionText = questionText.replace(/(?:Rationale|Justification):.*$/gim, "").trim();
    }

    // For MCQ: Extract options A-D
    // Improved regex to handle various formats like "A. ", "A) ", "(A) "
    if (questionType === "mcq") {
      const optionLines = questionText.match(/^[\(\s]*[A-D][\.\)]\s*(.+)$/gim);
      if (optionLines && optionLines.length >= 2) {
        options = optionLines.map(line => {
          const match = line.match(/^[\(\s]*([A-D])[\.\)]\s*(.+)$/i);
          if (match) {
            return `${match[1].toUpperCase()}. ${match[2].trim()}`;
          }
          return line.trim();
        });
        // Remove option lines from question text
        questionText = questionText.replace(/^[\(\s]*[A-D][\.\)]\s*.+$/gim, "").trim();
      }
    }

    // For True/False: Set options
    if (questionType === "true_false") {
      options = ["True", "False"];
      // Remove "True / False" text if present
      questionText = questionText.replace(/True\s*\/\s*False/gi, "").trim();
    }

    // Clean up question text
    questionText = questionText
      .replace(/Enter\s+your\s+answer\s+here\.\.\./gi, "")
      .replace(/Enter\s+your\s+answer\s+here/gi, "")
      .trim();

    if (questionText.length > 0) {
      questions.push({
        id: `question-${questionNumber}`,
        type: questionType,
        question: questionText,
        options: options.length > 0 ? options : undefined,
        correctAnswer,
        explanation: explanation || undefined,
      });
    }
  }

  // Extract overview and learning objectives if present
  let overview = "";
  let learningObjectives: string[] = [];

  const overviewMatch = content.match(/##\s+Assessment\s+Overview\s*([\s\S]*?)(?=##|$)/i);
  if (overviewMatch) {
    overview = overviewMatch[1].trim();
  }

  const objectivesMatch = content.match(/##\s+Learning\s+Objectives\s*([\s\S]*?)(?=##|$)/i);
  if (objectivesMatch) {
    const objectivesText = objectivesMatch[1];
    const bulletMatches = objectivesText.match(/[-*]\s*(.+)/g);
    if (bulletMatches) {
      learningObjectives = bulletMatches.map((m) =>
        m.replace(/^[-*]\s*/, "").trim()
      );
    }
  }

  return {
    questions,
    overview: overview || undefined,
    learningObjectives:
      learningObjectives.length > 0 ? learningObjectives : undefined,
  };
}

/**
 * Parses duration string (e.g., "45 minutes", "1 hour 30 minutes") to seconds
 */
export function parseDurationToSeconds(duration: string): number {
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
