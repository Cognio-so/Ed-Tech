"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { 
  Eye, 
  X, 
  FileText, 
  Presentation, 
  Image, 
  Video, 
  BookOpen, 
  Search, 
  FileCheck,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Clock,
  Trophy,
  Star,
  Loader2
} from "lucide-react";
import ContentPreview from "@/components/ui/content-preview";
import AssessmentPreview from "@/components/assessment-preview";
import PPTXViewer from "@/components/pptx-viewer";
import VideoPreview from "@/components/ui/video-preview";
import { CarouselWithControls } from "@/components/ui/carousel";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownStyles } from "../Markdown";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateStudentProgress } from '@/app/(home)/student/learning-library/action';

// Add the same content type configuration as LibraryDialog
const contentTypes = {
  content: { label: "Content", icon: FileText, color: "bg-blue-100" },
  slides: { label: "Slides", icon: Presentation, color: "bg-purple-100" },
  comic: { label: "Comics", icon: BookOpen, color: "bg-green-100" },
  image: { label: "Images", icon: Image, color: "bg-pink-100" },
  video: { label: "Videos", icon: Video, color: "bg-red-100" },
  assessment: { label: "Assessments", icon: FileCheck, color: "bg-yellow-100" },
  websearch: { label: "Web Search", icon: Search, color: "bg-indigo-100" }
};

