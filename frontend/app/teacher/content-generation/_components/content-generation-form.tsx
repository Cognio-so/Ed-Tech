"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { ContentPreview } from "../../media-toolkit/_components/content-preview";
import { DownloadDialog } from "@/components/ui/download-dialog";
import {
  Save,
  Copy,
  Download,
  Loader2,
  FileText,
  HelpCircle,
  ClipboardList,
  Presentation,
} from "lucide-react";
import { toast } from "sonner";
import { saveContent } from "../action";
import { cn } from "@/lib/utils";
import { useContentStream } from "@/hooks/use-content-stream";

const formSchema = z.object({
  contentType: z.enum(["lesson_plan", "presentation", "quiz", "worksheet"]),
  grade: z.string().min(1, "Grade is required"),
  subject: z.string().min(1, "Subject is required"),
  topic: z.string().min(1, "Topic is required"),
  language: z.enum(["English", "Hindi"]),
  learningObjective: z.string().min(1, "Learning objective is required"),
  emotionalConsideration: z.number().min(1).max(5).default(3),
  adaptiveLearning: z.boolean().default(false),
  includeAssessment: z.boolean().default(false),
  multimediaSuggestion: z.boolean().default(false),
  instructionDepth: z
    .enum(["Basic", "Standard", "Advanced"])
    .default("Standard"),
  numberOfSessions: z.string().optional(),
  durationOfSession: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Content {
  id: string;
  contentType: string;
  title: string;
  content: string;
  grade?: string | null;
  subject?: string | null;
  topic?: string | null;
  language?: string | null;
  learningObjective?: string | null;
  emotionalConsideration?: number | null;
  adaptiveLearning?: boolean | null;
  includeAssessment?: boolean | null;
  multimediaSuggestion?: boolean | null;
  instructionDepth?: string | null;
  numberOfSessions?: string | null;
  durationOfSession?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const contentTypes = [
  {
    value: "lesson_plan",
    label: "Lesson Plan",
    icon: FileText,
    description: "Create a lesson plan for a specific topic.",
    color: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
    selectedColor: "bg-blue-500 border-blue-500 text-white",
  },
  {
    value: "quiz",
    label: "Quiz",
    icon: HelpCircle,
    description: "Create a quiz for a specific topic.",
    color:
      "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400",
    selectedColor: "bg-purple-500 border-purple-500 text-white",
  },
  {
    value: "worksheet",
    label: "Worksheet",
    icon: ClipboardList,
    description: "Create a worksheet for a specific topic.",
    color:
      "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400",
    selectedColor: "bg-green-500 border-green-500 text-white",
  },
  {
    value: "presentation",
    label: "Presentation",
    icon: Presentation,
    description: "Create a presentation for a specific topic.",
    color:
      "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400",
    selectedColor: "bg-orange-500 border-orange-500 text-white",
  },
];

interface ContentGenerationFormProps {
  initialGrades: { id: string; name: string }[];
  initialSubjects: { id: string; name: string }[];
}

export function ContentGenerationForm({
  initialGrades,
  initialSubjects,
}: ContentGenerationFormProps) {
  const [generatedContent, setGeneratedContent] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [grades] =
    React.useState<{ id: string; name: string }[]>(initialGrades);
  const [subjects] =
    React.useState<{ id: string; name: string }[]>(initialSubjects);
  
  const { content: streamingContent, isStreaming, streamContent } = useContentStream();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      contentType: "lesson_plan",
      grade: "",
      subject: "",
      topic: "",
      language: "English",
      learningObjective: "",
      emotionalConsideration: 3,
      adaptiveLearning: false,
      includeAssessment: false,
      multimediaSuggestion: false,
      instructionDepth: "Standard",
      numberOfSessions: "",
      durationOfSession: "",
    },
  });

  const contentType = form.watch("contentType");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const editContentStr = sessionStorage.getItem("editContent");
      if (editContentStr) {
        try {
          const editContent: Content = JSON.parse(editContentStr);
          setEditingId(editContent.id);
          
          form.reset({
            contentType: editContent.contentType as any,
            grade: editContent.grade || "",
            subject: editContent.subject || "",
            topic: editContent.topic || "",
            language: (editContent.language === "English" || editContent.language === "Hindi") 
              ? editContent.language as "English" | "Hindi" 
              : "English",
            learningObjective: editContent.learningObjective || "",
            emotionalConsideration: editContent.emotionalConsideration || 3,
            adaptiveLearning: editContent.adaptiveLearning || false,
            includeAssessment: editContent.includeAssessment || false,
            multimediaSuggestion: editContent.multimediaSuggestion || false,
            instructionDepth: (editContent.instructionDepth as "Basic" | "Standard" | "Advanced") || "Standard",
            numberOfSessions: editContent.numberOfSessions || "",
            durationOfSession: editContent.durationOfSession || "",
          });
          setGeneratedContent(editContent.content);
          setShowPreview(true);
          sessionStorage.removeItem("editContent");
        } catch (error) {
          console.error("Error parsing edit content:", error);
        }
      }
    }
  }, []);

  const generateContent = async (values: FormValues) => {
    setGeneratedContent("");
    setShowPreview(true); // Show preview immediately to display streaming content

    const payload = {
      ...values,
    };

    console.log("📝 Content Form values:", values);
    console.log("📦 Content Payload being sent:", payload);

    await streamContent("/api/content-generation", payload, {
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
    formData.append("contentType", values.contentType);
    formData.append("title", `${values.contentType} - ${values.topic}`);
    formData.append("content", generatedContent);
    formData.append("grade", values.grade);
    formData.append("subject", values.subject);
    formData.append("topic", values.topic);
    formData.append("language", values.language);
    formData.append("learningObjective", values.learningObjective || "");
    formData.append(
      "emotionalConsideration",
      (values.emotionalConsideration || 3).toString()
    );
    formData.append("adaptiveLearning", values.adaptiveLearning.toString());
    formData.append("includeAssessment", values.includeAssessment.toString());
    formData.append(
      "multimediaSuggestion",
      values.multimediaSuggestion.toString()
    );
    formData.append("instructionDepth", values.instructionDepth);
    formData.append("numberOfSessions", values.numberOfSessions || "");
    formData.append("durationOfSession", values.durationOfSession || "");

    try {
      await saveContent(formData);
      toast.success("Content saved successfully");
      setShowPreview(false);
      setGeneratedContent("");
      form.reset();
    } catch (error) {
      toast.error("Failed to save content");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    toast.success("Content copied to clipboard");
  };

  const [showDownloadDialog, setShowDownloadDialog] = React.useState(false);

  const handleDownload = () => {
    if (!generatedContent) {
      toast.error("No content to download");
      return;
    }
    setShowDownloadDialog(true);
  };

  const resetForm = () => {
    form.reset();
    setGeneratedContent("");
    setShowPreview(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Content Creation Form */}
      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(generateContent)}
              className="space-y-8"
            >
              {/* Content Type Selection */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">
                  Content Type *
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {contentTypes.map((type) => {
                    const Icon = type.icon;
                    const isSelected = contentType === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() =>
                          form.setValue("contentType", type.value as any)
                        }
                        className={cn(
                          "p-4 rounded-lg border-2 transition-all text-left",
                          "hover:scale-105 cursor-pointer",
                          isSelected ? type.selectedColor : type.color
                        )}
                      >
                        <Icon className="h-8 w-8 mb-2" />
                        <h3 className="font-semibold mb-1">{type.label}</h3>
                        <p className="text-sm opacity-80">{type.description}</p>
                      </button>
                    );
                  })}
                </div>
                <FormField
                  control={form.control}
                  name="contentType"
                  render={() => <FormMessage />}
                />
              </div>

              {/* Basic Information */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="grade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grades *</FormLabel>
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
                  name="emotionalConsideration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Emotional Consideration: {field.value}
                      </FormLabel>
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
                        Scale from 1 to 5 for emotional and social learning
                        consideration
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Content Options */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Content Options</h3>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="adaptiveLearning"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Adaptive Learning</FormLabel>
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

                  <FormField
                    control={form.control}
                    name="includeAssessment"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Include Assessment</FormLabel>
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

                  <FormField
                    control={form.control}
                    name="multimediaSuggestion"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Multimedia Suggestions</FormLabel>
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
                </div>
              </div>

              {/* Version and Depth */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="instructionDepth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instruction Depth *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select depth" />
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

                <div className="space-y-2">
                  <Label>Content Version *</Label>
                  <Select defaultValue="Standard" disabled>
                    <SelectTrigger>
                      <SelectValue placeholder="Select version" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard">Standard</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Currently only Standard version is available
                  </p>
                </div>
              </div>

              {/* Lesson Plan Specific Fields */}
              {contentType === "lesson_plan" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="numberOfSessions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Sessions</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            placeholder="e.g., 5"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormDescription>
                          Number of sessions for this lesson plan
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="durationOfSession"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration of Session</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 45 minutes" {...field} />
                        </FormControl>
                        <FormDescription>
                          Duration of each session (e.g., 45 minutes, 1 hour)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Action Buttons */}
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
                      Generate Content
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      {showPreview && (
        <ContentPreview
          content={generatedContent}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
          title={`Generated Content Preview - ${
            form.getValues().topic || "Content"
          }`}
          onCopy={handleCopy}
          onDownload={handleDownload}
          onSave={handleSave}
          onClose={() => {
            setShowPreview(false);
            setGeneratedContent("");
          }}
        />
      )}

      {/* Download Dialog */}
      {generatedContent && (
        <DownloadDialog
          open={showDownloadDialog}
          onOpenChange={setShowDownloadDialog}
          content={generatedContent}
          title={form.getValues().topic || "Content"}
        />
      )}
    </div>
  );
}
