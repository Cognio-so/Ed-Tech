"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { contentTypes, grade, subject, presentationTemplates } from "@/config/data";
import { toast } from "sonner";
import { FileText, Save, Plus, Trash2, Edit, Eye, Loader2, Download, Database, RefreshCcw } from "lucide-react";
import { generateContent, generateSlidesFromContent, saveContentToDatabase, deleteContentFromDatabase, getUserContent, updateContentInDatabase, savePresentationToDatabase, getUserAssignedGradesAndSubjects } from "./action";
import ContentPreview from "@/components/ui/content-preview";
import PPTXViewer from "@/components/pptx-viewer";

const contentFormSchema = z.object({
  contentType: z.string().min(1, "Please select a content type"),
  grades: z.array(z.string()).min(1, "Please select at least one grade"),
  subjects: z.array(z.string()).min(1, "Please select at least one subject"),
  topic: z.string().min(1, "Topic is required"),
  objective: z.string().min(1, "Objective is required"),
  emotionalConsideration: z.string().min(1, "Emotional consideration is required"),
  language: z.enum(["english", "arabic"], {
    required_error: "Please select a language",
  }),
  adaptiveLearning: z.boolean().default(false),
  includeAssessment: z.boolean().default(false),
  multimediaSuggestions: z.boolean().default(false),
  instructionDepth: z.enum(["simplified", "standard", "enriched"], {
    required_error: "Please select instruction depth",
  }),
  contentVersion: z.enum(["simplified", "standard", "enriched"], {
    required_error: "Please select content version",
  }),
});