// Add this new interactive assessment component
const InteractiveAssessment = ({ assessment, onAnswerChange, studentAnswers, onSubmit, hideSolutions = true }) => {
  // Parse assessment content to separate questions and solutions
  const parseAssessmentContent = (content) => {
    if (!content) return { questions: [], solutions: [] };

    const lines = content.split('\n');
    const questions = [];
    const solutions = [];
    let currentQuestion = null;
    let inSolutionsSection = false;
    let questionCounter = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if we're entering solutions section
      if (line === '---' || line.includes('**Solutions**') || line.includes('**الحلول**')) {
        inSolutionsSection = true;
        continue;
      }

      if (inSolutionsSection) {
        // Parse solution lines
        if (line.match(/^\d+\./)) {
          solutions.push(line);
        }
      } else {
        // Look for question patterns - both numbered and unnumbered
        const isQuestionStart = line.match(/^\d+\./) || 
                               line.match(/^[A-Z]\./) ||
                               line.match(/^[أ-ي]\./) || // Arabic letters
                               (line.includes('؟') && line.length > 10) || // Arabic question mark
                               (line.includes('?') && line.length > 10) || // English question mark
                               line.match(/^السؤال/) || // Arabic "Question"
                               line.match(/^Question/); // English "Question"

        if (isQuestionStart) {
          // Save previous question if exists
          if (currentQuestion) {
            questions.push(currentQuestion);
          }
          
          // Start new question
          const questionText = line.replace(/^(\d+\.|[A-Z]\.|[أ-ي]\.|السؤال\s*\d*:?\s*|Question\s*\d*:?\s*)/, '');
          currentQuestion = {
            number: questionCounter.toString(),
            text: questionText,
            type: 'unknown',
            options: []
          };
          questionCounter++;

          // Check if this is a True/False question
          if (questionText.toLowerCase().includes('true or false') || 
              questionText.toLowerCase().includes('true/false') ||
              questionText.includes('صح أم خطأ') ||
              questionText.includes('صحيح أم خاطئ')) {
            currentQuestion.type = 'true_false';
            currentQuestion.options = ['True', 'False'];
          } else if (questionText.toLowerCase().includes('briefly explain') ||
                     questionText.toLowerCase().includes('explain') ||
                     questionText.toLowerCase().includes('describe') ||
                     questionText.toLowerCase().includes('what is meant by') ||
                     questionText.toLowerCase().includes('how') ||
                     questionText.toLowerCase().includes('solve for') ||
                     questionText.toLowerCase().includes('simplify') ||
                     questionText.toLowerCase().includes('what is the value') ||
                     questionText.toLowerCase().includes('calculate') ||
                     questionText.toLowerCase().includes('find') ||
                     questionText.toLowerCase().includes('determine') ||
                     questionText.toLowerCase().includes('show that') ||
                     questionText.toLowerCase().includes('prove that') ||
                     questionText.includes('اشرح') ||
                     questionText.includes('وضح') ||
                     questionText.includes('ما المقصود')) {
            currentQuestion.type = 'short_answer';
          } else {
            currentQuestion.type = 'mcq';
          }
        } else if (currentQuestion && line.match(/^[A-D]\)/)) {
          // This is an option for the current MCQ question
          currentQuestion.options.push(line);
        } else if (currentQuestion && currentQuestion.type === 'short_answer' && line && !line.match(/^(\d+\.|[A-Z]\.|[أ-ي]\.|السؤال|Question)/)) {
          // This might be additional text for the short answer question
          currentQuestion.text += ' ' + line;
        }
      }
    }

    // Don't forget the last question
    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    // If no questions were found with the above logic, try to extract content as a single question
    if (questions.length === 0 && content.trim()) {
      // Check if this is a lesson plan rather than an assessment
      if (content.includes('**عنوان الاختبار**') || content.includes('**Test Title**')) {
        // This is an assessment header, but no questions found
        return { questions: [], solutions: [] };
      } else {
        // Treat the entire content as a single question for completion
        questions.push({
          number: '1',
          text: 'Review the content and mark as complete',
          type: 'content_review',
          options: []
        });
      }
    }

    return { questions, solutions };
  };

  // Try multiple possible content fields - same as library-dialog.jsx
  const assessmentContent = assessment?.content || 
                           assessment?.generatedContent || 
                           assessment?.assessmentContent || 
                           assessment?.instruction || '';

  const { questions, solutions } = parseAssessmentContent(assessmentContent);
  
  // Debug logging
  console.log('=== InteractiveAssessment Debug ===');
  console.log('Assessment object:', assessment);
  console.log('Assessment content found:', assessmentContent?.substring(0, 200));
  console.log('Content fields:', {
    content: assessment?.content,
    generatedContent: assessment?.generatedContent,
    assessmentContent: assessment?.assessmentContent,
    instruction: assessment?.instruction,
    topic: assessment?.topic
  });
  console.log('Parsed questions:', questions);
  console.log('Student answers:', studentAnswers);

  const handleAnswerChange = (questionNumber, answer) => {
    console.log('Answer changed:', questionNumber, answer);
    // Only update if questionNumber is a valid string/number
    if (questionNumber && typeof questionNumber === 'string' && questionNumber !== '[object Object]') {
      const newAnswers = { ...studentAnswers, [questionNumber]: answer };
      console.log('New answers object:', newAnswers);
      onAnswerChange(questionNumber, answer);
    }
  };

  const handleSubmit = async () => {
    if (!questions || questions.length === 0) {
      console.error('No questions found in assessment');
      return;
    }

    let correctAnswers = 0;
    const totalQuestions = questions.length;

    console.log('Submitting assessment with answers:', studentAnswers);

    questions.forEach((question, index) => {
      const studentAnswer = studentAnswers[question.number];
      const solutionLine = solutions.find(s => s.startsWith(`${question.number}.`));
      
      console.log(`Question ${question.number}:`, { studentAnswer, solutionLine });

      if (!solutionLine) {
        console.warn(`No solution found for question ${question.number}`);
        return;
      }

      const correctAnswer = solutionLine.replace(/^\d+\.\s*/, '').trim();
      let isCorrect = false;

      if (question.type === 'mcq') {
        // For MCQ, compare the selected option
        isCorrect = studentAnswer === correctAnswer;
      } else if (question.type === 'true_false') {
        // For True/False, compare the boolean value
        isCorrect = studentAnswer && studentAnswer.toLowerCase() === correctAnswer.toLowerCase();
      } else if (question.type === 'short_answer') {
        // For short answer, do a more flexible comparison
        const studentLower = (studentAnswer || '').toLowerCase().trim();
        const correctLower = correctAnswer.toLowerCase().trim();
        isCorrect = studentLower === correctLower || correctLower.includes(studentLower);
      }
     
      console.log(`Question ${question.number} result:`, { isCorrect, studentAnswer, correctAnswer });
      
      if (isCorrect) {
        correctAnswers++;
      }
    });

    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    
    console.log('Final score:', { score, correctAnswers, totalQuestions });
    
    // Call the parent's onSubmit function with the calculated score
    if (onSubmit) {
      await onSubmit(score, correctAnswers, totalQuestions, studentAnswers);
    }
  };

  const renderQuestion = (question, index) => {
    const studentAnswer = studentAnswers[question.number] || '';

    return (
      <div key={index} className="border rounded-lg p-6 bg-white dark:bg-gray-800 shadow-sm mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Badge variant="outline" className="mt-1">
            {question.number}
          </Badge>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Badge 
                variant={question.type === 'mcq' ? 'default' : 
                        question.type === 'true_false' ? 'secondary' : 'outline'}
                className="text-xs"
              >
                {question.type === 'mcq' ? 'MCQ' : 
                 question.type === 'true_false' ? 'True/False' : 'Short Answer'}
              </Badge>
            </div>
            <p className="text-foreground mb-4 font-medium">{question.text}</p>
            
            {question.type === 'mcq' && question.options.length > 0 && (
              <RadioGroup
                value={studentAnswer}
                onValueChange={(value) => handleAnswerChange(question.number, value)}
                className="space-y-2"
              >
                {question.options.map((option, optIndex) => (
                  <div key={optIndex} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`q${question.number}-opt${optIndex}`} />
                    <Label htmlFor={`q${question.number}-opt${optIndex}`} className="text-sm cursor-pointer text-foreground">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {question.type === 'mcq' && question.options.length === 0 && (
              <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">
                <p>This question appears to be missing options. Please contact your teacher.</p>
              </div>
            )}

            {question.type === 'true_false' && (
              <RadioGroup
                value={studentAnswer}
                onValueChange={(value) => handleAnswerChange(question.number, value)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="True" id={`q${question.number}-true`} />
                  <Label htmlFor={`q${question.number}-true`} className="text-sm cursor-pointer text-foreground">
                    True
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="False" id={`q${question.number}-false`} />
                  <Label htmlFor={`q${question.number}-false`} className="text-sm cursor-pointer text-foreground">
                    False
                  </Label>
                </div>
              </RadioGroup>
            )}

            {question.type === 'short_answer' && (
              <Textarea
                placeholder="Type your answer here..."
                value={studentAnswer}
                onChange={(e) => handleAnswerChange(question.number, e.target.value)}
                className="min-h-[100px]"
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6 flex-shrink-0">
        <h3 className="text-lg font-semibold text-foreground">{assessment.title}</h3>
        <p className="text-sm text-muted-foreground">{assessment.topic}</p>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
          <Badge variant="outline">{assessment.subject}</Badge>
          <Badge variant="secondary">{assessment.grade}</Badge>
          <Badge variant="outline">{assessment.difficulty}</Badge>
        </div>
      </div>
      
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="space-y-4">
          {questions.length > 0 ? questions.map((question, index) => renderQuestion(question, index)) : (
            <div className="text-center py-8 text-muted-foreground">
              <div>
                <FileCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-sm">No assessment questions found</p>
                <p className="text-xs text-muted-foreground mt-2">
                  This appears to be a lesson plan rather than an assessment.
                </p>
                
                {/* Show available content from description and topic */}
                {(assessment.description || assessment.topic) && (
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg text-left max-w-2xl mx-auto">
                    <h4 className="font-medium mb-2 text-foreground">Content:</h4>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {assessment.description && (
                        <p className="text-sm text-foreground mb-2">
                          <strong>Description:</strong> {assessment.description}
                        </p>
                      )}
                      {assessment.topic && (
                        <p className="text-sm text-foreground">
                          <strong>Topic:</strong> {assessment.topic}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="mt-6">
                  <p className="text-xs text-muted-foreground">
                    Since no questions are available, you can mark this content as completed.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {questions.length > 0 && (
        <div className="mt-6 flex justify-center flex-shrink-0">
          <Button 
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 px-8"
            disabled={Object.keys(studentAnswers).length < questions.length}
          >
            <FileCheck className="mr-2 h-4 w-4" />
            Submit Assessment
          </Button>
        </div>
      )}
      
      {/* Show "Mark as Complete" button when no questions are found */}
      {questions.length === 0 && (
        <div className="mt-6 flex justify-center flex-shrink-0">
          <Button 
            onClick={() => {
              // Call the parent's completion handler with a default score
              if (onSubmit) {
                onSubmit(100, 1, 1, {}); // 100% score for content-only completion
              }
            }}
            className="bg-green-600 hover:bg-green-700 px-8"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Mark as Complete
          </Button>
        </div>
      )}
    </div>
  );
};

// Add this new component before the InteractiveAssessment component
const AssessmentReview = ({ assessment, studentAnswers, score, correctAnswers, totalQuestions, onClose }) => {
  // Parse assessment content to separate questions and solutions
  const parseAssessmentContent = (content) => {
    if (!content) return { questions: [], solutions: [] };

    const lines = content.split('\n');
    const questions = [];
    const solutions = [];
    let currentQuestion = null;
    let inSolutionsSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if we're entering solutions section
      if (line === '---') {
        inSolutionsSection = true;
        continue;
      }

      if (inSolutionsSection) {
        // Skip the "Solutions" header
        if (line.includes('**Solutions**') || line.includes('**الحلول**')) {
          continue;
        }
        
        // Parse solution lines
        if (line.match(/^\d+\./)) {
          solutions.push(line);
        }
      } else {
        // Parse question lines
        if (line.match(/^\d+\./) && !line.includes('A)') && !line.includes('B)') && !line.includes('C)') && !line.includes('D)')) {
          // Save previous question if exists
          if (currentQuestion) {
            questions.push(currentQuestion);
          }
          
          // Start new question
          const questionText = line.replace(/^\d+\.\s*/, '');
          currentQuestion = {
            number: line.match(/^(\d+)\./)[1],
            text: questionText,
            type: 'unknown',
            options: []
          };

          // Check if this is a True/False question
          if (questionText.toLowerCase().includes('true or false') || 
              questionText.toLowerCase().includes('true/false')) {
            currentQuestion.type = 'true_false';
            currentQuestion.options = ['True', 'False'];
          } else if (questionText.toLowerCase().includes('briefly explain') ||
                     questionText.toLowerCase().includes('explain') ||
                     questionText.toLowerCase().includes('describe')) {
            currentQuestion.type = 'short_answer';
          } else {
            currentQuestion.type = 'mcq';
          }
        } else if (currentQuestion && line.match(/^[A-D]\)/)) {
          // This is an option for the current MCQ question
          currentQuestion.options.push(line);
        } else if (currentQuestion && currentQuestion.type === 'short_answer' && line && !line.match(/^\d+\./)) {
          // This might be additional text for the short answer question
          currentQuestion.text += ' ' + line;
        }
      }
    }

    // Don't forget the last question
    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    return { questions, solutions };
  };

  const { questions, solutions } = parseAssessmentContent(assessment?.content || assessment?.generatedContent || assessment?.assessmentContent);

  const renderQuestionReview = (question, index) => {
    const studentAnswer = studentAnswers[question.number] || '';
    const solutionLine = solutions.find(s => s.startsWith(`${question.number}.`));
    const correctAnswer = solutionLine ? solutionLine.replace(/^\d+\.\s*/, '').trim() : '';
    
    // Determine if the answer is correct
    let isCorrect = false;
    if (question.type === 'mcq') {
      isCorrect = studentAnswer === correctAnswer;
    } else if (question.type === 'true_false') {
      isCorrect = studentAnswer && studentAnswer.toLowerCase() === correctAnswer.toLowerCase();
    } else if (question.type === 'short_answer') {
      const studentLower = (studentAnswer || '').toLowerCase().trim();
      const correctLower = correctAnswer.toLowerCase().trim();
      isCorrect = studentLower === correctLower || correctLower.includes(studentLower);
    }

    return (
      <div key={index} className={`border rounded-lg p-6 shadow-sm mb-6 ${
        isCorrect ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      }`}>
        <div className="flex items-start gap-3 mb-4">
          <Badge variant="outline" className="mt-1">
            {question.number}
          </Badge>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Badge 
                variant={question.type === 'mcq' ? 'default' : 
                        question.type === 'true_false' ? 'secondary' : 'outline'}
                className="text-xs"
              >
                {question.type === 'mcq' ? 'MCQ' : 
                 question.type === 'true_false' ? 'True/False' : 'Short Answer'}
              </Badge>
              <Badge 
                variant={isCorrect ? 'default' : 'destructive'}
                className={`text-xs ${isCorrect ? 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200'}`}
              >
                {isCorrect ? '✓ Correct' : '✗ Incorrect'}
              </Badge>
            </div>
            <p className="text-foreground mb-4 font-medium">{question.text}</p>
            
            {/* Show student's answer */}
            <div className="mb-3">
              <p className="text-sm font-medium text-foreground mb-1">Your Answer:</p>
              <div className={`p-3 rounded-md ${
                isCorrect ? 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200'
              }`}>
                {studentAnswer || 'No answer provided'}
              </div>
            </div>

            {/* Show correct answer */}
            <div className="mb-3">
              <p className="text-sm font-medium text-foreground mb-1">Correct Answer:</p>
              <div className="p-3 rounded-md bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200">
                {correctAnswer}
              </div>
            </div>

            {/* Show options for MCQ */}
            {question.type === 'mcq' && question.options.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-foreground mb-2">Options:</p>
                <div className="space-y-1">
                  {question.options.map((option, optIndex) => (
                    <div key={optIndex} className={`text-sm p-2 rounded ${
                      option === correctAnswer ? 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 font-medium' :
                      option === studentAnswer && !isCorrect ? 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                    }`}>
                      {option}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with score */}
      <div className="text-center mb-6 flex-shrink-0">
        <div className="mb-4">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
            score >= 80 ? 'bg-green-100 dark:bg-green-800' : 
            score >= 60 ? 'bg-yellow-100 dark:bg-yellow-800' : 'bg-red-100 dark:bg-red-800'
          }`}>
            <Trophy className={`h-10 w-10 ${
              score >= 80 ? 'text-green-600 dark:text-green-400' : 
              score >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
            }`} />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-2">Assessment Review</h3>
          <p className="text-3xl font-bold text-foreground mb-2">{score}%</p>
          <p className="text-foreground mb-4">
            {score >= 80 ? 'Excellent work!' : 
             score >= 60 ? 'Good job!' : 'Keep practicing!'}
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-foreground">
            <Badge variant="outline">{assessment.subject}</Badge>
            <Badge variant="secondary">{assessment.grade}</Badge>
            <Badge variant="outline">{assessment.difficulty}</Badge>
          </div>
        </div>
      </div>
      
      {/* Questions review */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="space-y-4">
          {questions.length > 0 ? questions.map((question, index) => renderQuestionReview(question, index)) : (
            <div className="text-center py-8 text-muted-foreground">
              <div>
                <FileCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-sm">No questions found in assessment content</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Close button */}
      <div className="mt-6 flex justify-center flex-shrink-0">
        <Button onClick={onClose} variant="outline" className="px-8">
          Close Review
        </Button>
      </div>
    </div>
  );
};

export default function StartLearning({ 
  isOpen, 
  onClose, 
  content, 
  onComplete,
  studentProgress = null
}) {
  
  
  const contentId = content?.id || content?._id;
  const contentType = content?.resourceType || content?.type || content?.contentType;
  


  // Show loading state if no content but dialog is open
  if (!content) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-black dark:text-white">Loading content...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!contentId || !contentType) {
    console.error('Missing required fields:', { contentId, contentType, content });
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <p className="text-red-600">Missing content ID or type. Please try again.</p>
            <p className="text-xs text-black dark:text-white mt-2">
              ContentId: {contentId || 'undefined'}<br/>
              ContentType: {contentType || 'undefined'}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState({
    currentStep: 0,
    totalSteps: 1,
    percentage: 0,
    timeSpent: 0,
    lastAccessedAt: new Date()
  });
  const [studentAnswers, setStudentAnswers] = useState({});
  const [assessmentAnswers, setAssessmentAnswers] = useState({});
  const [assessmentScore, setAssessmentScore] = useState(null);
  const [showScore, setShowScore] = useState(false);
  const [assessmentResults, setAssessmentResults] = useState(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (content && isOpen && contentId && contentType) {
    
      
      setStartTime(Date.now());
      calculateTotalSteps();
      
      // Check completion status from multiple sources
      const isContentCompleted = studentProgress?.status === 'completed' || 
                               content?.progress?.status === 'completed' ||
                               content?.progress?.completedAt ||
                               studentProgress?.completedAt ||
                               (content?.progress && content.progress.status === 'completed');
      
    
      
      setIsCompleted(isContentCompleted);
      
      if (studentProgress) {
        setProgress(studentProgress.progress);
        setCurrentStep(studentProgress.progress.currentStep);
      } else if (content.progress) {
        setProgress(content.progress);
        setCurrentStep(content.progress.currentStep || 0);
      }
    }
  }, [content, isOpen, studentProgress, contentId, contentType]);

  const calculateTotalSteps = () => {
    if (!content) return;
    
    switch (content.type) {
      case 'comic':
        setProgress(prev => ({
          ...prev,
          totalSteps: content.panels?.length || content.imageUrls?.length || content.images?.length || 1
        }));
        break;
      case 'assessment':
        // Parse assessment questions to get total count
        try {
          const assessmentData = JSON.parse(content.generatedContent || '{}');
          const questions = assessmentData.questions || [];
          setProgress(prev => ({
            ...prev,
            totalSteps: questions.length || 1
          }));
        } catch {
          setProgress(prev => ({ ...prev, totalSteps: 1 }));
        }
        break;
      default:
        setProgress(prev => ({ ...prev, totalSteps: 1 }));
    }
  };

  const updateProgress = async (step, completed = false) => {
    if (!content || (!content.id && !content._id)) {
      console.error('Content missing ID field:', content);
      return;
    }

    const contentId = content.id || content._id;
    const contentType = content.type;
    

    const timeSpent = Math.round((Date.now() - startTime) / 60000); // minutes
    const newProgress = {
      currentStep: step,
      totalSteps: progress.totalSteps,
      percentage: Math.round((step / progress.totalSteps) * 100),
      timeSpent: progress.timeSpent + timeSpent,
      lastAccessedAt: new Date()
    };

    setProgress(newProgress);

    // Update progress in database
    try {
      const response = await fetch('/api/student/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: contentId,
          contentType: contentType,
          contentTitle: content.title,
          subject: content.subject,
          grade: content.grade,
          status: completed ? 'completed' : 'in_progress',
          progress: newProgress,
          completionData: completed ? {
            completedAt: new Date(),
            timeToComplete: newProgress.timeSpent
          } : null
        })
      });

      if (!response.ok) {
        console.error('Failed to update progress');
      }
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const handleNext = () => {
    if (currentStep < progress.totalSteps - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      updateProgress(nextStep);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      updateProgress(prevStep);
    }
  };

  const handleComplete = async () => {
    if (!content || (!content.id && !content._id)) {
      console.error('No content ID available for completion');
      return;
    }

    setIsLoading(true);
    try {
      const timeSpent = Math.round((Date.now() - startTime) / 60000); // minutes
      const contentId = content.id || content._id;
      
      // Use the action.js function directly instead of API call
      await updateStudentProgress(contentId, {
        contentType: content.type || content.contentType,
        contentTitle: content.title,
        subject: content.subject,
        grade: content.grade,
        timeSpent: timeSpent,
        timeToComplete: timeSpent
      });

      setIsCompleted(true);
      
      // Show success message
      toast.success('Content completed successfully! 🎉', {
        description: `You spent ${timeSpent} minutes learning about ${content.title}`
      });

      // Close dialog after a short delay
      setTimeout(() => {
        onClose();
        onComplete && onComplete({ 
          contentId, 
          timeSpent, 
          contentType: content.type || content.contentType 
        });
      }, 1500);

    } catch (error) {
      console.error('Error completing content:', error);
      toast.error('Failed to mark content as complete. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = (questionNumber, answer) => {
    setStudentAnswers(prev => ({
      ...prev,
      [questionNumber]: answer
    }));
  };

  const handleAssessmentSubmit = async (score, correctAnswers, totalQuestions, answers) => {
    setAssessmentScore(score);
    setAssessmentResults({ score, correctAnswers, totalQuestions, answers });
    setShowScore(true);
    setIsCompleted(true);

    try {
      const timeSpent = Math.round((Date.now() - startTime) / 60000);
      
      // Use the action.js function directly instead of API call
      await updateStudentProgress(content.id || content._id, {
        contentType: content.type || content.contentType,
        contentTitle: content.title,
        subject: content.subject,
        grade: content.grade,
        timeSpent: timeSpent,
        timeToComplete: timeSpent,
        score: score,
        correctAnswers: correctAnswers,
        totalQuestions: totalQuestions,
        answers: answers
      });

      // Show success message
      toast.success(`Assessment completed! Your score: ${score}% 🎉`, {
        description: `You answered ${correctAnswers} out of ${totalQuestions} questions correctly`
      });

      // Close dialog after showing score for a few seconds
      setTimeout(() => {
        onClose();
        onComplete && onComplete({ score, correctAnswers, totalQuestions });
      }, 3000);

    } catch (error) {
      console.error('Error saving assessment progress:', error);
      toast.error('Failed to save assessment results. Please try again.');
    }
  };

  const renderContentPreview = () => {
    // Show score screen for completed assessments
    if (content.resourceType === 'assessment' && showScore && assessmentResults) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center">
          <div className="mb-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              assessmentResults.score >= 80 ? 'bg-green-100 dark:bg-green-800' : 
              assessmentResults.score >= 60 ? 'bg-yellow-100 dark:bg-yellow-800' : 'bg-red-100 dark:bg-red-800'
            }`}>
              <Trophy className={`h-10 w-10 ${
                assessmentResults.score >= 80 ? 'text-green-600 dark:text-green-400' : 
                assessmentResults.score >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
              }`} />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-2">Assessment Complete!</h3>
            <p className="text-3xl font-bold text-foreground mb-2">{assessmentResults.score}%</p>
            <p className="text-foreground mb-4">
              {assessmentResults.score >= 80 ? 'Excellent work!' : 
               assessmentResults.score >= 60 ? 'Good job!' : 'Keep practicing!'}
            </p>
            <div className="text-sm text-muted-foreground mb-4">
              <p>Correct: {assessmentResults.correctAnswers} / {assessmentResults.totalQuestions}</p>
            </div>
            <div className="flex items-center justify-center gap-4 text-sm text-foreground">
              <Badge variant="outline">{content.subject}</Badge>
              <Badge variant="secondary">{content.grade}</Badge>
              <Badge variant="outline">{content.difficulty}</Badge>
            </div>
          </div>
          <Button onClick={onClose} variant="outline" className="px-8">
            Close
          </Button>
        </div>
      );
    }

    // Show completion screen for other content types
    if (isCompleted && content.resourceType !== 'assessment') {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">Completed!</h3>
            <p className="text-foreground">You have successfully completed this content.</p>
          </div>
          <Button onClick={onClose} variant="outline" className="px-8">
            Close
          </Button>
        </div>
      );
    }

    // Use resourceType instead of type for the switch statement
    const contentType = content.resourceType || content.type;
    
    switch (contentType) {
      case 'content':
      case 'lesson plan':
        return (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              <ContentPreview
                content={content.generatedContent || content.contentData || content.content}
                metadata={content}
                isEditable={false}
              />
            </div>
            <div className="mt-4 flex justify-center flex-shrink-0">
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Complete
                  </>
                )}
              </Button>
            </div>
          </div>
        );
        
      case 'slides':
        return (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              <PPTXViewer
                presentationUrl={content.presentationUrl || content.url}
                downloadUrl={content.downloadUrl}
                title={content.title}
                slideCount={content.slideCount || content.slidesCount}
                status={content.status || 'SUCCESS'}
                errorMessage={content.errorMessage}
                onSave={() => {
                  // Optional: Add save functionality if needed
                  toast.success('Presentation saved to library!');
                }}
                isSaving={false}
              />
            </div>
            <div className="mt-4 flex justify-center flex-shrink-0">
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Complete
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      
      case 'video':
        return (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              <VideoPreview
                videoUrl={content.videoUrl || content.url}
                title={content.title}
                slidesCount={content.slidesCount}
                status="completed"
                voiceName={content.voiceName}
                avatarName={content.talkingPhotoName}
                videoId={content.videoId}
                isEditable={false}
              />
            </div>
            <div className="mt-4 flex justify-center flex-shrink-0">
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Complete
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      
      case 'comic':
        // Check if this is a comic lesson
        if (content.resourceType === 'comic' || content.contentType === 'comic') {
          // Try multiple sources for comic images
          let comicImages = [];
          
          if (content.panels && content.panels.length > 0) {
            comicImages = content.panels.map(panel => panel.imageUrl || panel.imageBase64).filter(Boolean);
          } else if (content.imageUrls && content.imageUrls.length > 0) {
            comicImages = content.imageUrls;
          } else if (content.images && content.images.length > 0) {
            comicImages = content.images;
          } else if (content.cloudinaryPublicIds && content.cloudinaryPublicIds.length > 0) {
            comicImages = content.cloudinaryPublicIds.map(id => `https://res.cloudinary.com/demo/image/upload/${id}`);
          }
        
          if (comicImages.length === 0) {
            return (
              <div className="text-center py-8 text-foreground h-full flex items-center justify-center">
                <div>
                  <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-sm">No comic panels available</p>
                </div>
              </div>
            );
          }

          return (
            <div className="h-full flex flex-col">
              <div className="flex-1 min-h-0 overflow-hidden">
                <CarouselWithControls
                  items={comicImages.map((url, i) => ({ url, index: i + 1 }))}
                  className="h-full"
                  renderItem={(p) => (
                    <div className="rounded-lg border overflow-hidden bg-gradient-to-br from-background to-muted/10 flex items-center justify-center h-full">
                      <img 
                        src={p.url} 
                        alt={`Panel ${p.index}`} 
                        className="max-h-full max-w-full object-contain rounded-lg shadow-sm" 
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const fallbackDiv = document.createElement('div');
                          fallbackDiv.className = 'text-center py-8 text-foreground';
                          fallbackDiv.innerHTML = `
                            <div>
                              <svg class="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                              </svg>
                              <p class="text-sm">Panel ${p.index} failed to load</p>
                              <p class="text-xs text-muted-foreground mt-2">
                                URL: ${p.url || 'Not provided'}
                              </p>
                            </div>
                          `;
                          e.target.parentNode.appendChild(fallbackDiv);
                        }}
                      />
                    </div>
                  )}
                />
              </div>
              <div className="mt-4 flex justify-center flex-shrink-0">
                <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark as Complete
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        }
        
        // Fallback for non-comic content
        return (
          <div className="text-center py-8 text-foreground h-full flex items-center justify-center">
            <div>
              <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-sm">Comic content not available</p>
            </div>
          </div>
        );
      
      case 'image':
        // Check if this is an image lesson
        if (content.resourceType === 'image' || content.contentType === 'image') {
          return (
            <div className="h-full flex flex-col">
              <div className="flex-1 min-h-0 overflow-hidden">
                <div className="flex flex-col h-full">
                  <div className="flex-1 min-h-0 flex items-center justify-center">
                    <div className="relative max-w-full max-h-full">
                      {content.imageUrl ? (
                        <img 
                          src={content.imageUrl} 
                          alt={content.title}
                          className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                          loading="lazy"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const fallbackDiv = document.createElement('div');
                            fallbackDiv.className = 'text-center py-8 text-foreground';
                            fallbackDiv.innerHTML = `
                              <div>
                                <svg class="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                <p class="text-sm">Image failed to load</p>
                              </div>
                            `;
                            e.target.parentNode.appendChild(fallbackDiv);
                          }}
                        />
                      ) : content.imageBase64 ? (
                        <img 
                          src={`data:image/png;base64,${content.imageBase64}`} 
                          alt={content.title}
                          className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                          loading="lazy"
                        />
                      ) : (
                        <div className="text-center py-8 text-foreground">
                          <Image className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                          <p className="text-sm">No image data available</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {content.instructions && (
                    <div className="p-4 bg-muted/50 border-t">
                      <p className="text-sm text-muted-foreground">{content.instructions}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex justify-center flex-shrink-0">
                <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark as Complete
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        }
      
        // Fallback for non-image content
        return (
          <div className="text-center py-8 text-foreground h-full flex items-center justify-center">
            <div>
              <Image className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-sm">Image content not available</p>
            </div>
          </div>
        );
      
      case 'assessment':
        return (
          <div className="h-full overflow-hidden">
            <InteractiveAssessment
              assessment={content}
              onAnswerChange={handleAnswerChange}
              studentAnswers={studentAnswers}
              onSubmit={handleAssessmentSubmit}
              hideSolutions={true}
            />
          </div>
        );
      
      case 'external':
      case 'websearch':
        return (
          <div className="h-full flex flex-col">
            <div className="text-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold">{content.title}</h3>
              <p className="text-sm text-muted-foreground">{content.topic}</p>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownStyles}>
                  {content.searchResults || content.generatedContent || content.content || ''}
                </ReactMarkdown>
              </div>
            </div>
            <div className="mt-4 flex justify-center flex-shrink-0">
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Complete
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="text-center py-8 text-foreground h-full flex items-center justify-center">
            <div>
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-sm">Content type not supported: {contentType}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Available content: {content?.content?.substring(0, 100)}...
              </p>
            </div>
          </div>
        );
    }
  };

  const renderNavigation = () => {
    if (isCompleted || content.resourceType === 'assessment') {
      return null;
    }

    return (
      <div className="flex items-center justify-between p-4 border-t">
        <Button 
          variant="outline" 
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          Previous
        </Button>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {progress.totalSteps}
          </span>
          <Badge variant="outline" className="ml-2">
            {contentTypes[content.resourceType || content.type]?.label}
          </Badge>
        </div>
        
        <Button 
          onClick={handleNext}
          disabled={currentStep >= progress.totalSteps - 1}
        >
          Next
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[80vw] md:max-w-[1024px] max-h-[90vh] p-2 overflow-y-auto">
        <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-foreground">{isCompleted ? 'Review Content' : 'Learning Mode'}</span>
              <Badge variant="outline" className="ml-2">
                {contentTypes[content.resourceType || content.type]?.label}
              </Badge>
              {isCompleted && (
                <Badge className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Completed
                </Badge>
              )}
            </div>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isCompleted ? 'Review your completed learning content' : 'Learn and interact with the content below'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 p-6">
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
              {renderContentPreview()}
            </div>
          </div>
        </div>
        
        {renderNavigation()}
      </DialogContent>
    </Dialog>
  );
}
