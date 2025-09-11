"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Video, Plus, History, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import VideoForm from './video-form';
import VideoPreview from '@/components/ui/video-preview';
import { saveVideoToDatabase, getUserVideos } from './action';

const VideoCreator = ({ setGeneratedContent }) => {
  const [activeTab, setActiveTab] = useState('create');
  const [generatedVideo, setGeneratedVideo] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedVideos, setSavedVideos] = useState([]);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [isSavingVideo, setIsSavingVideo] = useState(false);

  const handleVideoGenerated = async (videoData) => {
    console.log('Video generation completed:', videoData);
    
    // Only set the video if we have a videoUrl (completed)
    if (videoData.videoUrl) {
      setGeneratedVideo(videoData);
      setShowVideoModal(true);
    } else {
      // If it's still processing, just show a message
      toast.info("Video generation started. Please wait...");
    }
  };

  const handleSaveVideo = async () => {
    if (!generatedVideo) return;

    setIsSavingVideo(true);
    try {
      const videoData = {
        title: generatedVideo.title,
        topic: generatedVideo.topic,
        voiceId: generatedVideo.voiceId,
        voiceName: generatedVideo.voiceName,
        talkingPhotoId: generatedVideo.talkingPhotoId,
        talkingPhotoName: generatedVideo.talkingPhotoName,
        presentationUrl: generatedVideo.presentationUrl,
        videoUrl: generatedVideo.videoUrl,
        videoId: generatedVideo.videoId,
        slidesCount: generatedVideo.slidesCount,
        status: 'completed'
      };

      const result = await saveVideoToDatabase(videoData);
      if (result.success) {
        toast.success("Video saved to your library!");
        setShowVideoModal(false);
        loadSavedVideos();
      } else {
        toast.error(result.error || "Failed to save video");
      }
    } catch (error) {
      toast.error("Failed to save video");
      console.error("Error saving video:", error);
    } finally {
      setIsSavingVideo(false);
    }
  };

  const loadSavedVideos = async () => {
    try {
      const result = await getUserVideos();
      if (result.success) {
        setSavedVideos(result.videos);
      }
    } catch (error) {
      console.error("Error loading saved videos:", error);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Video
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2" disabled={!generatedVideo}>
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <VideoForm onVideoGenerated={handleVideoGenerated} />
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          {generatedVideo ? (
            <VideoPreview
              videoUrl={generatedVideo.videoUrl}
              title={generatedVideo.title}
              slidesCount={generatedVideo.slidesCount}
              status="completed"
              onSave={handleSaveVideo}
              isSaving={isSavingVideo}
              voiceName={generatedVideo.voiceName}
              avatarName={generatedVideo.avatarName}
              videoId={generatedVideo.videoId}
            />
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <Video className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  No video generated yet. Create a video first to see the preview.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Saved Videos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {savedVideos.length > 0 ? (
                <div className="space-y-4">
                  {savedVideos.map((video) => (
                    <div key={video._id} className="p-4 border rounded-lg">
                      <h3 className="font-medium">{video.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {video.slidesCount} slides • {video.voiceName} • {video.avatarName}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button size="sm" variant="outline">
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                  No saved videos yet. Create and save your first video!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Video Preview Modal */}
      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Video Generation Complete</DialogTitle>
            <DialogDescription>
              Your video has been generated successfully!
            </DialogDescription>
          </DialogHeader>
          
          {generatedVideo && (
            <VideoPreview
              videoUrl={generatedVideo.videoUrl}
              title={generatedVideo.title}
              slidesCount={generatedVideo.slidesCount}
              status="completed"
              onSave={handleSaveVideo}
              isSaving={isSavingVideo}
              voiceName={generatedVideo.voiceName}
              avatarName={generatedVideo.avatarName}
              videoId={generatedVideo.videoId}
            />
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVideoModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VideoCreator;