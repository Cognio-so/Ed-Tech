"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import SlideForm from './slide-form';
import PPTXViewer from '@/components/pptx-viewer';
import { savePresentationToDatabase } from './action';
import { Button } from '@/components/ui/button';

const SlidesGenerator = ({ setGeneratedContent }) => {
  const [generatedPresentation, setGeneratedPresentation] = useState(null);
  const [showPresentationModal, setShowPresentationModal] = useState(false);
  const [isSavingPresentation, setIsSavingPresentation] = useState(false);

  const handlePresentationGenerated = (presentationData) => {
    setGeneratedPresentation(presentationData);
    setShowPresentationModal(true);
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

  return (
    <div className="space-y-6">
      <SlideForm onPresentationGenerated={handlePresentationGenerated} />

      {/* Presentation Viewer Modal */}
      {showPresentationModal && generatedPresentation && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-secondary rounded-lg max-w-4xl w-full max-h-[100vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold dark:text-white">Generated Presentation</h3>
              <Button variant="outline" size="sm" onClick={() => setShowPresentationModal(false)}>
                ✕
              </Button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)] text-black dark:text-white">
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
