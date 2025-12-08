"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock } from "lucide-react";
import { StudentContent } from "@/data/get-student-content";
import { parseAssessment, parseDurationToSeconds, Question } from "./assessment-parser";
import { submitAssessment, submitContentCompletion } from "../action";
import { toast } from "sonner";
import Markdown from "@/components/ui/markdown";
import { ContentPreview } from "@/app/teacher/media-toolkit/_components/content-preview";
import { ImagePreview } from "@/components/ui/image-preview";
import { VideoPreview } from "@/components/ui/video-preview";
import { ComicPreview } from "@/components/ui/comic-preview";
import { SlidePreview } from "@/components/ui/slide-preview";
import { WebSearchPreview } from "@/components/ui/web-search-preview";

interface LearningDialogProps {
  content: StudentContent | null;
  open: boolean;
  onClose: () => void;
  initialResults?: SubmissionResult | null;
  onSubmissionComplete?: (contentId: string, result: SubmissionResult) => void;
}

export interface QuestionResult {
  questionId: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface SubmissionResult {
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  questionResults: QuestionResult[];
}

export function LearningDialog({ content, open, onClose, initialResults, onSubmissionComplete }: LearningDialogProps) {
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = React.useState(0);
  const [timeSpent, setTimeSpent] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);
  const [results, setResults] = React.useState<SubmissionResult | null>(initialResults || null);
  const [startTime, setStartTime] = React.useState<number | null>(null);
  const [contentStartTime] = React.useState<number>(Date.now());
  const timerIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const timeSpentIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const handleSubmitRef = React.useRef<(() => Promise<void>) | undefined>(undefined);

  const isAssessment = content?.contentType === "assessment";
  const duration = content?.duration || content?.metadata;

  // Parse questions when content changes
  React.useEffect(() => {
    if (content && (content.contentType === "assessment" || content.contentType === "quiz")) {
      const parsed = parseAssessment(content.content);
      setQuestions(parsed.questions);
      setCurrentQuestionIndex(0);
      setAnswers({});
      
      // If we have initial results (from previous submission), show them immediately
      if (initialResults) {
        setShowResults(true);
        setResults(initialResults);
      } else {
        setShowResults(false);
        setResults(null);
      }
      
      setTimeSpent(0);
      
      // Initialize timer for assessments (quiz doesn't have timer)
      if (isAssessment && duration && typeof duration === 'string') {
        const seconds = parseDurationToSeconds(duration);
        if (seconds > 0) {
          setTimeRemaining(seconds);
        } else {
          setTimeRemaining(0);
        }
      } else {
        setTimeRemaining(0);
      }
    }
  }, [content, isAssessment, duration, initialResults]);

