"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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
        // Parse question lines - fixed regex to match actual format
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
  
  // Debug logging


  const handleAnswerChange = (questionIndex, answer) => {
    const newAnswers = { ...studentAnswers, [questionIndex]: answer };
    onAnswerChange(newAnswers);
  };

  const handleSubmit = async () => {
    if (!questions || questions.length === 0) {
      console.error('No questions found in assessment');
      return;
    }

    let correctAnswers = 0;
    const totalQuestions = questions.length;

   

    questions.forEach((question, index) => {
      const studentAnswer = studentAnswers[question.number];
      const solutionLine = solutions.find(s => s.startsWith(`${question.number}.`));
      
      

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
     
      
      if (isCorrect) {
        correctAnswers++;
      }
    });

    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    
    // Call the parent's onSubmit function with the calculated score
    if (onSubmit) {
      await onSubmit(score, correctAnswers, totalQuestions, studentAnswers);
    }
  };

  const renderQuestion = (question, index) => {
    const studentAnswer = studentAnswers[question.number] || '';

    return (
      <div key={index} className="border rounded-lg p-6 bg-white shadow-sm mb-6">
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
            <p className="text-gray-900 mb-4 font-medium">{question.text}</p>
            
            {question.type === 'mcq' && question.options.length > 0 && (
              <RadioGroup
                value={studentAnswer}
                onValueChange={(value) => handleAnswerChange(question.number, value)}
                className="space-y-2"
              >
                {question.options.map((option, optIndex) => (
                  <div key={optIndex} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`q${question.number}-opt${optIndex}`} />
                    <Label htmlFor={`q${question.number}-opt${optIndex}`} className="text-sm cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {question.type === 'true_false' && (
              <RadioGroup
                value={studentAnswer}
                onValueChange={(value) => handleAnswerChange(question.number, value)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="True" id={`q${question.number}-true`} />
                  <Label htmlFor={`q${question.number}-true`} className="text-sm cursor-pointer">
                    True
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="False" id={`q${question.number}-false`} />
                  <Label htmlFor={`q${question.number}-false`} className="text-sm cursor-pointer">
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
        <h3 className="text-lg font-semibold">{assessment.title}</h3>
        <p className="text-sm text-muted-foreground">{assessment.topic}</p>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-600">
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
                <p className="text-sm">No questions found in assessment content</p>
                <p className="text-xs text-muted-foreground mt-2">Content: {assessment?.content?.substring(0, 100)}...</p>
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
        isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
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
                className={`text-xs ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
              >
                {isCorrect ? '✓ Correct' : '✗ Incorrect'}
              </Badge>
            </div>
            <p className="text-gray-900 mb-4 font-medium">{question.text}</p>
            
            {/* Show student's answer */}
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-700 mb-1">Your Answer:</p>
              <div className={`p-3 rounded-md ${
                isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {studentAnswer || 'No answer provided'}
              </div>
            </div>

            {/* Show correct answer */}
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-700 mb-1">Correct Answer:</p>
              <div className="p-3 rounded-md bg-blue-100 text-blue-800">
                {correctAnswer}
              </div>
            </div>

            {/* Show options for MCQ */}
            {question.type === 'mcq' && question.options.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Options:</p>
                <div className="space-y-1">
                  {question.options.map((option, optIndex) => (
                    <div key={optIndex} className={`text-sm p-2 rounded ${
                      option === correctAnswer ? 'bg-green-100 text-green-800 font-medium' :
                      option === studentAnswer && !isCorrect ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-600'
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
            score >= 80 ? 'bg-green-100' : 
            score >= 60 ? 'bg-yellow-100' : 'bg-red-100'
          }`}>
            <Trophy className={`h-10 w-10 ${
              score >= 80 ? 'text-green-600' : 
              score >= 60 ? 'text-yellow-600' : 'text-red-600'
            }`} />
          </div>
          <h3 className="text-2xl font-bold mb-2">Assessment Review</h3>
          <p className="text-3xl font-bold mb-2">{score}%</p>
          <p className="text-gray-600 mb-4">
            {score >= 80 ? 'Excellent work!' : 
             score >= 60 ? 'Good job!' : 'Keep practicing!'}
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
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
  const contentType = content?.type || content?.contentType;
  


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
            <p className="text-gray-600">Loading content...</p>
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
            <p className="text-xs text-gray-500 mt-2">
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
  const [assessmentAnswers, setAssessmentAnswers] = useState({});
  const [assessmentScore, setAssessmentScore] = useState(null);
  const [showScore, setShowScore] = useState(false);
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
      console.error('Content missing ID field:', content);
      return;
    }

    setIsLoading(true);
    
    const contentId = content.id || content._id;
    const contentType = content.type;
    
    const timeSpent = Math.round((Date.now() - startTime) / 60000);
    
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
          status: 'completed',
          progress: {
            ...progress,
            currentStep: progress.totalSteps,
            percentage: 100,
            timeSpent: progress.timeSpent + timeSpent,
            lastAccessedAt: new Date()
          },
          completionData: {
            completedAt: new Date(),
            timeToComplete: progress.timeSpent + timeSpent
          }
        })
      });

      if (response.ok) {
        setIsCompleted(true);
        toast.success('Congratulations! You completed this content! 🎉');
        if (onComplete) onComplete(contentId, contentType);
      }
    } catch (error) {
      console.error('Error completing content:', error);
      toast.error('Failed to mark as completed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssessmentSubmit = async (score, correctAnswers, totalQuestions, answers) => {
    try {
      setAssessmentScore(score);
      setShowScore(true);

      // Update progress with assessment results
      await updateProgress(progress.totalSteps, true);
      
      const response = await fetch('/api/student/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: contentId,
          contentType: contentType,
          contentTitle: content.title,
          subject: content.subject,
          grade: content.grade,
          status: 'completed',
          progress: {
            ...progress,
            currentStep: progress.totalSteps,
            percentage: 100,
            timeSpent: progress.timeSpent + Math.round((Date.now() - startTime) / 60000),
            lastAccessedAt: new Date()
          },
          completionData: {
            completedAt: new Date(),
            score: score,
            answers: answers,
            correctAnswers: correctAnswers,
            totalQuestions: totalQuestions,
            timeToComplete: progress.timeSpent + Math.round((Date.now() - startTime) / 60000)
          }
        })
      });

      if (response.ok) {
        setIsCompleted(true);
        toast.success(`Assessment completed! Your score: ${score}% 🎉`);
        if (onComplete) onComplete(contentId, contentType);
      }
    } catch (error) {
      console.error('Error submitting assessment:', error);
      toast.error('Failed to submit assessment');
    }
  };

  const renderContentPreview = () => {
    
    
    if (isCompleted && content.type !== 'assessment') {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-green-600 mb-2">Completed!</h3>
            <p className="text-gray-600">You have successfully completed this content.</p>
          </div>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      );
    }

    switch (content.type) {
      case 'content':
        return (
          <div className="h-full overflow-hidden">
            <ContentPreview
              content={content.contentData || content.generatedContent}
              metadata={content}
              isEditable={false}
            />
            <div className="mt-4 flex justify-center">
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark as Complete
              </Button>
            </div>
          </div>
        );
      
      case 'assessment':
      
        
        // Check if assessment is completed by looking at the progress data
        const isCompletedByProgress = content?.progress?.status === 'completed' || 
                                    content?.progress?.completedAt ||
                                    content?.progress?.score !== undefined;
        
        
        const hasCompletedAt = content?.progress?.completedAt || studentProgress?.completedAt;
        const hasCompletedStatus = content?.progress?.status === 'completed' || studentProgress?.status === 'completed';
        const isAssessmentCompleted = isCompleted || hasCompletedAt || hasCompletedStatus || isCompletedByProgress;
        
        
        if (isAssessmentCompleted) {
          
          // Show completed assessment review
          const completedScore = content?.progress?.score || 
                               studentProgress?.score || 
                               content?.progress?.completionData?.score ||
                               assessmentScore || 0;
          const completedAnswers = content?.progress?.completionData?.answers || 
                                 studentProgress?.completionData?.answers ||
                                 assessmentAnswers;
          const correctAnswers = content?.progress?.completionData?.correctAnswers || 
                               studentProgress?.completionData?.correctAnswers || 0;
          const totalQuestions = content?.progress?.completionData?.totalQuestions || 
                               studentProgress?.completionData?.totalQuestions || 0;
          
       
          
          return (
            <div className="h-full overflow-hidden">
              <AssessmentReview
                assessment={content}
                studentAnswers={completedAnswers}
                score={completedScore}
                correctAnswers={correctAnswers}
                totalQuestions={totalQuestions}
                onClose={onClose}
              />
            </div>
          );
        } else {
          console.log('❌ SHOWING INTERACTIVE ASSESSMENT - Assessment is NOT completed');
        }

        if (showScore) {
          return (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="mb-6">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  assessmentScore >= 80 ? 'bg-green-100' : 
                  assessmentScore >= 60 ? 'bg-yellow-100' : 'bg-red-100'
                }`}>
                  <Trophy className={`h-10 w-10 ${
                    assessmentScore >= 80 ? 'text-green-600' : 
                    assessmentScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`} />
                </div>
                <h3 className="text-2xl font-bold mb-2">Assessment Complete!</h3>
                <p className="text-3xl font-bold mb-2">{assessmentScore}%</p>
                <p className="text-gray-600">
                  {assessmentScore >= 80 ? 'Excellent work!' : 
                   assessmentScore >= 60 ? 'Good job!' : 'Keep practicing!'}
                </p>
              </div>
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
            </div>
          );
        }

        return (
          <div className="h-full overflow-hidden">
            <InteractiveAssessment
              assessment={content}
              studentAnswers={assessmentAnswers}
              onAnswerChange={setAssessmentAnswers}
              onSubmit={handleAssessmentSubmit}
              hideSolutions={true}
            />
          </div>
        );
      
      case 'lesson':
      
        
        // Check if this is an assessment lesson
        if (content.assessmentId || content.assessmentContent) {
          // This is an assessment lesson - render as interactive assessment
          const assessmentData = {
            ...content,
            generatedContent: content.assessmentContent || content.contentData || '',
            type: 'assessment'
          };
          
          if (showScore) {
            return (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="mb-6">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    assessmentScore >= 80 ? 'bg-green-100' : 
                    assessmentScore >= 60 ? 'bg-yellow-100' : 'bg-red-100'
                  }`}>
                    <Trophy className={`h-10 w-10 ${
                      assessmentScore >= 80 ? 'text-green-600' : 
                      assessmentScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Assessment Complete!</h3>
                  <p className="text-3xl font-bold mb-2">{assessmentScore}%</p>
                  <p className="text-gray-600">
                    {assessmentScore >= 80 ? 'Excellent work!' : 
                     assessmentScore >= 60 ? 'Good job!' : 'Keep practicing!'}
                  </p>
                </div>
                <Button onClick={onClose} variant="outline">
                  Close
                </Button>
              </div>
            );
          }

          return (
            <div className="h-full overflow-hidden">
              <InteractiveAssessment
                assessment={assessmentData}
                studentAnswers={assessmentAnswers}
                onAnswerChange={setAssessmentAnswers}
                onSubmit={handleAssessmentSubmit}
                hideSolutions={true}
              />
            </div>
          );
        }
        
        // Check if this is an image lesson
        if (content.contentType === 'image') {
          console.log('Rendering image lesson with data:', {
            imageUrl: content.imageUrl,
            hasImageBase64: !!content.imageBase64,
            visualType: content.visualType,
            instructions: content.instructions
          });
          
          return (
            <div className="h-full flex flex-col">
              <div className="text-center mb-4 flex-shrink-0">
                <h3 className="text-lg font-semibold">{content.title}</h3>
                <p className="text-sm text-muted-foreground">{content.topic}</p>
                {content.visualType && (
                  <Badge variant="outline" className="mt-2">
                    {content.visualType.charAt(0).toUpperCase() + content.visualType.slice(1)}
                  </Badge>
                )}
              </div>
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <div className="relative max-w-full max-h-full">
                  {content.imageUrl ? (
                    <img 
                      src={content.imageUrl} 
                      alt={content.title}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                      onError={(e) => {
                        console.error('Image failed to load:', content.imageUrl);
                        e.target.style.display = 'none';
                        const fallbackDiv = document.createElement('div');
                        fallbackDiv.className = 'text-center py-8 text-muted-foreground';
                        fallbackDiv.innerHTML = `
                          <div>
                            <svg class="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            <p class="text-sm">Image failed to load</p>
                            <p class="text-xs text-muted-foreground mt-2">
                              URL: ${content.imageUrl || 'Not provided'}
                            </p>
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
                    />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <div>
                        <Image className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-sm">No image data available</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Image URL: {content.imageUrl || 'Not provided'}<br/>
                          Has Base64: {content.imageBase64 ? 'Yes' : 'No'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {content.instructions && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Instructions:</h4>
                  <p className="text-sm text-gray-600">{content.instructions}</p>
                </div>
              )}
              <div className="mt-4 flex justify-center">
                <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark as Complete
                </Button>
              </div>
            </div>
          );
        }
        
        // Check if this is a comic lesson
        if (content.contentType === 'comic') {
          console.log('Rendering comic lesson with data:', {
            panels: content.panels?.length || 0,
            imageUrls: content.imageUrls?.length || 0,
            images: content.images?.length || 0,
            numPanels: content.numPanels
          });
          
          const comicImages = content.panels?.map(panel => panel.imageUrl || panel.imageBase64) || 
                             content.imageUrls || 
                             content.images || [];
          
          if (comicImages.length === 0) {
            return (
              <div className="text-center py-8 text-muted-foreground h-full flex items-center justify-center">
                <div>
                  <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-sm">No comic panels available</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Panels: {content.panels?.length || 0}<br/>
                    Image URLs: {content.imageUrls?.length || 0}<br/>
                    Images: {content.images?.length || 0}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div className="h-full flex flex-col">
              <div className="text-center mb-4 flex-shrink-0">
                <h3 className="text-lg font-semibold">{content.title}</h3>
                <p className="text-sm text-muted-foreground">{content.topic || content.instruction}</p>
              </div>
              <div className="flex-1 min-h-0">
                <CarouselWithControls
                  items={comicImages.map((url, i) => ({ url, index: i + 1 }))}
                  className="h-full"
                  renderItem={(p) => (
                    <div className="rounded-lg border overflow-hidden bg-gradient-to-br from-background to-muted/10 flex items-center justify-center h-full">
                      <img 
                        src={p.url} 
                        alt={`Panel ${p.index}`} 
                        className="max-h-full max-w-full object-contain rounded-lg shadow-sm" 
                      />
                    </div>
                  )}
                />
              </div>
              {currentStep === progress.totalSteps - 1 && (
                <div className="mt-4 flex justify-center">
                  <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Complete Comic
                  </Button>
                </div>
              )}
            </div>
          );
        }
        
        // Check if this is a presentation lesson
        if (content.contentType === 'presentation') {
          return (
            <div className="h-full overflow-hidden">
              <ContentPreview
                content={content.contentData || content.content || content.generatedContent}
                metadata={content}
                isEditable={false}
              />
              <div className="mt-4 flex justify-center">
                <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark as Complete
                </Button>
              </div>
            </div>
          );
        }
        
        // Regular lesson content - render as markdown
        return (
          <div className="h-full flex flex-col">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">{content.title}</h3>
              <p className="text-sm text-muted-foreground">{content.topic}</p>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownStyles}>
                {content.contentData || content.generatedContent || content.description || ''}
              </ReactMarkdown>
            </div>
            <div className="mt-6 flex justify-center">
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark as Complete
              </Button>
            </div>
          </div>
        );
      
      case 'slides': // Handle slides type directly - same as LibraryDialog
        return (
          <div className="h-full overflow-hidden">
            <PPTXViewer
              presentationUrl={content.presentationUrl}
              title={content.title}
              slideCount={content.slideCount}
              status="completed"
              isEditable={false}
            />
            <div className="mt-4 flex justify-center">
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark as Complete
              </Button>
            </div>
          </div>
        );
      
      case 'video': // Handle video type directly - same as LibraryDialog
        return (
          <div className="h-full overflow-hidden">
            <VideoPreview
              videoUrl={content.videoUrl}
              title={content.title}
              slidesCount={content.slidesCount}
              status="completed"
              voiceName={content.voiceName}
              avatarName={content.talkingPhotoName}
              videoId={content.videoId}
              isEditable={false}
            />
            <div className="mt-4 flex justify-center">
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark as Complete
              </Button>
            </div>
          </div>
        );
      
      case 'comic': // Handle comic type directly - same as LibraryDialog
        const comicImages = content.panels?.map(panel => panel.imageUrl || panel.imageBase64) || 
                           content.imageUrls || 
                           content.images || [];
        
        if (comicImages.length === 0) {
          return (
            <div className="text-center py-8 text-muted-foreground h-full flex items-center justify-center">
              <div>
                <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-sm">No comic panels available</p>
              </div>
            </div>
          );
        }

        return (
          <div className="h-full flex flex-col">
            <div className="text-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold">{content.title}</h3>
              <p className="text-sm text-muted-foreground">{content.topic || content.instruction}</p>
            </div>
            <div className="flex-1 min-h-0">
              <CarouselWithControls
                items={comicImages.map((url, i) => ({ url, index: i + 1 }))}
                className="h-full"
                renderItem={(p) => (
                  <div className="rounded-lg border overflow-hidden bg-gradient-to-br from-background to-muted/10 flex items-center justify-center h-full">
                    <img 
                      src={p.url} 
                      alt={`Panel ${p.index}`} 
                      className="max-h-full max-w-full object-contain rounded-lg shadow-sm" 
                    />
                  </div>
                )}
              />
            </div>
            {currentStep === progress.totalSteps - 1 && (
              <div className="mt-4 flex justify-center">
                <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Complete Comic
                </Button>
              </div>
            )}
          </div>
        );
      
      case 'image': // Handle image type directly - same as LibraryDialog
        
        
        return (
          <div className="h-full flex flex-col">
            <div className="text-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold">{content.title}</h3>
              <p className="text-sm text-muted-foreground">{content.topic}</p>
              {content.visualType && (
                <Badge variant="outline" className="mt-2">
                  {content.visualType.charAt(0).toUpperCase() + content.visualType.slice(1)}
                </Badge>
              )}
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <div className="relative max-w-full max-h-full">
                <img 
                  src={content.imageUrl} 
                  alt={content.title}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                  onError={(e) => {
                    console.error('Image failed to load:', content.imageUrl);
                    // Show fallback content
                    e.target.style.display = 'none';
                    const fallbackDiv = document.createElement('div');
                    fallbackDiv.className = 'text-center py-8 text-muted-foreground';
                    fallbackDiv.innerHTML = `
                      <div>
                        <svg class="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        <p class="text-sm">Image failed to load</p>
                        <p class="text-xs text-muted-foreground mt-2">
                          URL: ${content.imageUrl || 'Not provided'}
                        </p>
                      </div>
                    `;
                    e.target.parentNode.appendChild(fallbackDiv);
                  }}
                />
              </div>
            </div>
            {content.instructions && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Instructions:</h4>
                <p className="text-sm text-gray-600">{content.instructions}</p>
              </div>
            )}
            <div className="mt-4 flex justify-center">
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark as Complete
              </Button>
            </div>
          </div>
        );
      
      case 'websearch': // Handle websearch type directly - same as LibraryDialog
        return (
          <div className="h-full flex flex-col">
            <div className="text-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold">{content.title}</h3>
              <p className="text-sm text-muted-foreground">{content.topic}</p>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownStyles}>
                  {content.searchResults || content.content || ''}
                </ReactMarkdown>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark as Complete
              </Button>
            </div>
          </div>
        );
      
      case 'presentation': // Handle presentation content type
        return (
          <div className="h-full overflow-hidden">
            <ContentPreview
              content={content.contentData || content.content || content.generatedContent}
              metadata={content}
              isEditable={false}
            />
            <div className="mt-4 flex justify-center">
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4" />
                    <span>Completing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    <span>Mark as Complete</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      
      case 'external': // Handle external/websearch content type
        return (
          <div className="h-full overflow-hidden">
            <ContentPreview
              content={content.searchResults || content.content || content.generatedContent}
              metadata={content}
              contentType="web-search"
              isEditable={false}
            />
            <div className="mt-4 flex justify-center">
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4" />
                    <span>Completing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    <span>Mark as Complete</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="text-center py-8 text-muted-foreground h-full flex items-center justify-center">
            <div>
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-sm">Preview not available for this content type: {content.type}</p>
              <p className="text-xs text-muted-foreground mt-2">Available keys: {Object.keys(content).join(', ')}</p>
            </div>
          </div>
        );
    }
  };

  const renderNavigation = () => {
    if (isCompleted || content.type === 'assessment' || content.type === 'image' || content.type === 'content' || content.type === 'slides' || content.type === 'video' || content.type === 'websearch') {
      return null;
    }

    return (
      <div className="flex items-center justify-between p-4 border-t">
        <Button 
          variant="outline" 
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        
        <span className="text-sm text-gray-600">
          {currentStep + 1} of {progress.totalSteps}
        </span>
        
        <Button 
          onClick={handleNext}
          disabled={currentStep >= progress.totalSteps - 1}
        >
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
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
              <Eye className="h-5 w-5 text-blue-600" />
              {isCompleted ? 'Review Content' : 'Learning Mode'}
              <Badge variant="outline" className="ml-2">
                {contentTypes[content.type]?.label}
              </Badge>
              {isCompleted && (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Completed
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
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
