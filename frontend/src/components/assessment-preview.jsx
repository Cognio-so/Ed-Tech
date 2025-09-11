"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { MarkdownStyles } from "@/components/Markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Download, Copy, Check, Edit, Save, X, Clock, Users, BookOpen } from "lucide-react";
import { toast } from "sonner";
import remarkGfm from "remark-gfm";

export default function AssessmentPreview({
  assessment,
  onEditAssessment, 
  isEditable = true 
}) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(assessment?.generatedContent || '');

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
          }
        } else if (currentQuestion && line.match(/^[A-D]\)/)) {
          // Multiple choice option
          currentQuestion.type = 'mcq';
          currentQuestion.options.push(line);
        } else if (currentQuestion && line && !line.match(/^[A-D]\)/)) {
          // This is a continuation line for the current question
          currentQuestion.text += ' ' + line;
          
          // Check if this continuation line indicates True/False
          if (line.toLowerCase().includes('true or false') || 
              line.toLowerCase().includes('true/false')) {
            currentQuestion.type = 'true_false';
          }
        }
      }
    }

    // Add the last question
    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    // Final pass to determine question types for any remaining 'unknown' types
    questions.forEach(question => {
      if (question.type === 'unknown') {
        // Check the full question text for True/False indicators
        if (question.text.toLowerCase().includes('true or false') || 
            question.text.toLowerCase().includes('true/false')) {
          question.type = 'true_false';
        } else if (question.options.length > 0) {
          question.type = 'mcq';
        } else {
          question.type = 'short_answer';
        }
      }
    });

    return { questions, solutions };
  };

  const { questions, solutions } = parseAssessmentContent(assessment?.generatedContent);

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(assessment.generatedContent);
      setCopied(true);
      toast.success("Assessment copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy assessment");
    }
  };

  const handleDownloadContent = () => {
    const blob = new Blob([assessment.generatedContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${assessment.title || 'assessment'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Assessment downloaded!");
  };

  const handleStartEdit = () => {
    setEditedContent(assessment.generatedContent);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedContent(assessment.generatedContent);
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

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {assessment.title}
            </CardTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline">{assessment.subject}</Badge>
              <Badge variant="secondary">{assessment.grade}</Badge>
              <Badge variant="outline">{assessment.difficulty}</Badge>
              <Badge variant="outline">{assessment.language}</Badge>
              <Badge variant="outline">{assessment.status}</Badge>
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {assessment.duration} minutes
              </div>
              <div className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {assessment.numQuestions} questions
              </div>
              {assessment.metadata?.createdAt && (
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {new Date(assessment.metadata.createdAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveEdit}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                {isEditable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartEdit}
                    title="Edit Assessment"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyContent}
                  disabled={copied}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadContent}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assessmentEditor">Edit Assessment</Label>
              <Textarea
                id="assessmentEditor"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={20}
                className="font-mono text-sm"
                placeholder="Edit your assessment here..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleCancelEdit}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                className="min-w-[100px]"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[600px] w-full">
            <div className="space-y-6">
              {/* Questions Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Questions
                </h3>
                <div className="space-y-6">
                  {questions.map((question, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="mt-1">
                          {question.number}
                        </Badge>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge 
                              variant={question.type === 'mcq' ? 'default' : 
                                      question.type === 'true_false' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {question.type === 'mcq' ? 'MCQ' : 
                               question.type === 'true_false' ? 'True/False' : 'Short Answer'}
                            </Badge>
                          </div>
                          <p className="text-gray-900 mb-3">{question.text}</p>
                          
                          {question.type === 'mcq' && question.options.length > 0 && (
                            <div className="space-y-1 ml-4">
                              {question.options.map((option, optIndex) => (
                                <div key={optIndex} className="text-sm text-gray-700">
                                  {option}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Solutions Section */}
              {solutions.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Check className="h-5 w-5" />
                    Solutions
                  </h3>
                  <div className="space-y-2">
                    {solutions.map((solution, index) => (
                      <div key={index} className="border rounded-lg p-3 bg-green-50">
                        <p className="text-sm text-gray-900">{solution}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