  // Start timer when dialog opens and has time remaining
  React.useEffect(() => {
    // Clear any existing timers first
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (timeSpentIntervalRef.current) {
      clearInterval(timeSpentIntervalRef.current);
      timeSpentIntervalRef.current = null;
    }

    // Start timer if dialog is open, it's an assessment, has time remaining, and not showing results
    if (open && isAssessment && timeRemaining > 0 && !showResults) {
      setStartTime(Date.now());
      
      // Timer countdown
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Auto-submit when timer reaches 0
            if (handleSubmitRef.current) {
              handleSubmitRef.current();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Track time spent
      timeSpentIntervalRef.current = setInterval(() => {
        setTimeSpent((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (timeSpentIntervalRef.current) {
        clearInterval(timeSpentIntervalRef.current);
        timeSpentIntervalRef.current = null;
      }
    };
  }, [open, isAssessment, timeRemaining, showResults]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleNext = () => {
    const currentQuestion = questions[currentQuestionIndex];
    const currentAnswer = answers[currentQuestion?.id];
    
    // Simple check: require an answer before proceeding
      if (!currentAnswer || currentAnswer.trim() === "") {
      toast.error("Please provide an answer before proceeding");
        return;
    }
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleSubmit = React.useCallback(async () => {
    if (!content) return;

    // Simple check: all questions must have answers
    const unansweredQuestions = questions.filter(
      (q) => !answers[q.id] || answers[q.id].trim() === ""
    );

    if (unansweredQuestions.length > 0) {
      toast.error("Please answer all questions before submitting");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitAssessment({
        contentId: content.id,
        contentType: content.contentType,
        responses: answers,
        timeSpent,
      });

      setResults(result);
      setShowResults(true);
      
      // Notify parent component to update submission map
      if (content && onSubmissionComplete) {
        onSubmissionComplete(content.id, result);
      }
      
      // Clear timers
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (timeSpentIntervalRef.current) {
        clearInterval(timeSpentIntervalRef.current);
      }
    } catch (error) {
      console.error("Error submitting assessment:", error);
      toast.error("Failed to submit assessment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [content, questions, answers, timeSpent, isAssessment]);

  // Store handleSubmit in ref for timer callback
  React.useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  const handleClose = React.useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    if (timeSpentIntervalRef.current) {
      clearInterval(timeSpentIntervalRef.current);
    }
    setShowResults(false);
    setResults(null);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setTimeRemaining(0);
    setTimeSpent(0);
    onClose();
  }, [onClose]);

  // Handle content completion submission
  const handleContentSubmit = React.useCallback(async () => {
    if (!content) return;

    setIsSubmitting(true);
    try {
      const timeSpent = Math.floor((Date.now() - contentStartTime) / 1000);
      const result = await submitContentCompletion(content.id, content.contentType, timeSpent);
      const score = result.score;
      
      // Create submission result object for the callback
      const submissionResult: SubmissionResult = {
        score: score,
        totalQuestions: 0,
        correctCount: 0,
        wrongCount: 0,
        questionResults: [],
      };
      
      // Notify parent component to update submission map
      if (onSubmissionComplete) {
        onSubmissionComplete(content.id, submissionResult);
      }
      
      toast.success(`Content completed! You received ${score} points.`);
      handleClose();
    } catch (error) {
      console.error("Error submitting content:", error);
      toast.error("Failed to submit content. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [content, contentStartTime, handleClose, onSubmissionComplete]);

  // Track time spent for non-assessment content
  React.useEffect(() => {
    if (open && content && content.contentType !== "assessment" && content.contentType !== "quiz") {
      const interval = setInterval(() => {
        setTimeSpent(Math.floor((Date.now() - contentStartTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [open, content, contentStartTime]);

  if (!content) return null;

  // If content is not assessment or quiz, show appropriate preview
  // Note: quiz is handled separately in the assessment flow below
  if (content.contentType !== "assessment" && content.contentType !== "quiz") {
    // Content types that should show submit button
    // Include all content types that can be submitted for completion
    const contentTypesWithSubmit = [
      "lesson_plan", 
      "worksheet", 
      "presentation",
      "image",
      "video",
      "comic",
      "slide",
      "web"
    ];
    // Show submit button if content type supports it AND hasn't been submitted yet
    const shouldShowSubmit = contentTypesWithSubmit.includes(content.contentType) && !initialResults;

    // Parse content for structured types
    let parsedContent: any = null;
    try {
      if (content.contentType === "video" || content.contentType === "slide" || content.contentType === "comic") {
        parsedContent = JSON.parse(content.content);
      }
    } catch {
      // If parsing fails, use raw content
    }

    // Image content
    if (content.contentType === "image") {
      return (
        <ImagePreview
          imageUrl={content.content}
          topic={content.title}
          onSave={shouldShowSubmit ? handleContentSubmit : handleClose}
          onClose={handleClose}
          skipUpload={true}
          buttonText={shouldShowSubmit ? "Submit" : "Close"}
        />
      );
    }

    // Video content
    if (content.contentType === "video") {
      return (
        <VideoPreview
          content={parsedContent || { video_url: content.content }}
          title={content.title}
          onSave={shouldShowSubmit ? handleContentSubmit : handleClose}
          onClose={handleClose}
          buttonText={shouldShowSubmit ? "Submit" : "Close"}
        />
      );
    }

    // Comic content
    if (content.contentType === "comic") {
      return (
        <ComicPreview
          content={parsedContent || { story: content.content }}
          topic={content.title}
          onSave={shouldShowSubmit ? handleContentSubmit : handleClose}
          onClose={handleClose}
          buttonText={shouldShowSubmit ? "Submit" : "Close"}
        />
      );
    }

    // Slide content
    if (content.contentType === "slide") {
      return (
        <SlidePreview
          content={parsedContent || { presentation_url: content.content }}
          onSave={shouldShowSubmit ? handleContentSubmit : handleClose}
          onClose={handleClose}
          buttonText={shouldShowSubmit ? "Submit" : "Close"}
        />
      );
    }

    // Web search content
    if (content.contentType === "web") {
      return (
        <WebSearchPreview
          content={content.content}
          topic={content.title}
          onSave={shouldShowSubmit ? handleContentSubmit : handleClose}
          onClose={handleClose}
          buttonText={shouldShowSubmit ? "Submit" : "Close"}
        />
      );
    }

    // Default content preview (lesson_plan, worksheet, presentation, etc.)
    // Use ContentPreview but add a submit button at the bottom if needed
    if (contentTypesWithSubmit.includes(content.contentType)) {
      // Show preview with or without submit button based on submission status
      return (
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent className="!w-[1200px] !max-w-[1200px] max-w-[95vw] !h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{content.title}</DialogTitle>
              <DialogDescription>
                {content.contentType === "lesson_plan" && "View the lesson plan"}
                {content.contentType === "presentation" && "View the presentation"}
                {content.contentType === "worksheet" && "View the worksheet"}
                {initialResults && `Completed - Score: ${initialResults.score.toFixed(1)}%`}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 border rounded-lg p-6 bg-muted/50 flex-1 overflow-y-auto">
              <Markdown content={content.content} />
            </div>
            {shouldShowSubmit && (
              <div className="flex justify-end mt-4 pt-4 border-t flex-shrink-0">
                <Button 
                  onClick={handleContentSubmit} 
                  disabled={isSubmitting}
                  size="lg"
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            )}
            {!shouldShowSubmit && (
              <div className="flex justify-end mt-4 pt-4 border-t flex-shrink-0">
                <Button onClick={handleClose} size="lg">
                  Close
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      );
    }

    // For other content types, use ContentPreview without submit
    return (
      <ContentPreview
        content={content.content}
        title={content.title}
        onClose={handleClose}
      />
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const allAnswered = questions.every((q) => answers[q.id] && answers[q.id].trim() !== "");
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  // Results Screen
  if (showResults && results) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="!w-[1200px] !max-w-[1200px] max-w-[95vw] !h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Assessment Results</DialogTitle>
            <DialogDescription>
              Review your answers and see the correct solutions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4 flex-1 overflow-y-auto">
            {/* Score Display */}
            <div className="text-center p-6 bg-muted/50 rounded-lg border-2 border-primary">
              <div className="text-4xl font-bold text-primary mb-2">
                {results.score.toFixed(1)}%
              </div>
              <div className="text-lg text-muted-foreground">
                {results.correctCount} correct, {results.wrongCount} wrong out of {results.totalQuestions} total
              </div>
            </div>

            {/* Questions Review */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Question Review</h3>
              {questions.map((question, index) => {
                const result = results.questionResults.find(
                  (r) => r.questionId === question.id
                );
                if (!result) return null;

                const isCorrect = result.isCorrect;

                return (
                  <div
                    key={question.id}
                    className={`p-4 rounded-lg border-2 ${
                      isCorrect
                        ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                        : "border-red-500 bg-red-50 dark:bg-red-950/20"
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {isCorrect ? (
                        <CheckCircle2 className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-600 mt-1 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="font-semibold mb-2 flex items-center gap-2">
                          <span>Question {index + 1}</span>
                          <span className="text-xs font-normal text-muted-foreground px-2 py-1 bg-muted rounded">
                            {question.type === "mcq" ? "Multiple Choice" : 
                             question.type === "true_false" ? "True or False" : 
                             "Short Answer"}
                          </span>
                        </div>
                        <div className="mb-4">
                          <Markdown content={question.question} />
                        </div>

                        {/* Student Answer */}
                        <div className="mb-2">
                          <div className="text-sm font-medium text-muted-foreground mb-1">
                            Your Answer:
                          </div>
                          <div
                            className={`p-2 rounded ${
                              isCorrect
                                ? "bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100"
                                : "bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100"
                            }`}
                          >
                            {result.studentAnswer || "(No answer provided)"}
                          </div>
                        </div>

                        {/* Correct Answer - Always show after submission */}
                        <div className="mb-2">
                          <div className="text-sm font-medium text-muted-foreground mb-1">
                            Correct Answer:
                          </div>
                          <div className="p-2 rounded bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100">
                            {(() => {
                              // For MCQ, show the full option text instead of just the letter
                              if (question.type === "mcq" && question.options) {
                                const correctLetter = result.correctAnswer.trim().toUpperCase();
                                const correctOption = question.options.find(
                                  (opt) => opt.trim().charAt(0).toUpperCase() === correctLetter
                                );
                                return correctOption || result.correctAnswer || "(No correct answer provided)";
                              }
                              // For other types, show the answer as is
                              return result.correctAnswer || "(No correct answer provided)";
                            })()}
                          </div>
                        </div>

                        {/* Explanation - Remove "Rationale" and "Justification" labels */}
                        {result.explanation && (
                          <div className="mt-3">
                            <div className="text-sm font-medium text-muted-foreground mb-1">
                              Explanation:
                            </div>
                            <div className="p-2 rounded bg-muted text-sm">
                              <Markdown 
                                content={result.explanation
                                  .replace(/^(?:Rationale|Justification):\s*/i, "")
                                  .trim()
                                } 
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end flex-shrink-0 pt-4 border-t">
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Assessment/Quiz Taking Screen - Check if questions were parsed
  // Only show this error if we're not showing results (i.e., it's a new attempt)
  if (questions.length === 0 && !showResults) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="!w-[1200px] !max-w-[1200px] max-w-[95vw] !h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>No Questions Found</DialogTitle>
            <DialogDescription>
              This {content.contentType === "assessment" ? "assessment" : "quiz"} does not contain any questions in the expected format. 
              Please check the content format or contact your teacher.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={handleClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  // If no questions but we have results, show results instead
  if (questions.length === 0 && showResults && results) {
    // This shouldn't happen, but handle it gracefully
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="!w-[1200px] !max-w-[1200px] max-w-[95vw] !h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Assessment Results</DialogTitle>
            <DialogDescription>
              Review your previous submission
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 p-6 bg-muted/50 rounded-lg flex-1 overflow-y-auto">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">
                {results.score.toFixed(1)}%
              </div>
              <div className="text-lg text-muted-foreground">
                Content completed
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-4 pt-4 border-t flex-shrink-0">
            <Button onClick={handleClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
      <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="!w-[1200px] !max-w-[1200px] max-w-[95vw] !h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>{content.title}</DialogTitle>
            {(isAssessment || content.contentType === "quiz") && timeRemaining > 0 && (
              <div className="flex items-center gap-2 text-lg font-semibold text-primary">
                <Clock className="h-5 w-5" />
                {formatTime(timeRemaining)}
              </div>
            )}
          </div>
          <DialogDescription>
            {isAssessment ? "Complete the assessment within the time limit" : "Answer all questions to complete the quiz"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4 flex-1 overflow-y-auto">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span>
              {Object.keys(answers).length} of {questions.length} answered
            </span>
          </div>

          {/* Current Question */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted rounded">
                {currentQuestion.type === "mcq" ? "Multiple Choice" : 
                 currentQuestion.type === "true_false" ? "True or False" : 
                 "Short Answer"}
              </span>
            </div>
            <div className="font-semibold text-lg">
              <Markdown content={currentQuestion.question} />
            </div>

            {/* Render based on question type */}
            {currentQuestion.type === "mcq" && currentQuestion.options && (
              <RadioGroup
                value={answers[currentQuestion.id] || ""}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                required
              >
                {currentQuestion.options.map((option, idx) => {
                  const letter = option.charAt(0);
                  return (
                    <div key={idx} className="flex items-center space-x-2">
                      <RadioGroupItem value={letter} id={`option-${idx}`} required />
                      <Label
                        htmlFor={`option-${idx}`}
                        className="flex-1 cursor-pointer py-2"
                      >
                        {option}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            )}

            {currentQuestion.type === "true_false" && (
              <RadioGroup
                value={answers[currentQuestion.id] || ""}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="True" id="true-option" required />
                  <Label htmlFor="true-option" className="cursor-pointer py-2">
                    True
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="False" id="false-option" required />
                  <Label htmlFor="false-option" className="cursor-pointer py-2">
                    False
                  </Label>
                </div>
              </RadioGroup>
            )}

            {currentQuestion.type === "short_answer" && (
              <Textarea
                value={answers[currentQuestion.id] || ""}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                placeholder="Enter your answer here..."
                className="min-h-[100px]"
                required
              />
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t flex-shrink-0">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-2">
              {isLastQuestion ? (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || (isAssessment && timeRemaining === 0)}
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              ) : (
                <Button 
                  onClick={handleNext}
                  disabled={
                    (currentQuestion.type === "mcq" || currentQuestion.type === "true_false") &&
                    (!answers[currentQuestion.id] || answers[currentQuestion.id].trim() === "")
                  }
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

