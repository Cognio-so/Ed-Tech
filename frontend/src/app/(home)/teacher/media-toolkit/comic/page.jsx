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
import { generateComic, saveComicWithCloudinaryUrls, getComics, deleteComic } from "./action";
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
      // The user.id is no longer needed here as the server action gets it from the session
      const result = await getComics(); 
      if (result.success) {
        // Correctly access the 'comics' property from the result
        setSavedComics(result.comics);
      } else {
        toast.error(result.message || "Failed to load saved comics");
      }
    } catch (error) {
      console.error("Failed to load saved comics:", error);
      toast.error("An unexpected error occurred while loading comics.");
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

  const handleComicStream = async (formData, signal) => { // FIX: Revert to using the API client
    try {
      // Start the comics stream directly from the client, passing the signal
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
              // FIX: The backend now sends the full data URL. No need to add the prefix again.
              const dataUrl = evt.url;
              
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
      // Prepare comic data with Cloudinary URLs only (no base64)
      const comicData = {
        instructions: currentFormData.instructions,
        subject: currentFormData.subject,
        gradeLevel: currentFormData.gradeLevel,
        numPanels: currentFormData.numPanels,
        language: currentFormData.language,
        imageUrls: comicImages.map(img => img.url), // Cloudinary URLs only
        cloudinaryPublicIds: [], // Will be populated by the function
        comicType: 'educational'
      };

      // Use the NEW function that only saves Cloudinary URLs
      const result = await saveComicWithCloudinaryUrls(comicData);
      if (result.success) {
        // Reload saved comics
        await loadSavedComics();
        setComicImages([]);
        setLiveViewerOpen(false);
        setCurrentFormData(null);
        setExpectedPanels(0);
        setCurrentPanelIndex(0);
        toast.success('Comic saved successfully');
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
                    <div className="relative w-full h-[50vh] flex items-center justify-center bg-muted/20 rounded-lg overflow-hidden">
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
                  )}
                />
              </div>
            </CardContent>
          </Card>
        )}
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
                  <Eye className="h-5 w-5 text-primary" />
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