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
import { generateComic, uploadComicImagesToCloudinaryAndSave, getComics,  deleteComic } from "./action";
import { authClient } from "@/lib/auth-client";
import PythonApiClient from "@/lib/PythonApi";

export default function ComicPage() {
  const [user, setUser] = useState(null);
  const [comicImages, setComicImages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedComics, setSavedComics] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [liveViewerOpen, setLiveViewerOpen] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
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

  // Load saved comics when user is available
  useEffect(() => {
    if (user?.id) {
      loadSavedComics();
    }
  }, [user?.id]);

  const loadSavedComics = async () => {
    setLoadingSaved(true);
    try {
      const result = await getComics(user.id);
      if (result.success) {
        setSavedComics(result.data);
      }
    } catch (error) {
      console.error("Failed to load saved comics:", error);
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleGenerate = async (formData) => {
    setIsLoading(true);
    setError(null);
    setComicImages([]);
    setCurrentFormData(formData);
    setExpectedPanels(formData.numPanels);
    setCurrentPanelIndex(0);
    setLiveViewerOpen(true);

    try {
      // Call the server action to validate the request
      const result = await generateComic(formData);
      if (result.success) {
        setIsGenerating(true);
        // Start the streaming directly from the client
        await handleComicStream(formData);
      }
    } catch (err) {
      setError(err.message || "Failed to generate comic");
      toast.error("Failed to generate comic");
      setIsGenerating(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComicStream = async (formData) => {
    try {
      // Start the comics stream directly from the client
      const response = await PythonApiClient.startComicsStream(formData);
      
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
        console.log('Received chunk:', chunk);
        buffer += chunk;

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          
          const json = line.slice(5).trim();
          console.log('Parsing JSON:', json);
          
          try {
            const evt = JSON.parse(json);
            console.log('Parsed event:', evt);
            
            // Handle story prompts
            if (evt.type === 'story_prompts') {
              console.log('Story prompts received:', evt.content);
            }
            
            // Handle panel prompts
            if (evt.type === 'panel_prompt') {
              console.log(`Panel ${evt.index} prompt:`, evt.prompt);
            }
            
            // Handle panel images - convert base64 to data URL
            if (evt.type === 'panel_image' && evt.url) {
              console.log(`Panel ${evt.index} image received, length:`, evt.url.length);
              // Convert base64 to data URL
              const dataUrl = `data:image/png;base64,${evt.url}`;
              
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

              // Auto-advance to the next panel after a short delay
              setTimeout(() => {
                setCurrentPanelIndex(evt.index);
              }, 1000);
            }
            
            // Handle completion
            if (evt.type === 'done') {
              console.log('Comic generation completed');
              setIsGenerating(false);
            }
            
            // Handle errors
            if (evt.type === 'error') {
              throw new Error(evt.message || 'Comic generation failed');
            }
          } catch (parseError) {
            console.error('Error parsing SSE event:', parseError);
          }
        }
      }
    } catch (error) {
      console.error('Stream error:', error);
      setError(error.message);
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
    }
    setIsGenerating(false);
    toast.success("Comic generation stopped");
  };

  const handlePreview = (item) => {
    setPreviewItem(item);
    setPreviewOpen(true);
  };

  const handleDelete = async (id) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return;
    }

    try {
      const result = await deleteComic(id, user.id);
      if (result.success) {
        setSavedComics(prev => prev.filter(item => item._id !== id));
        toast.success("Comic deleted successfully");
      }
    } catch (error) {
      console.error("Failed to delete comic:", error);
      toast.error("Failed to delete comic");
    }
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
      const comicData = {
        instructions: currentFormData.instructions,
        subject: currentFormData.subject,
        gradeLevel: currentFormData.gradeLevel,
        numPanels: currentFormData.numPanels,
        language: currentFormData.language,
        images: comicImages.map(img => img.url), // Base64 data URLs for upload
        comicType: 'educational'
      };

      // Use the new function that uploads to Cloudinary first
      const result = await uploadComicImagesToCloudinaryAndSave(comicData, user.id);
      if (result.success) {
        // Reload saved comics
        await loadSavedComics();
        setComicImages([]);
        setLiveViewerOpen(false);
        setCurrentFormData(null);
        setExpectedPanels(0);
        setCurrentPanelIndex(0);
        toast.success('Comic saved successfully');
      }
    } catch (error) {
      console.error("Failed to save comic:", error);
      toast.error("Failed to save comic");
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (dateStr) => {
    try { 
      return new Date(dateStr).toLocaleString() 
    } catch { 
      return '' 
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-6 space-y-8">
        {/* Hero Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Comic Creator</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
            Create Educational Comics
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Transform educational content into engaging comic stories using AI. Perfect for visual learners and creative storytelling.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Generation Card */}
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
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
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-green-600" />
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
              <div className="aspect-video rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/10 flex items-center justify-center overflow-hidden">
                <div className="w-full h-full p-4">
                  <CarouselWithControls
                    items={allPanels}
                    showIndicators={true}
                    renderItem={(p) => (
                      <div className="rounded-lg overflow-hidden bg-background h-full flex items-center justify-center">
                        {p.isLoading ? (
                          <div className="flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                            <div className="text-center">
                              <p className="text-sm font-medium">Generating Panel {p.index}</p>
                              <p className="text-xs text-muted-foreground">Please wait...</p>
                            </div>
                          </div>
                        ) : (
                          <img src={p.url} alt={`Panel ${p.index}`} className="max-h-full max-w-full object-contain" />
                        )}
                      </div>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Saved Comics Gallery */}
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Your Comics Library
                  <Badge variant="secondary" className="ml-2">{savedComics.length}</Badge>
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingSaved ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : savedComics.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">No comics yet</h3>
                <p className="text-muted-foreground mb-4">Create your first educational comic to get started</p>
              </div>
            ) : (
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {savedComics.map((item) => (
                  <div key={item._id} className="group relative">
                    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-background to-muted/20">
                      {/* Thumbnail */}
                      <div className="aspect-square overflow-hidden bg-gradient-to-br from-muted/20 to-muted/40 relative">
                        {(item.imageUrls?.[0] || item.images?.[0]) ? (
                          <>
                            <img 
                              src={item.imageUrls?.[0] || item.images?.[0]} 
                              alt={item.instruction || item.instructions} 
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <BookOpen className="h-12 w-12 text-muted-foreground/50" />
                          </div>
                        )}
                        
                        {/* Action Buttons Overlay */}
                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
                            onClick={() => handlePreview(item)}
                          >
                            <Eye className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
                            onClick={() => item.images?.[0] && handleDownload(item.images[0], `${item.instructions.slice(0,20)}.png`)}
                          >
                            <Download className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
                            onClick={() => handleDelete(item._id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>

                        {/* Panel Count Badge */}
                        <div className="absolute bottom-3 left-3">
                          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-xs">
                            {item.numPanels} panels
                          </Badge>
                        </div>
                      </div>

                      {/* Content */}
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-sm line-clamp-2 mb-2">{item.instruction || item.instructions}</h3>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Grade {item.grade || item.gradeLevel}</span>
                          <span>{formatTime(item.createdAt)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live Viewer Dialog */}
      <Dialog open={liveViewerOpen} onOpenChange={setLiveViewerOpen}>
        <DialogContent className="w-[95vw] max-w-[1400px] h-[95vh] p-0">
          <div className="flex flex-col h-full">
            <DialogHeader className="p-6 pb-2 border-b">
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  Live Comic Viewer
                  <Badge variant="secondary">{comicImages.length}/{expectedPanels} panels</Badge>
                </div>
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 p-6 overflow-hidden">
              {allPanels.length > 0 ? (
                <CarouselWithControls
                  items={allPanels}
                  className="h-full"
                  renderItem={(p) => (
                    <div className="rounded-xl border overflow-hidden bg-white dark:bg-gray-800">
                      {p.isLoading ? (
                        <div className="flex flex-col items-center justify-center h-[calc(85vh-200px)] space-y-4">
                          <Loader2 className="h-16 w-16 animate-spin text-blue-500" />
                          <div className="text-center">
                            <p className="text-lg font-medium">Generating Panel {p.index}</p>
                            <p className="text-sm text-muted-foreground">Creating your comic story...</p>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={p.url}
                          alt={`Comic Panel ${p.index}`}
                          className="w-full h-auto object-contain"
                          onError={(e) => {
                            console.error('Image failed to load:', p.url);
                            e.target.style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                  )}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-gray-600 dark:text-gray-400">Waiting for comic panels...</p>
                    <p className="text-xs text-gray-500">Images received: {comicImages.length}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 pt-2 border-t">
              <div className="flex justify-end gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => comicImages?.[0]?.url && handleDownload(comicImages[0].url, 'comic.png')} 
                  disabled={!comicImages.length || isSaving}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download First
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[95vw] max-w-[1400px] h-[95vh] p-0">
          <div className="flex flex-col h-full">
            <DialogHeader className="p-6 pb-2 border-b">
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-green-600" />
                  Comic Preview
                  {previewItem && (
                    <Badge variant="outline" className="ml-2">
                      Grade {previewItem.gradeLevel}
                    </Badge>
                  )}
                </div>
              </DialogTitle>
            </DialogHeader>
            
            {previewItem && (
              <div className="flex-1 p-6 overflow-hidden">
                <CarouselWithControls
                  items={(previewItem.imageUrls || previewItem.images || []).map((url, i) => ({ url, index: i + 1 }))}
                  className="h-full"
                  renderItem={(p) => (
                    <div className="rounded-xl border overflow-hidden bg-gradient-to-br from-background to-muted/10 flex items-center justify-center h-[calc(85vh-200px)]">
                      <img 
                        src={p.url} 
                        alt={`Panel ${p.index}`} 
                        className="max-h-full max-w-full object-contain rounded-lg shadow-lg" 
                      />
                    </div>
                  )}
                />
              </div>
            )}
            
            {previewItem && (
              <div className="p-6 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium">{previewItem.instruction || previewItem.instructions}</p>
                    <p>{previewItem.numPanels || (previewItem.imageUrls?.length || previewItem.images?.length || 0)} panels • Created {formatTime(previewItem.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => previewItem.images?.[0] && handleDownload(previewItem.images[0], `${previewItem.instructions.slice(0,20)}.png`)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
