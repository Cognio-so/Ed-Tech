"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Plus, History, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import SlideForm from './slide-form';
import PPTXViewer from '@/components/pptx-viewer';
import { savePresentationToDatabase, getUserPresentations } from './action';

const SlidesGenerator = ({ setGeneratedContent }) => {
  const [activeTab, setActiveTab] = useState('create');
  const [generatedPresentation, setGeneratedPresentation] = useState(null);
  const [savedPresentations, setSavedPresentations] = useState([]);
  const [showPresentationModal, setShowPresentationModal] = useState(false);
  const [isSavingPresentation, setIsSavingPresentation] = useState(false);

  // Load saved presentations on component mount
  React.useEffect(() => {
    loadSavedPresentations();
  }, []);

  const handlePresentationGenerated = (presentationData) => {
    setGeneratedPresentation(presentationData);
    setShowPresentationModal(true);
    
    // Remove this section - don't update parent component's generated content state
    // if (setGeneratedContent) {
    //   setGeneratedContent(prev => ({
    //     ...prev,
    //     slides: {
    //       title: presentationData.title,
    //       preview: `Generated ${presentationData.slideCount} slides on ${presentationData.topic}`,
    //       url: presentationData.task_result?.url,
    //       downloadUrl: presentationData.task_result?.download_url,
    //       status: presentationData.task_status
    //     }
    //   }));
    // }
  };

  const handleSavePresentation = async () => {
    if (!generatedPresentation) return;

    setIsSavingPresentation(true);
    try {
      const presentationData = {
        title: generatedPresentation.title,
        topic: generatedPresentation.topic,
        slideCount: generatedPresentation.slideCount,
        template: generatedPresentation.template,
        language: generatedPresentation.language,
        verbosity: generatedPresentation.verbosity,
        includeImages: generatedPresentation.includeImages,
        instructions: generatedPresentation.instructions,
        presentationUrl: generatedPresentation.task_result?.url,
        downloadUrl: generatedPresentation.task_result?.download_url,
        taskId: generatedPresentation.task_id,
        taskStatus: generatedPresentation.task_status,
        tags: [generatedPresentation.topic, generatedPresentation.template],
        isPublic: false
      };

      const result = await savePresentationToDatabase(presentationData);

      if (result.success) {
        toast.success("Presentation saved to library successfully!");
        setShowPresentationModal(false);
        setGeneratedPresentation(null);
        // Refresh the presentations list from database
        loadSavedPresentations();
      } else {
        toast.error(result.error || "Failed to save presentation");
      }
    } catch (error) {
      toast.error("Failed to save presentation");
      console.error("Error:", error);
    } finally {
      setIsSavingPresentation(false);
    }
  };

  const loadSavedPresentations = async () => {
    try {
      const result = await getUserPresentations();
      if (result.success) {
        setSavedPresentations(result.presentations);
      }
    } catch (error) {
      console.error("Error loading presentations:", error);
    }
  };

  const handleViewPresentation = (presentation) => {
    setGeneratedPresentation({
      ...presentation,
      task_result: {
        url: presentation.presentationUrl,
        download_url: presentation.downloadUrl
      },
      task_id: presentation.taskId,
      task_status: presentation.taskStatus
    });
    setShowPresentationModal(true);
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create New
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            My Presentations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <SlideForm onPresentationGenerated={handlePresentationGenerated} />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">My Presentations</h2>
          </div>

          {savedPresentations.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No presentations saved yet. Create your first presentation!
                </p>
                <Button onClick={() => setActiveTab('create')}>
                  Create Presentation
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedPresentations.map((presentation) => (
                <motion.div
                  key={presentation._id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => handleViewPresentation(presentation)}>
                    <CardHeader>
                      <CardTitle className="text-lg truncate">
                        {presentation.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        <p><strong>Topic:</strong> {presentation.topic}</p>
                        <p><strong>Slides:</strong> {presentation.slideCount}</p>
                        <p><strong>Template:</strong> {presentation.template}</p>
                        <p><strong>Language:</strong> {presentation.language}</p>
                        <p><strong>Created:</strong> {new Date(presentation.metadata.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Button 
                        className="w-full mt-4" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewPresentation(presentation);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Presentation
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
    </div>
  );
};

export default SlidesGenerator;
