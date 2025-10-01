"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CarouselWithControls } from "@/components/ui/carousel";
import { Play, Pause, Loader2, Sparkles, Save, Eye, Maximize2 } from "lucide-react";
import { subject, grade, language } from "@/config/data";
import { generateComic, saveComicWithCloudinaryUrls, getUserAssignedGradesAndSubjects } from './action';
import { authClient } from "@/lib/auth-client";
import PythonApiClient from "@/lib/PythonApi";
import { toast } from "sonner";

const ComicForm = ({ onComicGenerated }) => {
  const [formData, setFormData] = useState({
    instructions: "",
    subject: "General",
    gradeLevel: "8",
    numPanels: 4,
    language: "English"
  });
  const [userGrades, setUserGrades] = useState([]);
  const [userSubjects, setUserSubjects] = useState([]);
  const [loadingUserData, setLoadingUserData] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [comicImages, setComicImages] = useState([]);
  const [comicTexts, setComicTexts] = useState([]);
  const [expectedPanels, setExpectedPanels] = useState(0);
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0);
  const [abortController, setAbortController] = useState(null);
  const [user, setUser] = useState(null);

  // Get user session on component mount
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data } = await authClient.getSession();
        setUser(data?.user || null);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };

    getUser();
  }, []);

  // Fetch user's assigned grades and subjects
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoadingUserData(true);
        const result = await getUserAssignedGradesAndSubjects();
        
        if (result.success) {
          setUserGrades(result.grades);
          setUserSubjects(result.subjects);
          // Set default values if user has assigned data
          if (result.grades.length > 0) {
            setFormData(prev => ({ ...prev, gradeLevel: result.grades[0] }));
          }
          if (result.subjects.length > 0) {
            setFormData(prev => ({ ...prev, subject: result.subjects[0] }));
          }
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

  const panelOptions = Array.from({ length: 20 }, (_, i) => i + 1);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    
    if (!formData.instructions.trim()) {
      toast.error("Please provide instructions for the comic");
      return;
    }

    setIsLoading(true);
    setError(null);
    setComicImages([]);
    setComicTexts([]);
    setExpectedPanels(formData.numPanels);
    setCurrentPanelIndex(0);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const result = await generateComic(formData);
      if (result.success) {
        setIsGenerating(true);
        await handleComicStream(formData, controller.signal);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || "Failed to generate comic");
        toast.error("Failed to generate comic");
        setIsGenerating(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleComicStream = async (formData, signal) => {
    try {
      const response = await PythonApiClient.startComicsStream(formData, signal);
      
      if (!response.ok || !response.body) {
        const txt = await response.text().catch(() => '');
        console.error('Stream response error:', txt);
        throw new Error(txt || 'Failed to start stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          
          const json = line.slice(5).trim();
          
          try {
            const evt = JSON.parse(json);
            
            if (evt.type === 'panel_image' && evt.url) {
              const dataUrl = evt.url;
              
              // Update images
              setComicImages(prev => {
                const existingIndex = prev.findIndex(p => p.index === evt.index);
                if (existingIndex >= 0) {
                  const newImages = [...prev];
                  newImages[existingIndex] = { index: evt.index, url: dataUrl };
                  return newImages;
                } else {
                  return [...prev, { index: evt.index, url: dataUrl }].sort((a, b) => a.index - b.index);
                }
              });

              // Update texts separately
              if (evt.footer_text) {
                setComicTexts(prev => {
                  const existingIndex = prev.findIndex(p => p.index === evt.index);
                  if (existingIndex >= 0) {
                    const newTexts = [...prev];
                    newTexts[existingIndex] = { index: evt.index, text: evt.footer_text };
                    return newTexts;
                  } else {
                    return [...prev, { index: evt.index, text: evt.footer_text }].sort((a, b) => a.index - b.index);
                  }
                });
              }

              setTimeout(() => {
                setCurrentPanelIndex(evt.index);
              }, 1000);
            }
            
            if (evt.type === 'done') {
              console.log('Comic generation completed');
            }
            
            if (evt.type === 'error') {
              throw new Error(evt.message || 'Comic generation failed');
            }
          } catch (parseError) {
            console.error('Error parsing SSE event:', parseError);
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Comic generation was stopped by the user.');
      } else {
        console.error('Stream error:', error);
        setError(error.message);
        toast.error("An error occurred during generation.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
    }
    toast.info("Comic generation stopped");
  };

  const handleSave = async () => {
    if (!comicImages.length) {
      toast.error('No comic to save');
      return;
    }

    if (!user?.id) {
      toast.error("User not authenticated");
      return;
    }

    setIsSaving(true);
    try {
      console.log(`Starting upload of ${comicImages.length} comic panels to Cloudinary...`);
      
      // Upload all images to Cloudinary from client side first
      const uploadPromises = comicImages.map(async (imageData, index) => {
        try {
          const response = await fetch('/api/upload-to-cloudinary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              base64Image: imageData.url,
              folder: 'ai-comics'
            }),
          });

          const result = await response.json();
          
          if (result.success) {
            console.log(`Successfully uploaded panel ${index + 1} to Cloudinary`);
            return {
              index: imageData.index,
              url: result.url,
              publicId: result.publicId
            };
          } else {
            throw new Error(`Failed to upload panel ${index + 1}: ${result.error}`);
          }
        } catch (error) {
          console.error(`Error uploading panel ${index + 1}:`, error);
          throw error;
        }
      });

      // Wait for all uploads to complete
      const uploadResults = await Promise.all(uploadPromises);
      
      // Sort results by index to maintain order
      uploadResults.sort((a, b) => a.index - b.index);
      
      const cloudinaryUrls = uploadResults.map(result => result.url);
      const cloudinaryPublicIds = uploadResults.map(result => result.publicId);

      console.log(`Successfully uploaded all ${cloudinaryUrls.length} panels to Cloudinary`);

      // Now prepare comic data with Cloudinary URLs only (no base64)
      const comicData = {
        instructions: formData.instructions,
        subject: formData.subject,
        gradeLevel: formData.gradeLevel,
        numPanels: formData.numPanels,
        language: formData.language,
        imageUrls: cloudinaryUrls, // Cloudinary URLs only
        cloudinaryPublicIds: cloudinaryPublicIds, // Cloudinary public IDs
        panelTexts: comicTexts.map(text => ({ // Include panel texts
          index: text.index,
          text: text.text
        })),
        comicType: 'educational'
      };

      // Use the function that only saves Cloudinary URLs (no base64 processing)
      const result = await saveComicWithCloudinaryUrls(comicData);
      if (result.success) {
        if (onComicGenerated) {
          onComicGenerated({
            _id: result.id,
            title: result.comic.title,
            instruction: result.comic.instruction,
            subject: result.comic.subject,
            grade: result.comic.grade,
            language: result.comic.language,
            numPanels: result.comic.numPanels,
            comicType: result.comic.comicType,
            imageUrls: result.comic.imageUrls,
            cloudinaryPublicIds: result.comic.cloudinaryPublicIds,
            panelTexts: result.comic.panelTexts,
            status: 'completed',
            metadata: result.comic.metadata,
            createdAt: result.comic.createdAt,
            updatedAt: result.comic.updatedAt
          });
        }

        toast.success('Comic saved successfully! You can view it in your Library.');
        
        // Reset form and state
        setComicImages([]);
        setComicTexts([]);
        setExpectedPanels(0);
        setCurrentPanelIndex(0);
        setFormData({
          instructions: "",
          subject: "General",
          gradeLevel: "8",
          numPanels: 4,
          language: "English"
        });
      } else {
        throw new Error(result.error || "Failed to save comic");
      }
    } catch (error) {
      console.error("Failed to save comic:", error);
      toast.error(`Failed to save comic: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Create loading placeholders for expected panels
  const createLoadingPanels = () => {
    const loadingPanels = [];
    for (let i = 1; i <= expectedPanels; i++) {
      const existingPanel = comicImages.find(img => img.index === i);
      if (!existingPanel) {
        loadingPanels.push({
          index: i,
          url: null,
          isLoading: true
        });
      }
    }
    return loadingPanels;
  };

  // Combine actual images with loading placeholders
  const allPanels = [
    ...comicImages,
    ...createLoadingPanels()
  ].sort((a, b) => a.index - b.index);

  // Get text for a specific panel
  const getPanelText = (panelIndex) => {
    return comicTexts.find(t => t.index === panelIndex)?.text || '';
  };

  const canGenerate = formData.instructions.trim() && formData.gradeLevel && formData.numPanels > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-4xl mx-auto space-y-6"
    >
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Generation Form */}
      <Card className="shadow-lg dark:bg-secondary">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Generate New Comic
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleGenerate} className="space-y-6">
          {/* Instructions */}
          <div className="space-y-2">
            <Label htmlFor="instructions">Topic & Instructions *</Label>
            <Textarea
              id="instructions"
              placeholder="e.g., Create a fun comic explaining photosynthesis for 5th graders with plant characters"
              value={formData.instructions}
              onChange={(e) => handleInputChange("instructions", e.target.value)}
                className="min-h-[120px] resize-none dark:bg-secondary dark:text-white"
              required
            />
            <p className="text-xs text-muted-foreground">
              Describe the educational topic and any specific requirements for your comic
            </p>
          </div>

          {/* Subject and Grade Level */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              {loadingUserData ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Loading subjects...</span>
                </div>
              ) : userSubjects.length > 0 ? (
                <Select value={formData.subject} onValueChange={(value) => handleInputChange("subject", value)}>
                    <SelectTrigger className="dark:bg-secondary dark:text-white">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                    <SelectContent className="dark:bg-secondary dark:text-white">
                    {userSubjects.map((sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub.charAt(0).toUpperCase() + sub.slice(1)}
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
            </div>

              <div className="space-y-2">
              <Label htmlFor="gradeLevel">Grade Level</Label>
              {loadingUserData ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Loading grades...</span>
                </div>
              ) : userGrades.length > 0 ? (
                <Select value={formData.gradeLevel} onValueChange={(value) => handleInputChange("gradeLevel", value)}>
                    <SelectTrigger className="dark:bg-secondary dark:text-white">
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                    <SelectContent className="dark:bg-secondary dark:text-white">
                    {userGrades.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g === "kg1" ? "Kindergarten 1" : 
                         g === "kg2" ? "Kindergarten 2" : 
                         `${g}`}
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
            </div>
          </div>

          {/* Number of Panels and Language */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numPanels">Number of Panels</Label>
              <Select value={formData.numPanels.toString()} onValueChange={(value) => handleInputChange("numPanels", parseInt(value))}>
                  <SelectTrigger className="dark:bg-secondary dark:text-white">
                  <SelectValue placeholder="Select number of panels" />
                </SelectTrigger>
                  <SelectContent className="dark:bg-secondary dark:text-white">
                  {panelOptions.map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} panel{num > 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select value={formData.language} onValueChange={(value) => handleInputChange("language", value)}>
                  <SelectTrigger className="dark:bg-secondary dark:text-white">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                  <SelectContent className="dark:bg-secondary dark:text-white">
                  {language.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            {!isGenerating ? (
              <Button
                type="submit"
                disabled={!canGenerate || isLoading}
                className="flex-1 bg-purple-600 hover:bg-purple-600/90 text-white shadow-lg"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Create Comic
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleStop}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                <Pause className="h-4 w-4 mr-2" />
                Stop Generation
              </Button>
            )}
          </div>
          </form>
        </CardContent>
      </Card>

      {/* Live Preview */}
      {(comicImages.length > 0 || expectedPanels > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm dark:bg-secondary">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Live Preview
                  <Badge variant="secondary">{comicImages.length}/{expectedPanels} panels</Badge>
                </CardTitle>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!comicImages.length || isSaving}
                  className="bg-purple-600 hover:bg-purple-600/90 text-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Comic
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/10 flex items-center justify-center overflow-hidden p-4 dark:bg-secondary">
                <CarouselWithControls
                  items={allPanels}
                  showIndicators={true}
                  renderItem={(p) => (
                    <div className="space-y-4">
                      {/* Image */}
                      <div className="relative w-full h-[40vh] flex items-center justify-center bg-muted/20 rounded-lg overflow-hidden">
                        {p.isLoading ? (
                          <div className="flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <div className="text-center">
                              <p className="text-sm font-medium">Generating Panel {p.index}</p>
                              <p className="text-xs text-muted-foreground">Please wait...</p>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={p.url}
                            alt={`Panel ${p.index}`}
                            className="max-h-full max-w-full object-contain"
                          />
                        )}
                      </div>
                      
                      {/* Text Display - Separate from image */}
                      {!p.isLoading && getPanelText(p.index) && (
                        <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 shadow-sm">
                          <div className="text-center">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed">
                              {getPanelText(p.index)}
                            </p>
        </div>
      </div>
                      )}
                    </div>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ComicForm;