export default function ContentForm() {
  const [activeTab, setActiveTab] = useState("form");
  const [savedContent, setSavedContent] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [isGeneratingSlides, setIsGeneratingSlides] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewContent, setPreviewContent] = useState(null);
  const [editingContent, setEditingContent] = useState(null);
  const [showSlideDialog, setShowSlideDialog] = useState(false);
  const [selectedContentForSlides, setSelectedContentForSlides] = useState(null);
  const [slideCount, setSlideCount] = useState(10);
  const [selectedTemplate, setSelectedTemplate] = useState("default");
  const [generatedPresentation, setGeneratedPresentation] = useState(null);
  const [showPresentationModal, setShowPresentationModal] = useState(false);
  const [isSavingPresentation, setIsSavingPresentation] = useState(false);
  const [userGrades, setUserGrades] = useState([]);
  const [userSubjects, setUserSubjects] = useState([]);
  const [loadingUserData, setLoadingUserData] = useState(true);

  const form = useForm({
    resolver: zodResolver(contentFormSchema),
    defaultValues: {
      contentType: "",
      grades: [],
      subjects: [],
      topic: "",
      objective: "",
      emotionalConsideration: "",
      language: "english",
      adaptiveLearning: false,
      includeAssessment: false,
      multimediaSuggestions: false,
      instructionDepth: "standard",
      contentVersion: "standard",
    },
  });

  // Fetch user's assigned grades and subjects
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoadingUserData(true);
        const result = await getUserAssignedGradesAndSubjects();
        
        if (result.success) {
          setUserGrades(result.grades);
          setUserSubjects(result.subjects);
        } else {
          toast.error(result.error || "Failed to load user data");
        }
      } catch (error) {
        toast.error("Failed to load user data");
        console.error(error);
      } finally {
        setLoadingUserData(false);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    loadSavedContent();
  }, []);

  const loadSavedContent = async () => {
    try {
      const result = await getUserContent();
      if (result.success) {
        setSavedContent(result.contents);
      }
    } catch (error) {
      toast.error("Something went wrong while loading content");
    }
  };

  const editContent = (content) => {
    setEditingContent(content);
    setActiveTab("form");
    toast.success("Content loaded for editing");
  };

  const cancelEdit = () => {
    setEditingContent(null);
    toast.info("Edit cancelled");
  };

  const saveEditedContent = async () => {
    if (!editingContent) {
      toast.error("No content to save");
      return;
    }

    setIsSaving(true);
    try {
      const updateData = {
        generatedContent: editingContent.generatedContent
      };

      const result = await updateContentInDatabase(editingContent._id, updateData);

      if (result.success) {
        toast.success("Content updated successfully!");
        setEditingContent(null);
        setActiveTab("saved");
        await loadSavedContent();
      } else {
        toast.error(result.error || "Failed to update content");
      }
    } catch (error) {
      toast.error("Failed to save edited content");
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const result = await generateContent(data);

      if (result.success) {
        setGeneratedContent({
          ...data,
          generatedContent: result.generatedContent,
          id: Date.now().toString()
        });
        toast.success("Content generated successfully!");
      } else {
        toast.error(result.error || "Failed to generate content");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!generatedContent) {
      toast.error("No content to save");
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveContentToDatabase(generatedContent);

      if (result.success) {
        toast.success("Content saved to database successfully!");
        await loadSavedContent();
        setGeneratedContent(null);
        form.reset();
      } else {
        toast.error(result.error || "Failed to save content to database");
      }
    } catch (error) {
      toast.error("Failed to save content to database");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteContent = async (id) => {
    try {
      const result = await deleteContentFromDatabase(id);
      if (result.success) {
        setSavedContent(prev => prev.filter(content => content._id !== id));
        toast.success("Content deleted from database!");
      } else {
        toast.error(result.error || "Failed to delete content");
      }
    } catch (error) {
      toast.error("Failed to delete content");
    }
  };

  const previewContentHandler = (content) => {
    setPreviewContent(content);
  };

  const closePreview = () => {
    setPreviewContent(null);
  };

  const handleGenerateSlidesClick = (content) => {
    setSelectedContentForSlides(content);
    setShowSlideDialog(true);
  };

  const handleGenerateSlides = async () => {
    if (!selectedContentForSlides) {
      toast.error("No content selected for slide generation");
      return;
    }

    setIsGeneratingSlides(true);
    setShowSlideDialog(false);

    try {
      const result = await generateSlidesFromContent({
        content: selectedContentForSlides.generatedContent,
        topic: selectedContentForSlides.topic,
        slideCount: slideCount,
        language: selectedContentForSlides.language,
        template: selectedTemplate
      });

      if (result.success) {
        toast.success("Slides generated successfully!");

        // Store the presentation data for display
        if (result.presentation) {
          setGeneratedPresentation({
            ...result.presentation,
            title: selectedContentForSlides.topic,
            slideCount: slideCount,
            template: selectedTemplate
          });
          setShowPresentationModal(true);
        }
      } else {
        toast.error(result.error || "Failed to generate slides");
      }
    } catch (error) {
      toast.error("Failed to generate slides");
    } finally {
      setIsGeneratingSlides(false);
      setSelectedContentForSlides(null);
    }
  };

  // Add this function to handle content editing from the preview
  const handleEditContent = (editedContent) => {
    if (generatedContent) {
      setGeneratedContent(prev => ({
        ...prev,
        generatedContent: editedContent
      }));
    }
  };

  // Add this function to handle saving the presentation
  const handleSavePresentation = async () => {
    if (!generatedPresentation) return;

    setIsSavingPresentation(true);
    try {
      const presentationData = {
        title: generatedPresentation.title,
        topic: selectedContentForSlides?.topic || generatedPresentation.title,
        slideCount: generatedPresentation.slideCount,
        template: generatedPresentation.template,
        language: selectedContentForSlides?.language || "english",
        presentationUrl: generatedPresentation.task_result?.url,
        downloadUrl: generatedPresentation.task_result?.download_url,
        taskId: generatedPresentation.task_id,
        taskStatus: generatedPresentation.task_status,
        contentId: selectedContentForSlides?.id || null,
        tags: [selectedContentForSlides?.contentType, selectedContentForSlides?.subject].filter(Boolean),
        isPublic: false
      };

      const result = await savePresentationToDatabase(presentationData);

      if (result.success) {
        toast.success("Presentation saved to library successfully!");
        setShowPresentationModal(false);
        setGeneratedPresentation(null);
      } else {
        toast.error(result.error || "Failed to save presentation");
      }
    } catch (error) {
      toast.error("Failed to save presentation");
    } finally {
      setIsSavingPresentation(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {editingContent ? "Edit Content" : "Content Generation"}
        </h1>
        <p className="text-gray-600">
          {editingContent
            ? `Editing: ${editingContent.topic || 'Content'}`
            : "Create and manage educational content for your students"
          }
        </p>
        {editingContent && (
          <div className="mt-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Edit Mode
            </Badge>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="form" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">
              {editingContent ? "Edit Content" : "Create Content"}
            </span>
            <span className="sm:hidden">
              {editingContent ? "Edit" : "Create"}
            </span>
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Saved Content</span>
            <span className="sm:hidden">Saved</span>
            {savedContent.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {savedContent.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-6">
          {editingContent ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Edit className="h-5 w-5" />
                      Edit Generated Content
                    </CardTitle>
                    <CardDescription>
                      Edit the actual content: {editingContent.topic || 'Content'}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEdit}
                    className="text-red-600 hover:text-red-700"
                  >
                    Cancel Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contentEditor">Content Editor</Label>
                  <Textarea
                    id="contentEditor"
                    value={editingContent.generatedContent || ""}
                    onChange={(e) => setEditingContent(prev => ({
                      ...prev,
                      generatedContent: e.target.value
                    }))}
                    rows={20}
                    className="font-mono text-sm"
                    placeholder="Edit your content here..."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveEditedContent}
                    disabled={isSaving}
                    className="min-w-[120px]"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Content Creation Form
                </CardTitle>
                <CardDescription>
                  Fill in the details to generate educational content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="contentType">Content Type *</Label>
                    <div className="grid grid-cols-2 gap-4">
                      {contentTypes.map((type) => (
                        <div
                          key={type}
                          className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${form.watch("contentType") === type
                              ? "border-purple-500 bg-purple-50 dark:bg-purple-950"
                              : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                            }`}
                          onClick={() => form.setValue("contentType", type)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded flex items-center justify-center ${type === "lesson plan" ? "bg-blue-500" :
                                type === "worksheet" ? "bg-green-500" :
                                  type === "quiz" ? "bg-purple-500" :
                                    "bg-orange-500"
                              }`}>
                              {type === "lesson plan" && <FileText className="h-4 w-4 text-white" />}
                              {type === "worksheet" && <FileText className="h-4 w-4 text-white" />}
                              {type === "quiz" && <span className="text-white font-bold">?</span>}
                              {type === "presentation" && <span className="text-white font-bold">📊</span>}
                            </div>
                            <div>
                              <h3 className="font-semibold capitalize">{type}</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Create a {type} for a specific topic
                              </p>
                            </div>
                          </div>
                          {form.watch("contentType") === type && (
                            <div className="absolute top-2 right-2">
                              <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {form.formState.errors.contentType && (
                      <p className="text-sm text-red-500">{form.formState.errors.contentType.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="grades">Grades *</Label>
                      {loadingUserData ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span className="text-sm text-muted-foreground">Loading grades...</span>
                        </div>
                      ) : userGrades.length > 0 ? (
                        <Select
                          value={form.watch("grades")?.[0] || ""}
                          onValueChange={(value) => form.setValue("grades", [value])}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select grade" />
                          </SelectTrigger>
                          <SelectContent>
                            {userGrades.map((gradeValue) => (
                              <SelectItem key={gradeValue} value={gradeValue}>
                                {gradeValue.toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md text-center">
                          <p className="text-sm text-muted-foreground">No grades assigned to your account</p>
                          <p className="text-xs text-muted-foreground mt-1">Contact your administrator to assign grades</p>
                        </div>
                      )}
                      {form.formState.errors.grades && (
                        <p className="text-sm text-red-500">{form.formState.errors.grades.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subjects">Subject *</Label>
                      {loadingUserData ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span className="text-sm text-muted-foreground">Loading subjects...</span>
                        </div>
                      ) : userSubjects.length > 0 ? (
                        <Select
                          value={form.watch("subjects")?.[0] || ""}
                          onValueChange={(value) => form.setValue("subjects", [value])}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select subject" />
                          </SelectTrigger>
                          <SelectContent>
                            {userSubjects.map((subjectValue) => (
                              <SelectItem key={subjectValue} value={subjectValue}>
                                {subjectValue.replace(/([A-Z])/g, ' $1').trim()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md text-center">
                          <p className="text-sm text-muted-foreground">No subjects assigned to your account</p>
                          <p className="text-xs text-muted-foreground mt-1">Contact your administrator to assign subjects</p>
                        </div>
                      )}
                      {form.formState.errors.subjects && (
                        <p className="text-sm text-red-500">{form.formState.errors.subjects.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="language">Language *</Label>
                      <Select
                        value={form.watch("language")}
                        onValueChange={(value) => form.setValue("language", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="english">English</SelectItem>
                          <SelectItem value="arabic">Arabic</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.language && (
                        <p className="text-sm text-red-500">{form.formState.errors.language.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Topic */}
                  <div className="space-y-2">
                    <Label htmlFor="topic">Topic *</Label>
                    <Input
                      id="topic"
                      placeholder="Enter the main topic"
                      {...form.register("topic")}
                    />
                    {form.formState.errors.topic && (
                      <p className="text-sm text-red-500">{form.formState.errors.topic.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="objective">Learning Objective *</Label>
                    <Textarea
                      id="objective"
                      placeholder="Describe what students will learn"
                      rows={3}
                      {...form.register("objective")}
                    />
                    {form.formState.errors.objective && (
                      <p className="text-sm text-red-500">{form.formState.errors.objective.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emotionalConsideration">Emotional Consideration *</Label>
                    <Textarea
                      id="emotionalConsideration"
                      placeholder="Consider emotional aspects and student well-being"
                      rows={3}
                      {...form.register("emotionalConsideration")}
                    />
                    {form.formState.errors.emotionalConsideration && (
                      <p className="text-sm text-red-500">{form.formState.errors.emotionalConsideration.message}</p>
                    )}
                  </div>

                  <Separator />

                  {/* Content Options */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Content Options</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="adaptiveLearning"
                          checked={form.watch("adaptiveLearning")}
                          onCheckedChange={(checked) => form.setValue("adaptiveLearning", checked)}
                        />
                        <Label htmlFor="adaptiveLearning">Adaptive Learning</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="includeAssessment"
                          checked={form.watch("includeAssessment")}
                          onCheckedChange={(checked) => form.setValue("includeAssessment", checked)}
                        />
                        <Label htmlFor="includeAssessment">Include Assessment</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="multimediaSuggestions"
                          checked={form.watch("multimediaSuggestions")}
                          onCheckedChange={(checked) => form.setValue("multimediaSuggestions", checked)}
                        />
                        <Label htmlFor="multimediaSuggestions">Multimedia Suggestions</Label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Instruction Depth and Content Version */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="instructionDepth">Instruction Depth *</Label>
                      <Select
                        value={form.watch("instructionDepth")}
                        onValueChange={(value) => form.setValue("instructionDepth", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select instruction depth" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="simplified">Simplified</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="enriched">Enriched</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.instructionDepth && (
                        <p className="text-sm text-red-500">{form.formState.errors.instructionDepth.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contentVersion">Content Version *</Label>
                      <Select
                        value={form.watch("contentVersion")}
                        onValueChange={(value) => form.setValue("contentVersion", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select content version" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="simplified">Simplified</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="enriched">Enriched</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.contentVersion && (
                        <p className="text-sm text-red-500">{form.formState.errors.contentVersion.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cancelEdit}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="min-w-[120px] cursor-pointer">
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Generate Content
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {generatedContent && !editingContent && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Generated Content
                </CardTitle>
                <CardDescription>
                  Review your generated content and save it to your database
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ContentPreview
                  content={generatedContent.generatedContent}
                  metadata={generatedContent}
                  onGenerateSlides={handleGenerateSlidesClick}
                  isGeneratingSlides={isGeneratingSlides}
                  onEditContent={handleEditContent}
                  isEditable={true}
                />

                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={handleSaveToDatabase}
                    disabled={isSaving}
                    className="min-w-[150px]"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 mr-2" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="saved" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Saved Content</h2>
            <div className="flex items-center gap-2">
              <Button
                onClick={loadSavedContent}
                variant="outline"
                size="sm"
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Badge variant="outline" className="text-sm">
                {savedContent.length} items
              </Badge>
            </div>
          </div>

          {savedContent.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No saved content</h3>
                <p className="text-gray-500 text-center mb-4">
                  Create your first content by filling out the form
                </p>
                <Button onClick={() => setActiveTab("form")} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Content
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {savedContent.map((content) => (
                <div key={content._id} className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">
                            {content.title || content.topic}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {content.contentType.charAt(0).toUpperCase() + content.contentType.slice(1)}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => previewContentHandler(content)}
                            title="Preview Content"
                            className="cursor-pointer"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => editContent(content)}
                            className="cursor-pointer"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteContent(content._id)}
                            className="text-red-600 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {content.grade}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {content.subject}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {content.language}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {content.instructionDepth}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {content.contentVersion}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Slide Generation Dialog */}
      <Dialog open={showSlideDialog} onOpenChange={setShowSlideDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Generate Presentation Slides</DialogTitle>
            <DialogDescription>
              Configure the slide generation options for your content.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="slideCount" className="text-right">
                Number of Slides
              </Label>
              <Input
                id="slideCount"
                type="number"
                min="1"
                max="50"
                value={slideCount}
                onChange={(e) => setSlideCount(parseInt(e.target.value) || 10)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="template" className="text-right">
                Template
              </Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {presentationTemplates.map((template) => (
                    <SelectItem key={template} value={template}>
                      {template.charAt(0).toUpperCase() + template.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSlideDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateSlides} disabled={isGeneratingSlides}>
              {isGeneratingSlides ? (
                <>
                  <Loader2 className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                "Generate Slides"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Presentation Viewer Modal */}
      {showPresentationModal && generatedPresentation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">Generated Presentation</h3>
              <Button variant="outline" size="sm" onClick={() => setShowPresentationModal(false)}>
                ✕
              </Button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              <PPTXViewer
                presentationUrl={generatedPresentation.task_result?.url}
                downloadUrl={generatedPresentation.task_result?.download_url}
                title={generatedPresentation.title}
                slideCount={generatedPresentation.slideCount}
                status={generatedPresentation.task_status}
                errorMessage={generatedPresentation.task_result?.error}
                onSave={handleSavePresentation}
                isSaving={isSavingPresentation}
              />
            </div>
          </div>
        </div>
      )}

      {previewContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">Content Preview</h3>
              <Button variant="outline" size="sm" onClick={closePreview}>
                ✕
              </Button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              <ContentPreview
                content={previewContent.generatedContent}
                metadata={previewContent}
                onGenerateSlides={handleGenerateSlidesClick}
                isGeneratingSlides={isGeneratingSlides}
                onEditContent={handleEditContent}
                isEditable={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}