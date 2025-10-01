"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, Download, Trash2, Save, Maximize2, BookOpen, Sparkles, Play, Pause, Grid, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CarouselWithControls } from "@/components/ui/carousel";
import { toast } from "sonner";
import ComicForm from "./comic-form";
import { generateComic, saveComicWithCloudinaryUrls } from "./action";
import { authClient } from "@/lib/auth-client";
import PythonApiClient from "@/lib/PythonApi";

export default function ComicPage() {
  const [user, setUser] = useState(null);
  const [comicImages, setComicImages] = useState([]);
  const [comicTexts, setComicTexts] = useState([]); // Store text separately
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [liveViewerOpen, setLiveViewerOpen] = useState(false);
  const [currentFormData, setCurrentFormData] = useState(null);
  const [abortController, setAbortController] = useState(null);
  const [expectedPanels, setExpectedPanels] = useState(0);
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0);

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

  const handleGenerate = async (formData) => {
    setIsLoading(true);
    setError(null);
    setComicImages([]);
    setComicTexts([]); // Clear previous texts
    setCurrentFormData(formData);
    setExpectedPanels(formData.numPanels);
    setCurrentPanelIndex(0);
    setLiveViewerOpen(true);

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

  const handlePreview = (item) => {
    setPreviewItem(item);
    setPreviewOpen(true);
  };

  const handleDownload = (url, filename = 'comic-panel.png') => {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Comic downloaded successfully");
    } catch (error) {
      console.error("Failed to download comic:", error);
      toast.error("Failed to download comic");
    }
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

    if (!currentFormData) {
      toast.error("No form data available");
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
        instructions: currentFormData.instructions,
        subject: currentFormData.subject,
        gradeLevel: currentFormData.gradeLevel,
        numPanels: currentFormData.numPanels,
        language: currentFormData.language,
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
        setComicImages([]);
        setComicTexts([]); // Clear texts
        setLiveViewerOpen(false);
        setCurrentFormData(null);
        setExpectedPanels(0);
        setCurrentPanelIndex(0);
        toast.success('Comic saved successfully! You can view it in your Library.');
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

  return (
    <div className="min-h-screen bg-background dark:bg-secondary rounded-3xl">
      <div className="container mx-auto p-6 space-y-8"> 
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Generation Card */}
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm dark:bg-secondary">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Generate New Comic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ComicForm 
              onSubmit={handleGenerate}
              onStop={handleStop}
              isLoading={isLoading}
              isGenerating={isGenerating}
            />
          </CardContent>
        </Card>

        {/* Live Preview Controls */}
        {(comicImages.length > 0 || expectedPanels > 0) && (
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm dark:bg-secondary">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Live Preview
                  <Badge variant="secondary">{comicImages.length}/{expectedPanels} panels</Badge>
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLiveViewerOpen(true)}
                  >
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Full View
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!comicImages.length || isSaving}
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
        )}
      </div>
    </div>
  );
}