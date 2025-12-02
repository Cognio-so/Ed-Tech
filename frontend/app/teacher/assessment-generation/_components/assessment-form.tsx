"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { saveAssessment, updateAssessment } from "../action";
import { AssessmentPreview } from "./assessment-preview";
import { useContentStream } from "@/hooks/use-content-stream";

const formSchema = z
  .object({
    subject: z.string().min(1, "Subject is required"),
    grade: z.string().min(1, "Grade is required"),
    difficultyLevel: z.string().min(1, "Difficulty level is required"),
    language: z.enum(["English", "Hindi"]),
    topic: z.string().min(1, "Topic is required"),
    learningObjective: z.string().min(1, "Learning objective is required"),
    duration: z.string().min(1, "Duration is required"),
    confidenceLevel: z.number().min(1).max(5),
    customInstruction: z.string().optional(),
    mcqEnabled: z.boolean(),
    mcqCount: z.number().min(0),
    trueFalseEnabled: z.boolean(),
    trueFalseCount: z.number().min(0),
    shortAnswerEnabled: z.boolean(),
    shortAnswerCount: z.number().min(0),
  })
  .refine(
    (data) => {
      if (data.mcqEnabled && data.mcqCount <= 0) return false;
      if (data.trueFalseEnabled && data.trueFalseCount <= 0) return false;
      if (data.shortAnswerEnabled && data.shortAnswerCount <= 0) return false;
      return (
        data.mcqEnabled || data.trueFalseEnabled || data.shortAnswerEnabled
      );
    },
    {
      message: "At least one question type must be enabled with count > 0",
      path: ["mcqEnabled"],
    }
  );

type FormValues = z.infer<typeof formSchema>;

