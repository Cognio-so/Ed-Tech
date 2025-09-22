"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Copy, Check, Edit, Save, X, Clock, Users, BookOpen, ChevronDown } from "lucide-react";
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
  isEditable = true 
}) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(assessment?.generatedContent || '');
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('pdf');
  const [isDownloading, setIsDownloading] = useState(false);

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
          const blob = new Blob([assessment.generatedContent], { type: 'text/markdown' });
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
          await generatePDF(assessment.generatedContent, filename);
          break;
          
        case 'docx':
          await generateDOCX(assessment.generatedContent, filename);
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
    <>
      <Card className="w-full dark:bg-secondary">
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
              <div className="flex items-center gap-4 mt-3 text-sm text-gray-600 dark:text-white">
                <div className="flex items-center gap-1 dark:text-white">
                  <Clock className="h-4 w-4" />
                  {assessment.duration} minutes
                </div>
                <div className="flex items-center gap-1 dark:text-white">
                  <BookOpen className="h-4 w-4" />
                  {assessment.numQuestions} questions
                </div>
                {assessment.metadata?.createdAt && (
                  <div className="flex items-center gap-1 dark:text-white">
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
                    cursor="pointer"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveEdit}
                    cursor="pointer"
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
                      cursor="pointer"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyContent}
                    disabled={copied}
                    cursor="pointer"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDownloadDialog(true)}
                    cursor="pointer"
                    className="flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3" />
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
                  cursor="pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  className="min-w-[100px]"
                  cursor="pointer"
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
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-white">
                    <BookOpen className="h-5 w-5" />
                    Questions
                  </h3>
                  <div className="space-y-6">
                    {questions.map((question, index) => (
                      <div key={index} className="border rounded-lg p-4 dark:bg-secondary">
                        <div className="flex items-start gap-3 dark:text-white">
                          <Badge variant="outline" className="mt-1">
                            {question.number}
                          </Badge>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 dark:text-white">
                              <Badge 
                                variant={question.type === 'mcq' ? 'default' : 
                                        question.type === 'true_false' ? 'secondary' : 'outline'}
                                className="text-xs"
                              >
                                {question.type === 'mcq' ? 'MCQ' : 
                                 question.type === 'true_false' ? 'True/False' : 'Short Answer'}
                              </Badge>
                            </div>
                            <p className="text-gray-900 mb-3 dark:text-white">{question.text}</p>
                            
                            {question.type === 'mcq' && question.options.length > 0 && (
                              <div className="space-y-1 ml-4">
                                {question.options.map((option, optIndex) => (
                                  <div key={optIndex} className="text-sm text-gray-700 dark:text-white">
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
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-white">
                      <Check className="h-5 w-5" />
                      Solutions
                    </h3>
                    <div className="space-y-2">
                      {solutions.map((solution, index) => (
                        <div key={index} className="border rounded-lg p-3 bg-green-50 dark:bg-secondary">
                          <p className="text-sm text-gray-900 dark:text-white">{solution}</p>
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

      {/* Download Format Selection Dialog */}
      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Download Assessment</DialogTitle>
            <DialogDescription>
              Choose the format for downloading your assessment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="format">Download Format</Label>
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
            <div className="text-sm text-muted-foreground">
              <p><strong>Markdown:</strong> Plain text with formatting markers</p>
              <p><strong>PDF:</strong> Formatted document, good for printing</p>
              <p><strong>Word:</strong> Editable document with formatting</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDownloadDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDownloadContent} 
              disabled={isDownloading || !downloadFormat}
            >
              {isDownloading ? "Downloading..." : "Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
