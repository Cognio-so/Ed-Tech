"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveExam, updateExam } from "../action";
import { ExamFormPreview } from "./exam-form-preview";
import { useContentStream } from "@/hooks/use-content-stream";
import {
  examGeneratorSchema,
  type ExamGeneratorValues,
  type TopicQuestionConfigValues,
} from "@/lib/zodSchema";
import type { ExamData } from "@/data/get-exam-generated";

interface ExamGeneratorFormProps {
  initialGrades: { id: string; name: string }[];
  initialSubjects: { id: string; name: string }[];
}

export function ExamGeneratorForm({
  initialGrades,
  initialSubjects,
}: ExamGeneratorFormProps) {
  const [generatedContent, setGeneratedContent] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [grades] = React.useState<{ id: string; name: string }[]>(initialGrades);
  const [subjects] = React.useState<{ id: string; name: string }[]>(initialSubjects);

  const { content: streamingContent, isStreaming, streamContent } = useContentStream();

  const form = useForm<ExamGeneratorValues>({
    resolver: zodResolver(examGeneratorSchema),
    defaultValues: {
      organisationName: "",
      examName: "Annual",
      duration: "",
      grade: "",
      subject: "",
      language: "English",
      difficultyLevel: "Standard",
      topics: [
        {
          topicName: "",
          longAnswerCount: 0,
          shortAnswerCount: 0,
          mcqCount: 0,
          trueFalseCount: 0,
        },
      ],
      customPrompt: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "topics",
  });

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const editExamStr = sessionStorage.getItem("editExam");
      if (editExamStr) {
        try {
          const editExam: ExamData = JSON.parse(editExamStr);
          setEditingId(editExam.id);
          setGeneratedContent(editExam.content);
          setShowPreview(true);

          let topicsData: TopicQuestionConfigValues[] = [];
          try {
            topicsData = JSON.parse(editExam.topics);
          } catch (parseError) {
            console.warn("Could not parse topics data:", parseError);
            topicsData = [
              {
                topicName: "",
                longAnswerCount: 0,
                shortAnswerCount: 0,
                mcqCount: 0,
                trueFalseCount: 0,
              },
            ];
          }

          form.reset({
            organisationName: editExam.organisationName || "",
            examName: (editExam.examName as "Annual" | "Unit test" | "Half yearly" | "class test") || "Annual",
            duration: editExam.duration || "",
            grade: editExam.grade || "",
            subject: editExam.subject || "",
            language: (editExam.language === "English" || editExam.language === "Hindi"
              ? editExam.language
              : "English") as "English" | "Hindi",
            difficultyLevel: editExam.difficultyLevel || "Standard",
            topics: topicsData.length > 0 ? topicsData : [
              {
                topicName: "",
                longAnswerCount: 0,
                shortAnswerCount: 0,
                mcqCount: 0,
                trueFalseCount: 0,
              },
            ],
            customPrompt: editExam.customPrompt || "",
          });

          sessionStorage.removeItem("editExam");
        } catch (error) {
          console.error("Error parsing edit exam:", error);
        }
      }
    }
  }, [form]);

  const generateExam = async (values: ExamGeneratorValues) => {
    setGeneratedContent("");
    setShowPreview(true);

    const payload = {
      organisationName: values.organisationName,
      examName: values.examName,
      duration: values.duration,
      grade: values.grade,
      subject: values.subject,
      language: values.language,
      difficultyLevel: values.difficultyLevel,
      topics: values.topics,
      customPrompt: values.customPrompt || "",
    };

    await streamContent("/api/exam-generation", payload, {
      onComplete: (content) => {
        setGeneratedContent(content);
      },
      onError: (error) => {
        setShowPreview(false);
        toast.error(error);
      },
    });
  };

  const handleSave = async () => {
    if (!generatedContent) {
      toast.error("No content to save");
      return;
    }

    const values = form.getValues();
    const formData = new FormData();
    formData.append("title", `Exam - ${values.examName} - ${values.subject}`);
    formData.append("content", generatedContent);
    formData.append("organisationName", values.organisationName);
    formData.append("examName", values.examName);
    formData.append("duration", values.duration);
    formData.append("grade", values.grade);
    formData.append("subject", values.subject);
    formData.append("language", values.language);
    formData.append("difficultyLevel", values.difficultyLevel);
    formData.append("topics", JSON.stringify(values.topics));
    formData.append("customPrompt", values.customPrompt || "");

    try {
      if (editingId) {
        await updateExam(editingId, formData);
        toast.success("Exam updated successfully");
      } else {
        await saveExam(formData);
        toast.success("Exam saved successfully");
      }
      setShowPreview(false);
      setGeneratedContent("");
      setEditingId(null);
      form.reset();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("refreshExams"));
      }
    } catch (error) {
      toast.error(
        editingId ? "Failed to update exam" : "Failed to save exam"
      );
    }
  };

  const resetForm = () => {
    form.reset();
    setGeneratedContent("");
    setShowPreview(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(generateExam)}
              className="space-y-8"
            >
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="organisationName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organisation Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter organisation name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="examName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Exam Type *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select exam type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Annual">Annual</SelectItem>
                            <SelectItem value="Unit test">Unit test</SelectItem>
                            <SelectItem value="Half yearly">Half yearly</SelectItem>
                            <SelectItem value="class test">class test</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 2 hours" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="grade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grade *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select grade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {grades.map((grade) => (
                              <SelectItem key={grade.id} value={grade.name}>
                                {grade.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select subject" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {subjects.map((subject) => (
                              <SelectItem key={subject.id} value={subject.name}>
                                {subject.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Language *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="English">English</SelectItem>
                            <SelectItem value="Hindi">Hindi</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="difficultyLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Difficulty Level *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select difficulty" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Basic">Basic</SelectItem>
                            <SelectItem value="Standard">Standard</SelectItem>
                            <SelectItem value="Advanced">Advanced</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="customPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Instructions</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Optional custom instructions for exam generation"
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Topics & Question Types</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({
                        topicName: "",
                        longAnswerCount: 0,
                        shortAnswerCount: 0,
                        mcqCount: 0,
                        trueFalseCount: 0,
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Topic
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium">Topic {index + 1}</h4>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <FormField
                        control={form.control}
                        name={`topics.${index}.topicName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Topic Name *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter topic name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <FormField
                          control={form.control}
                          name={`topics.${index}.longAnswerCount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Long Answer</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  value={field.value || 0}
                                  onChange={(e) =>
                                    field.onChange(parseInt(e.target.value) || 0)
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`topics.${index}.shortAnswerCount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Short Answer</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  value={field.value || 0}
                                  onChange={(e) =>
                                    field.onChange(parseInt(e.target.value) || 0)
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`topics.${index}.mcqCount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>MCQ</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  value={field.value || 0}
                                  onChange={(e) =>
                                    field.onChange(parseInt(e.target.value) || 0)
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`topics.${index}.trueFalseCount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>True/False</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  value={field.value || 0}
                                  onChange={(e) =>
                                    field.onChange(parseInt(e.target.value) || 0)
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isStreaming}>
                  {isStreaming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Generate Exam
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {showPreview && (
        <ExamFormPreview
          content={generatedContent}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
          title={form.getValues().examName || "Exam"}
          onSave={handleSave}
          onClose={() => {
            setShowPreview(false);
            setGeneratedContent("");
          }}
        />
      )}
    </div>
  );
}

