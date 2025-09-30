"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Copy, Check, Edit, Save, X, Clock, Users, BookOpen, ChevronDown, CheckCircle, XCircle, FileCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

const generatePDF = async (content, filename) => {
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const lineHeight = 7;
  const maxLineWidth = pageWidth - (margin * 2);
  
  const plainText = content
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/`(.*?)`/g, '$1') // Remove code
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
    .replace(/^\s*[-*+]\s/gm, '• '); // Convert lists to bullets
  
  const lines = doc.splitTextToSize(plainText, maxLineWidth);
  let currentY = margin;
  
  doc.setFontSize(12);
  
  for (let i = 0; i < lines.length; i++) {
    if (currentY + lineHeight > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }
    
    doc.text(lines[i], margin, currentY);
    currentY += lineHeight;
  }
  
  doc.save(`${filename}.pdf`);
};

const generateDOCX = async (content, filename) => {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  
  // Parse markdown content into structured elements
  const lines = content.split('\n');
  const docElements = [];
  
  for (const line of lines) {
    if (!line.trim()) {
      docElements.push(new Paragraph({ text: "" }));
      continue;
    }
    
    // Handle headers
    if (line.startsWith('# ')) {
      docElements.push(new Paragraph({
        text: line.replace('# ', ''),
        heading: HeadingLevel.HEADING_1
      }));
    } else if (line.startsWith('## ')) {
      docElements.push(new Paragraph({
        text: line.replace('## ', ''),
        heading: HeadingLevel.HEADING_2
      }));
    } else if (line.startsWith('### ')) {
      docElements.push(new Paragraph({
        text: line.replace('### ', ''),
        heading: HeadingLevel.HEADING_3
      }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Handle bullet points
      docElements.push(new Paragraph({
        text: line.replace(/^[-*]\s/, ''),
        bullet: { level: 0 }
      }));
    } else {
      // Handle regular text with basic formatting
      const textRuns = [];
      let currentText = line;
      
      // Handle bold text
      currentText = currentText.replace(/\*\*(.*?)\*\*/g, (match, text) => {
        textRuns.push(new TextRun({ text, bold: true }));
        return '\u0000'; // Placeholder
      });
      
      // Handle italic text
      currentText = currentText.replace(/\*(.*?)\*/g, (match, text) => {
        textRuns.push(new TextRun({ text, italics: true }));
        return '\u0000'; // Placeholder
      });
      
      // Split by placeholders and add regular text
      const parts = currentText.split('\u0000');
      const finalRuns = [];
      
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          finalRuns.push(new TextRun({ text: parts[i] }));
        }
        if (i < textRuns.length) {
          finalRuns.push(textRuns[i]);
        }
      }
      
      docElements.push(new Paragraph({
        children: finalRuns.length > 0 ? finalRuns : [new TextRun({ text: line })]
      }));
    }
  }
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: docElements
    }]
  });
  
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default function AssessmentPreview({ 
  assessment,
  onEditAssessment, 
  isEditable = true,
  isReviewMode = false 
}) {
  const [copied, setCopied] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');

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
        // Parse question lines - look for numbered questions
        if (line.match(/^\d+\./)) {
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

          // Check if this is a True/False question based on the question text
          if (questionText.toLowerCase().includes('true or false') || 
              questionText.toLowerCase().includes('true/false')) {
            currentQuestion.type = 'true_false';
            currentQuestion.options = [
              { id: 'true', text: 'True' },
              { id: 'false', text: 'False' }
            ];
          }
        } else if (currentQuestion && line.match(/^[A-D]\)/)) {
          // This is an option for the current question
          const optionText = line.replace(/^[A-D]\)\s*/, '');
          currentQuestion.options.push({
            id: line.match(/^([A-D])\)/)[1].toLowerCase(),
            text: optionText
          });
          
          // If we have options, this is likely a multiple choice question
          if (currentQuestion.type === 'unknown') {
            currentQuestion.type = 'multiple_choice';
          }
        } else if (currentQuestion && line.trim() && !line.startsWith('**')) {
          // This might be additional text for the current question
          currentQuestion.text += ' ' + line;
        }
      }
    }

    // Don't forget the last question
    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    // Match solutions to questions
    questions.forEach((question, index) => {
      const solutionLine = solutions.find(s => s.startsWith(`${question.number}.`));
      if (solutionLine) {
        const correctAnswer = solutionLine.replace(/^\d+\.\s*/, '').trim();
        question.correctAnswer = correctAnswer;
      }
    });

    return { questions, solutions };
  };

  // Get the content from various possible fields
  const content = assessment?.content || 
                 assessment?.generatedContent || 
                 assessment?.assessmentContent || 
                 assessment?.instruction || 
                 '';

  // Parse the content to get questions
  const { questions, solutions } = parseAssessmentContent(content);

  // Debug logging
  console.log('=== AssessmentPreview Debug ===');
  console.log('Assessment object:', assessment);
  console.log('Content string:', content);
  console.log('Parsed questions:', questions);
  console.log('Solutions:', solutions);

  // In review mode, load the submitted answers
  useEffect(() => {
    if (isReviewMode) {
      // Check if student answers are passed as prop
      if (assessment.submittedAnswers) {
        setAnswers(assessment.submittedAnswers);
        setSubmitted(true);
      } else if (assessment.studentAnswers) {
        setAnswers(assessment.studentAnswers);
        setSubmitted(true);
      } else {
        // For testing - you can add sample answers here
        console.log('No student answers found. Add sample answers for testing.');
        // Uncomment the line below to add sample answers for testing:
        // setAnswers({0: 2, 1: 1, 2: 2, 3: 2, 4: 1, 5: 2, 6: 1, 7: 2, 8: 1, 9: 3});
      }
    }
  }, [isReviewMode, assessment?.submittedAnswers, assessment?.studentAnswers]);

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Assessment copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy assessment");
    }
  };

  const handleDownloadContent = async () => {
    if (!downloadFormat) {
      toast.error("Please select a download format");
      return;
    }

    setIsDownloading(true);
    const filename = assessment.title || 'assessment';

    try {
      switch (downloadFormat) {
        case 'md':
          const blob = new Blob([content], { type: 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${filename}.md`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          break;
          
        case 'pdf':
          await generatePDF(content, filename);
          break;
          
        case 'docx':
          await generateDOCX(content, filename);
          break;
          
        default:
          throw new Error('Unsupported format');
      }
      
      toast.success(`Assessment downloaded as ${downloadFormat.toUpperCase()}!`);
      setShowDownloadDialog(false);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(`Failed to download as ${downloadFormat.toUpperCase()}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleStartEdit = () => {
    setEditedContent(content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedContent(content);
    setIsEditing(false);
    toast.info("Edit cancelled");
  };

  const handleSaveEdit = () => {
    if (onEditAssessment) {
      onEditAssessment(editedContent);
      setIsEditing(false);
      toast.success("Assessment updated!");
    }
  };

  if (!assessment) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No assessment selected</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderQuestion = (question, index) => {
    const studentAnswer = answers[index];
    const correctAnswer = question.correctAnswer;
    const isCorrect = studentAnswer !== undefined && correctAnswer !== undefined && 
                     studentAnswer.toString().toLowerCase() === correctAnswer.toLowerCase();

    return (
      <div key={index} className="border rounded-lg p-4 mb-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-medium text-base">
            Question {question.number}: {question.text}
          </h3>
          {isReviewMode && correctAnswer && (
            <div className="flex items-center gap-1 ml-2">
              {isCorrect ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
            </div>
          )}
        </div>
        
        {question.type === 'multiple_choice' && question.options && question.options.length > 0 && (
          <div className="space-y-2">
            {question.options.map((option, optionIndex) => {
              const isSelected = studentAnswer === optionIndex;
              const isCorrectOption = correctAnswer && option.id === correctAnswer.toLowerCase();
              
              let optionClass = "p-3 rounded border transition-colors";
              
              if (isReviewMode) {
                if (isCorrectOption) {
                  optionClass += " bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800";
                } else if (isSelected && !isCorrectOption) {
                  optionClass += " bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800";
                } else {
                  optionClass += " bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800";
                }
              } else if (isSelected) {
                optionClass += " bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 cursor-pointer";
              } else {
                optionClass += " cursor-pointer";
              }
              
              return (
                <div 
                  key={optionIndex} 
                  className={optionClass}
                  onClick={() => !isReviewMode && handleAnswerChange(index, optionIndex)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">
                      {String.fromCharCode(65 + optionIndex)}.
                    </span>
                    <span className="flex-1">{option.text}</span>
                    {isReviewMode && isCorrectOption && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {isReviewMode && isSelected && !isCorrectOption && (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    {!isReviewMode && isSelected && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {question.type === 'true_false' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id={`tf-${index}-true`}
                name={`tf-${index}`}
                value="true"
                checked={studentAnswer === 'true'}
                onChange={() => !isReviewMode && handleAnswerChange(index, 'true')}
                disabled={isReviewMode}
              />
              <label htmlFor={`tf-${index}-true`} className="text-sm">True</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id={`tf-${index}-false`}
                name={`tf-${index}`}
                value="false"
                checked={studentAnswer === 'false'}
                onChange={() => !isReviewMode && handleAnswerChange(index, 'false')}
                disabled={isReviewMode}
              />
              <label htmlFor={`tf-${index}-false`} className="text-sm">False</label>
            </div>
          </div>
        )}

        {question.type === 'short_answer' && (
          <div className="space-y-2">
            <textarea
              value={studentAnswer || ''}
              onChange={(e) => !isReviewMode && handleAnswerChange(index, e.target.value)}
              placeholder="Enter your answer here..."
              className="w-full p-3 border rounded-lg resize-none"
              rows={3}
              disabled={isReviewMode}
            />
          </div>
        )}

        {question.type === 'essay' && (
          <div className="space-y-2">
            <textarea
              value={studentAnswer || ''}
              onChange={(e) => !isReviewMode && handleAnswerChange(index, e.target.value)}
              placeholder="Enter your essay here..."
              className="w-full p-3 border rounded-lg resize-none"
              rows={6}
              disabled={isReviewMode}
            />
          </div>
        )}

        {/* Show student answer result in review mode */}
        {isReviewMode && studentAnswer !== undefined && (
          <div className="mt-4">
            <div className={`p-3 border rounded ${
              isCorrect 
                ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <p className={`text-sm font-medium ${
                  isCorrect 
                    ? 'text-green-700 dark:text-green-400' 
                    : 'text-red-700 dark:text-red-400'
                }`}>
                  {isCorrect ? 'Correct' : 'Incorrect'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleAnswerChange = (questionIndex, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  const canSubmit = Object.values(answers).every(answer => answer !== undefined);

  const handleSubmit = () => {
    if (!canSubmit) {
      toast.error("Please answer all questions.");
      return;
    }
    // In a real application, you would send answers to a backend
    // For now, we'll just simulate submission
    toast.success("Assessment submitted!");
    setSubmitted(true);
    // In a real app, you would update the assessment object with submitted answers
    // onEditAssessment(assessment); 
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{assessment.title}</h2>
            {assessment.topic && (
              <p className="text-sm text-muted-foreground mt-1">{assessment.topic}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditable && !isReviewMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartEdit}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDownloadDialog(true)}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyContent}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {isReviewMode && (
          <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Assessment Completed</span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Show parsed questions if available */}
        {questions && questions.length > 0 ? (
          <div className="space-y-6">
            {questions.map((question, index) => renderQuestion(question, index))}
          </div>
        ) : (
          /* Fallback: Show raw content if no questions parsed */
          <div className="space-y-4">
            <div className="text-center py-8 text-muted-foreground">
              <FileCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-sm">No structured questions found in this assessment</p>
              <p className="text-xs text-muted-foreground mt-2">
                This appears to be a lesson plan or content review rather than an interactive assessment.
              </p>
            </div>
            
            {/* Show the raw content */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2 text-foreground">Content:</h4>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-foreground">
                  {content}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer - only show if not in review mode and has questions */}
      {!isReviewMode && questions && questions.length > 0 && (
        <div className="flex-shrink-0 p-4 border-t">
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit}
            className="w-full"
          >
            Submit Assessment
          </Button>
        </div>
      )}

      {/* Download Dialog */}
      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download Assessment</DialogTitle>
            <DialogDescription>
              Choose the format you want to download the assessment in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={downloadFormat} onValueChange={setDownloadFormat}>
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="md">Markdown (.md)</SelectItem>
                <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                <SelectItem value="docx">Word Document (.docx)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDownloadDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDownloadContent} 
              disabled={!downloadFormat || isDownloading}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