interface Assessment {
  id: string;
  contentType: string;
  title: string;
  content: string;
  grade?: string | null;
  subject?: string | null;
  topic?: string | null;
  language?: string | null;
  learningObjective?: string | null;
  instructionDepth?: string | null;
  durationOfSession?: string | null;
  emotionalConsideration?: number | null;
  numberOfSessions?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AssessmentFormProps {
  initialGrades: { id: string; name: string }[];
  initialSubjects: { id: string; name: string }[];
}

export function AssessmentForm({
  initialGrades,
  initialSubjects,
}: AssessmentFormProps) {
  const [generatedContent, setGeneratedContent] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [grades] =
    React.useState<{ id: string; name: string }[]>(initialGrades);
  const [subjects] =
    React.useState<{ id: string; name: string }[]>(initialSubjects);
  
  const { content: streamingContent, isStreaming, streamContent } = useContentStream();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: "",
      grade: "",
      difficultyLevel: "Standard",
      language: "English",
      topic: "",
      learningObjective: "",
      duration: "45 minutes",
      confidenceLevel: 3,
      customInstruction: "",
      mcqEnabled: false,
      mcqCount: 0,
      trueFalseEnabled: false,
      trueFalseCount: 0,
      shortAnswerEnabled: false,
      shortAnswerCount: 0,
    },
  });

  const mcqEnabled = form.watch("mcqEnabled");
  const trueFalseEnabled = form.watch("trueFalseEnabled");
  const shortAnswerEnabled = form.watch("shortAnswerEnabled");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const editAssessmentStr = sessionStorage.getItem("editAssessment");
      if (editAssessmentStr) {
        try {
          const editAssessment: Assessment = JSON.parse(editAssessmentStr);
          setEditingId(editAssessment.id);
          setGeneratedContent(editAssessment.content);
          setShowPreview(true);

          const assessmentData = JSON.parse(
            editAssessment.numberOfSessions || "{}"
          );
          form.reset({
            subject: editAssessment.subject || "",
            grade: editAssessment.grade || "",
            difficultyLevel: editAssessment.instructionDepth || "Standard",
            language:
              editAssessment.language === "English" ||
              editAssessment.language === "Hindi"
                ? editAssessment.language
                : "English",
            topic: editAssessment.topic || "",
            learningObjective: editAssessment.learningObjective || "",
            duration: editAssessment.durationOfSession || "45 minutes",
            confidenceLevel: editAssessment.emotionalConsideration || 3,
            customInstruction: assessmentData.customInstruction || "",
            mcqEnabled: assessmentData.mcqEnabled || false,
            mcqCount: assessmentData.mcqCount || 0,
            trueFalseEnabled: assessmentData.trueFalseEnabled || false,
            trueFalseCount: assessmentData.trueFalseCount || 0,
            shortAnswerEnabled: assessmentData.shortAnswerEnabled || false,
            shortAnswerCount: assessmentData.shortAnswerCount || 0,
          });

          sessionStorage.removeItem("editAssessment");
        } catch (error) {
          console.error("Error parsing edit assessment:", error);
        }
      }
    }
  }, [form]);

  const generateAssessment = async (values: FormValues) => {
    setGeneratedContent("");
    setShowPreview(true); // Show preview immediately to display streaming content

    const payload = {
      subject: values.subject,
      grade: values.grade,
      difficultyLevel: values.difficultyLevel,
      language: values.language,
      topic: values.topic,
      learningObjective: values.learningObjective,
      duration: values.duration,
      confidenceLevel: values.confidenceLevel,
      customInstruction: values.customInstruction || "",
      mcqEnabled: values.mcqEnabled,
      mcqCount: values.mcqEnabled ? values.mcqCount : 0,
      trueFalseEnabled: values.trueFalseEnabled,
      trueFalseCount: values.trueFalseEnabled ? values.trueFalseCount : 0,
      shortAnswerEnabled: values.shortAnswerEnabled,
      shortAnswerCount: values.shortAnswerEnabled ? values.shortAnswerCount : 0,
    };

    await streamContent("/api/assessment-generation", payload, {
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
    formData.append("title", `Assessment - ${values.topic}`);
    formData.append("content", generatedContent);
    formData.append("grade", values.grade);
    formData.append("subject", values.subject);
    formData.append("topic", values.topic);
    formData.append("language", values.language);
    formData.append("learningObjective", values.learningObjective);
    formData.append("difficultyLevel", values.difficultyLevel);
    formData.append("duration", values.duration);
    formData.append("confidenceLevel", values.confidenceLevel.toString());
    formData.append("customInstruction", values.customInstruction || "");
    formData.append("mcqEnabled", values.mcqEnabled.toString());
    formData.append("mcqCount", values.mcqCount.toString());
    formData.append("trueFalseEnabled", values.trueFalseEnabled.toString());
    formData.append("trueFalseCount", values.trueFalseCount.toString());
    formData.append("shortAnswerEnabled", values.shortAnswerEnabled.toString());
    formData.append("shortAnswerCount", values.shortAnswerCount.toString());

    try {
      if (editingId) {
        await updateAssessment(editingId, formData);
        toast.success("Assessment updated successfully");
      } else {
        await saveAssessment(formData);
        toast.success("Assessment saved successfully");
      }
      setShowPreview(false);
      setGeneratedContent("");
      setEditingId(null);
      form.reset();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("refreshAssessments"));
      }
    } catch (error) {
      toast.error(
        editingId ? "Failed to update assessment" : "Failed to save assessment"
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
              onSubmit={form.handleSubmit(generateAssessment)}
              className="space-y-8"
            >
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                  <FormField
                    control={form.control}
                    name="topic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Topic *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter the main topic"
                            {...field}
                          />
                        </FormControl>
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
                          <Input placeholder="e.g., 45 minutes" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="learningObjective"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Learning Objective *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what students will learn"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confidenceLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confidence Level: {field.value}</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Slider
                            min={1}
                            max={5}
                            step={1}
                            value={[field.value || 3]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>1 - Low</span>
                            <span>3 - Medium</span>
                            <span>5 - High</span>
                          </div>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Scale from 1 to 5 for confidence and support level
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customInstruction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Instructions</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Optional custom instructions for assessment generation"
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
                <h3 className="text-lg font-semibold">Question Types</h3>

                <FormField
                  control={form.control}
                  name="mcqEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5 flex-1">
                        <FormLabel>Multiple Choice Questions</FormLabel>
                        <FormDescription>
                          Enable multiple choice questions with 4 options
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {mcqEnabled && (
                  <FormField
                    control={form.control}
                    name="mcqCount"
                    render={({ field }) => (
                      <FormItem className="ml-8">
                        <FormLabel>Number of MCQ Questions</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={50}
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
                )}

                <FormField
                  control={form.control}
                  name="trueFalseEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5 flex-1">
                        <FormLabel>True/False Questions</FormLabel>
                        <FormDescription>
                          Enable true or false questions with explanations
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {trueFalseEnabled && (
                  <FormField
                    control={form.control}
                    name="trueFalseCount"
                    render={({ field }) => (
                      <FormItem className="ml-8">
                        <FormLabel>Number of True/False Questions</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={50}
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
                )}

                <FormField
                  control={form.control}
                  name="shortAnswerEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5 flex-1">
                        <FormLabel>Short Answer Questions</FormLabel>
                        <FormDescription>
                          Enable short answer questions with scoring rubrics
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {shortAnswerEnabled && (
                  <FormField
                    control={form.control}
                    name="shortAnswerCount"
                    render={({ field }) => (
                      <FormItem className="ml-8">
                        <FormLabel>Number of Short Answer Questions</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={50}
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
                )}
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
                      Generate Assessment
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {showPreview && (
        <AssessmentPreview
          content={generatedContent}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
          topic={form.getValues().topic}
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
