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
 * Parses markdown assessment content to extract questions and answers
 * Hides answers from student view during assessment
 */
export function parseAssessment(content: string): ParsedAssessment {
  const questions: Question[] = [];

  // Split content into sections
  const sections = content.split(/^##\s+/m);

  // Find the Questions section (or Quiz Items for quiz content)
  let questionsSection = "";
  for (const section of sections) {
    const sectionLower = section.trim().toLowerCase();
    if (
      sectionLower.startsWith("questions") ||
      sectionLower.startsWith("quiz items")
    ) {
      questionsSection = section;
      break;
    }
  }

  if (!questionsSection) {
    // Try to find questions without section header
    const questionMatches = content.match(/Question\s+\d+:/gi);
    if (questionMatches) {
      questionsSection = content;
    } else {
      // Also try to find questions in Answer Key section (for quiz format)
      // Sometimes quiz questions might be in the main content before Answer Key
      const answerKeyIndex = content.toLowerCase().indexOf("## answer key");
      if (answerKeyIndex > 0) {
        // Use content before Answer Key as questions section
        questionsSection = content.substring(0, answerKeyIndex);
      } else {
        return { questions: [] };
      }
    }
  }

  // Try multiple question patterns to handle different formats
  // Pattern 1: "Question 1:", "Question 2:", etc.
  // Pattern 2: "1.", "2.", etc. (numbered list)
  // Pattern 3: "Q1:", "Q2:", etc.
  let questionRegex = /Question\s+(\d+):\s*([\s\S]*?)(?=Question\s+\d+:|$)/gi;
  let match = questionRegex.exec(questionsSection);
  
  // If no matches with "Question X:" format, try numbered list format
  if (!match) {
    questionRegex = /^(\d+)\.\s*([\s\S]*?)(?=^\d+\.\s*|##\s+Answer\s+Key|$)/gim;
    match = questionRegex.exec(questionsSection);
  }
  
  // If still no matches, try "Q1:", "Q2:" format
  if (!match) {
    questionRegex = /Q(\d+):\s*([\s\S]*?)(?=Q\d+:|$)/gi;
    match = questionRegex.exec(questionsSection);
  }
  
  // Reset regex for the loop
  questionRegex = /Question\s+(\d+):\s*([\s\S]*?)(?=Question\s+\d+:|$)/gi;
  let foundQuestions = false;

  while ((match = questionRegex.exec(questionsSection)) !== null) {
    foundQuestions = true;
    const questionNumber = match[1];
    const questionContent = match[2].trim();

    let correctAnswer = "";
    let explanation = "";

    let correctAnswerMatch = questionContent.match(
      /Correct\s+Answer:\s*([^\n\r]+)/i
    );
    if (correctAnswerMatch) {
      let answerLine = correctAnswerMatch[1].trim();

      const letterMatch = answerLine.match(/^([A-D])[\.\)]?\s*/i);
      if (letterMatch) {
        correctAnswer = letterMatch[1].toUpperCase();
      } else {
        // For True/False
        const tfMatch = answerLine.match(/^(True|False)/i);
        if (tfMatch) {
          correctAnswer =
            tfMatch[1].charAt(0).toUpperCase() +
            tfMatch[1].slice(1).toLowerCase();
        } else {
          // For short answer, get the first line
          // Remove any trailing explanation markers
          correctAnswer = answerLine
            .split(/[\.\)]\s*(?:Rationale|Justification|Explanation)/i)[0]
            .trim();
        }
      }
    }

    // Pattern 1b: If not found, try multi-line match (for answers that span multiple lines)
    if (!correctAnswer) {
      // Match everything after "Correct Answer:" until next question or explicit label
      correctAnswerMatch = questionContent.match(
        /Correct\s+Answer:\s*([\s\S]+?)(?=\n\s*(?:Question\s+\d+:|Explanation|Rationale|Justification):|$)/i
      );
      if (correctAnswerMatch) {
        let answerLine = correctAnswerMatch[1].trim();

        // Remove any trailing "Rationale:" or "Justification:" labels
        answerLine = answerLine
          .replace(/\n\s*(?:Rationale|Justification|Explanation):\s*/i, "\n")
          .trim();

        // For MCQ, extract just the letter (A, B, C, or D)
        const letterMatch = answerLine.match(/^([A-D])[\.\)]?\s*/i);
        if (letterMatch) {
          correctAnswer = letterMatch[1].toUpperCase();
        } else {
          // For True/False
          const tfMatch = answerLine.match(/^(True|False)/i);
          if (tfMatch) {
            correctAnswer =
              tfMatch[1].charAt(0).toUpperCase() +
              tfMatch[1].slice(1).toLowerCase();
          } else {
            // For short answer, get everything up to first explanation marker or newline
            correctAnswer = answerLine
              .split(/\n\s*(?:Explanation|Rationale|Justification|Reason):/i)[0]
              .split(/\n\n/)[0] // Take first paragraph if multiple paragraphs
              .trim();
          }
        }
      }
    }

    // Pattern 1c: Very simple fallback - just get first non-empty line after "Correct Answer:"
    if (!correctAnswer) {
      const lines = questionContent.split(/\n/);
      const answerLineIndex = lines.findIndex((line) =>
        /Correct\s+Answer:/i.test(line)
      );
      if (answerLineIndex >= 0 && answerLineIndex < lines.length - 1) {
        // Get the line after "Correct Answer:"
        const nextLine = lines[answerLineIndex + 1]?.trim();
        if (
          nextLine &&
          !nextLine.match(/^(?:Explanation|Rationale|Justification|Question)/i)
        ) {
          const letterMatch = nextLine.match(/^([A-D])[\.\)]?\s*/i);
          if (letterMatch) {
            correctAnswer = letterMatch[1].toUpperCase();
          } else {
            const tfMatch = nextLine.match(/^(True|False)/i);
            if (tfMatch) {
              correctAnswer =
                tfMatch[1].charAt(0).toUpperCase() +
                tfMatch[1].slice(1).toLowerCase();
            } else {
              correctAnswer = nextLine;
            }
          }
        }
      }
    }

    // Pattern 2: Look for "Answer:" or "Solution:" if "Correct Answer:" not found
    if (!correctAnswer) {
      const answerMatch = questionContent.match(
        /(?:Answer|Solution):\s*([\s\S]+?)(?=\n\s*(?:Explanation|Rationale|Justification|Question\s+\d+):|$)/i
      );
      if (answerMatch) {
        let answerLine = answerMatch[1].trim();
        // Remove any trailing "Rationale:" or "Justification:" labels
        answerLine = answerLine
          .replace(/\n\s*(?:Rationale|Justification):\s*/i, "\n")
          .trim();
        const letterMatch = answerLine.match(/^([A-D])[\.\)]?\s*/i);
        if (letterMatch) {
          correctAnswer = letterMatch[1].toUpperCase();
        } else {
          correctAnswer = answerLine
            .split(/\n\s*(?:Explanation|Rationale|Justification|Reason):/i)[0]
            .trim();
        }
      }
    }

    // Extract explanation (text after correct answer, before next question)
    // Look for text after "Correct Answer:" line, but exclude labels like "Rationale:", "Justification:"
    // The explanation is typically the text that follows the correct answer on the same or next line
    const explanationPatterns = [
      // Pattern: Text after "Correct Answer: X" on same line or next lines (but before next question)
      /Correct\s+Answer:.+?\n\s*([\s\S]+?)(?=Question\s+\d+:|Correct\s+Answer:|$)/i,
      // Pattern: Look for explanation after answer line
      /Correct\s+Answer:\s*.+?\n([\s\S]+?)(?=Question\s+\d+:|$)/i,
    ];

    for (const pattern of explanationPatterns) {
      const explanationMatch = questionContent.match(pattern);
      if (explanationMatch) {
        let extractedExplanation = explanationMatch[1].trim();
        // Remove any labels like "Rationale:", "Justification:", "Explanation:" from the start
        extractedExplanation = extractedExplanation.replace(
          /^(?:Rationale|Justification|Explanation):\s*/i,
          ""
        );
        // Remove any trailing "Correct Answer:" or question markers
        extractedExplanation = extractedExplanation
          .replace(/Correct\s+Answer:.*$/gim, "")
          .trim();
        if (extractedExplanation) {
          explanation = extractedExplanation;
          break;
        }
      }
    }

    // If we have explanation but no correct answer, try to extract from explanation
    if (!correctAnswer && explanation) {
      // Check if explanation starts with an answer pattern
      const answerInExplanation = explanation.match(
        /^(?:Answer|Correct|Solution)[:\s]+(.+?)(?:\n|$)/i
      );
      if (answerInExplanation) {
        const answerLine = answerInExplanation[1].trim();
        const letterMatch = answerLine.match(/^([A-D])[\.\)]?\s*/i);
        if (letterMatch) {
          correctAnswer = letterMatch[1].toUpperCase();
        } else {
          correctAnswer = answerLine.split(/\n/)[0].trim();
        }
      }
    }

    // For short answers, if correct answer is empty, try to get it from the full question content
    // Sometimes the answer might be in a different format
    if (!correctAnswer) {
      // Look for any answer pattern in the entire question content
      const anyAnswerMatch = questionContent.match(
        /(?:Correct\s+Answer|Answer|Solution):\s*([^\n]+)/i
      );
      if (anyAnswerMatch) {
        const answerLine = anyAnswerMatch[1].trim();
        // Don't extract if it looks like an explanation
        if (!answerLine.match(/^(?:Rationale|Justification|Explanation)/i)) {
          correctAnswer = answerLine;
        }
      }
    }

    // Debug: Log if correct answer is still empty (for troubleshooting)
    if (!correctAnswer && process.env.NODE_ENV === "development") {
      console.warn(
        `No correct answer found for question ${questionNumber}. Content preview:`,
        questionContent.substring(0, 200)
      );
    }

    // Remove correct answer line from question text (for student view)
    // Keep explanation for now so we can detect MCQ options correctly
    let questionText = questionContent
      .replace(/Correct\s+Answer:.*$/gim, "")
      .replace(/Answer:.*$/gim, "")
      .replace(/Solution:.*$/gim, "")
      .trim();

    // Remove difficulty and type tags at the start - but only if they're on their own line
    // Handle patterns like "(Medium) Short", "Medium Short", "Short (Medium)", etc.
    // Only remove if followed by a newline or if it's the only content
    questionText = questionText
      .replace(/^\(?(Easy|Medium|Hard)\)?\s*(Short|Long|Brief|Extended)?\s*\n+/i, "")
      .replace(/^(Short|Long|Brief|Extended)\s*\(?(Easy|Medium|Hard)\)?\s*\n+/i, "")
      .replace(/^\(?(Easy|Medium|Hard)\)?\s*\n+/i, "")
      .replace(/^(Short|Long|Brief|Extended)\s+\n+/i, "")
      // Also remove if at start with optional space (but preserve if part of question)
      .replace(/^\(?(Easy|Medium|Hard)\)?\s*(Short|Long|Brief|Extended)?\s+(?=\w)/i, "")
      .trim();

    // Detect question type and extract options FIRST (before removing explanation)
    // This ensures we don't accidentally remove options when removing explanation
    let questionType: QuestionType = "short_answer";
    let options: string[] = [];

    // Check for MCQ (has options A, B, C, D)
    // Try multiple patterns to catch different formats
    // First, check if we have at least 2 options (A, B, C, or D) in the text
    const mcqPatterns = [
      /^([A-D])\.\s*(.+)$/gim,  // A. Option text
      /^([A-D])\s*\)\s*(.+)$/gim,  // A) Option text
      /^([A-D])\s+\)\s*(.+)$/gim,  // A ) Option text (with space)
      /^\s*([A-D])\.\s*(.+)$/gim,  // A. Option text (with leading whitespace)
      /^\s*([A-D])\s*\)\s*(.+)$/gim,  // A) Option text (with leading whitespace)
    ];

    let mcqMatches: RegExpMatchArray | null = null;
    for (const pattern of mcqPatterns) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      mcqMatches = questionText.match(pattern);
      if (mcqMatches && mcqMatches.length >= 2) {
        // Verify we have at least 2 different option letters
        const optionLetters = new Set(
          mcqMatches.map(m => {
            const letterMatch = m.match(/^([A-D])/i);
            return letterMatch ? letterMatch[1].toUpperCase() : null;
          }).filter(Boolean)
        );
        
        if (optionLetters.size >= 2) {
          questionType = "mcq";
          options = mcqMatches.map((m) => m.trim());
          // Remove options from question text to get just the question
          // Try all patterns to remove options
          questionText = questionText
            .replace(/^\s*[A-D]\.\s*.+$/gim, "")
            .replace(/^\s*[A-D]\s*\)\s*.+$/gim, "")
            .replace(/^\s*[A-D]\s+\)\s*.+$/gim, "")
            .trim();
          break;
        }
      }
    }

    if (questionType !== "mcq") {
      // Check for True/False
      const tfPattern = /True\s*\/\s*False/i;
      if (tfPattern.test(questionText)) {
        questionType = "true_false";
        options = ["True", "False"];
        // Remove "True / False" from question text
        questionText = questionText.replace(/True\s*\/\s*False/i, "").trim();
      }
    }

    // NOW remove explanation/rationale section from question text (after we've extracted options)
    // Try multiple patterns to catch different formats
    questionText = questionText
      // Remove everything from "Rationale:" onwards (including the label)
      .replace(/\n\s*(?:Rationale|Justification|Explanation):\s*[\s\S]*$/i, "")
      // Remove standalone Rationale/Justification/Explanation lines
      .replace(/^(?:Rationale|Justification|Explanation):\s*[\s\S]*$/gim, "")
      // Remove Rationale/Justification/Explanation that appears mid-text (with newline before)
      .replace(/\n\s*(?:Rationale|Justification|Explanation)\s*:?\s*[\s\S]*$/i, "")
      // Remove if it appears at the start of a line anywhere
      .replace(/^\s*(?:Rationale|Justification|Explanation):\s*.*$/gim, "")
      .trim();

    // Clean up question text (remove extra whitespace, normalize)
    questionText = questionText.replace(/\n{3,}/g, "\n\n").trim();

    // Final cleanup: Remove any remaining metadata tags at the start
    // Remove patterns like "(Medium) Short" or "Medium Short" at the beginning
    questionText = questionText
      .replace(/^\(?(Easy|Medium|Hard)\)?\s*(Short|Long|Brief|Extended)?\s*/i, "")
      .replace(/^(Short|Long|Brief|Extended)\s*\(?(Easy|Medium|Hard)\)?\s*/i, "")
      .trim();

    // Only add question if we have meaningful content (more than just tags)
    const isOnlyTags = /^\(?(Easy|Medium|Hard)\)?\s*(Short|Long|Brief|Extended)?\s*$/i.test(questionText);
    
    if (questionText.length > 5 && !isOnlyTags) {
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
  
  // If no questions found with "Question X:" format, try numbered list format (1., 2., etc.)
  // This is common in quiz content
  if (questions.length === 0 && questionsSection) {
    // Improved regex to capture full question content including multi-line questions
    // Match from number to next number or section header
    const numberedListRegex = /^(\d+)\.\s*([\s\S]*?)(?=^\d+\.\s+|^##\s+Answer\s+Key|^##\s+Overview|^##\s+Questions|^##\s+Quiz\s+Items|$)/gim;
    let numberedMatch;
    let questionNum = 1;
    
    while ((numberedMatch = numberedListRegex.exec(questionsSection)) !== null) {
      let questionContent = numberedMatch[2].trim();
      
      // Remove the number prefix if it was captured in the content
      questionContent = questionContent.replace(/^\d+\.\s*/, "").trim();
      
      // Skip if this looks like it's in the Answer Key section or is not a question
      if (questionContent.toLowerCase().includes("answer key") || 
          questionContent.toLowerCase().startsWith("correct answer") ||
          questionContent.length < 10) { // Too short to be a question
        continue;
      }
      
      let correctAnswer = "";
      let explanation = "";

      // Try to find correct answer in the question content
      let correctAnswerMatch = questionContent.match(
        /Correct\s+Answer:\s*([^\n\r]+)/i
      );
      if (correctAnswerMatch) {
        let answerLine = correctAnswerMatch[1].trim();
        const letterMatch = answerLine.match(/^([A-D])[\.\)]?\s*/i);
        if (letterMatch) {
          correctAnswer = letterMatch[1].toUpperCase();
        } else {
          const tfMatch = answerLine.match(/^(True|False)/i);
          if (tfMatch) {
            correctAnswer = tfMatch[1].charAt(0).toUpperCase() + tfMatch[1].slice(1).toLowerCase();
          } else {
            correctAnswer = answerLine.split(/[\.\)]\s*(?:Rationale|Justification|Explanation)/i)[0].trim();
          }
        }
      }
      
      // Look for answer in Answer Key section if not found
      if (!correctAnswer) {
        const answerKeyMatch = content.match(/##\s+Answer\s+Key\s*([\s\S]*?)(?=##|$)/i);
        if (answerKeyMatch) {
          const answerKeyContent = answerKeyMatch[1];
          // Try to find answer for this question number
          const answerForQuestion = answerKeyContent.match(
            new RegExp(`${questionNum}[\.\)]?\\s*([\\s\\S]*?)(?=\\d+[\.\\)]|$)`, 'i')
          );
          if (answerForQuestion) {
            const answerText = answerForQuestion[1].trim();
            const letterMatch = answerText.match(/^([A-D])[\.\)]?\s*/i);
            if (letterMatch) {
              correctAnswer = letterMatch[1].toUpperCase();
            } else {
              // Extract first line as answer
              correctAnswer = answerText.split(/\n/)[0].trim();
            }
          }
        }
      }

      // Extract explanation
      const explanationMatch = questionContent.match(
        /(?:Rationale|Justification|Explanation):\s*([\s\S]*?)(?=Question\s+\d+:|Correct\s+Answer:|$)/i
      );
      if (explanationMatch) {
        explanation = explanationMatch[1]
          .replace(/^(?:Rationale|Justification|Explanation):\s*/i, "")
          .trim();
      }

      // Remove correct answer and explanation from question text
      let questionText = questionContent
        .replace(/Correct\s+Answer:.*$/gim, "")
        .replace(/Answer:.*$/gim, "")
        .replace(/Solution:.*$/gim, "")
        .trim();

      questionText = questionText
        .replace(/\n\s*(?:Rationale|Justification|Explanation):\s*[\s\S]*$/i, "")
        .replace(/^(?:Rationale|Justification|Explanation):\s*[\s\S]*$/gim, "")
        .trim();

      // Remove difficulty and type tags at the start - handle patterns like:
      // "(Medium) Short", "Medium Short", "Short (Medium)", etc.
      questionText = questionText
        .replace(/^\(?(Easy|Medium|Hard)\)?\s*(Short|Long|Brief|Extended)?\s*/i, "")
        .replace(/^(Short|Long|Brief|Extended)\s*\(?(Easy|Medium|Hard)\)?\s*/i, "")
        .replace(/^\(?(Easy|Medium|Hard)\)?\s*/i, "")
        .replace(/^(Short|Long|Brief|Extended)\s+/i, "")
        .trim();

      // Detect question type and extract options
      let questionType: QuestionType = "short_answer";
      let options: string[] = [];

      // Check for MCQ
      const mcqPatterns = [
        /^([A-D])\.\s*(.+)$/gim,
        /^([A-D])\s*\)\s*(.+)$/gim,
        /^\s*([A-D])\.\s*(.+)$/gim,
      ];

      let mcqMatches: RegExpMatchArray | null = null;
      for (const pattern of mcqPatterns) {
        pattern.lastIndex = 0;
        mcqMatches = questionText.match(pattern);
        if (mcqMatches && mcqMatches.length >= 2) {
          const optionLetters = new Set(
            mcqMatches.map(m => {
              const letterMatch = m.match(/^([A-D])/i);
              return letterMatch ? letterMatch[1].toUpperCase() : null;
            }).filter(Boolean)
          );
          
          if (optionLetters.size >= 2) {
            questionType = "mcq";
            options = mcqMatches.map((m) => m.trim());
            questionText = questionText
              .replace(/^\s*[A-D]\.\s*.+$/gim, "")
              .replace(/^\s*[A-D]\s*\)\s*.+$/gim, "")
              .trim();
            break;
          }
        }
      }

      if (questionType !== "mcq") {
        const tfPattern = /True\s*\/\s*False/i;
        if (tfPattern.test(questionText)) {
          questionType = "true_false";
          options = ["True", "False"];
          questionText = questionText.replace(/True\s*\/\s*False/i, "").trim();
        }
      }

      questionText = questionText.replace(/\n{3,}/g, "\n\n").trim();

      // Final cleanup: Remove any remaining metadata tags at the start
      // Remove patterns like "(Medium) Short" or "Medium Short" at the beginning
      questionText = questionText
        .replace(/^\(?(Easy|Medium|Hard)\)?\s*(Short|Long|Brief|Extended)?\s*/i, "")
        .replace(/^(Short|Long|Brief|Extended)\s*\(?(Easy|Medium|Hard)\)?\s*/i, "")
        .trim();

      // Only add question if we have meaningful content (more than just tags)
      if (questionText.length > 5 && !questionText.match(/^\(?(Easy|Medium|Hard)\)?\s*(Short|Long)?\s*$/i)) {
        questions.push({
          id: `question-${questionNum}`,
          type: questionType,
          question: questionText,
          options: options.length > 0 ? options : undefined,
          correctAnswer,
          explanation: explanation || undefined,
        });
        questionNum++;
      }
    }
  }

  // Extract overview and learning objectives if present
  let overview = "";
  let learningObjectives: string[] = [];

  const overviewMatch = content.match(
    /##\s+Assessment\s+Overview\s*([\s\S]*?)(?=##|$)/i
  );
  if (overviewMatch) {
    overview = overviewMatch[1].trim();
  }

  const objectivesMatch = content.match(
    /##\s+Learning\s+Objectives\s*([\s\S]*?)(?=##|$)/i
  );
  if (objectivesMatch) {
    const objectivesText = objectivesMatch[1];
    // Extract bullet points
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
