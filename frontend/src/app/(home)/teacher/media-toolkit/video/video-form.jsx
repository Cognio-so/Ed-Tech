"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Wand2, Video, Upload, Mic, User } from 'lucide-react';
import { toast } from 'sonner';
import { voiceIds, talkingImages } from '@/config/data';
import { generateVideoFromPPTX } from './action';

const VideoForm = ({ onVideoGenerated }) => {
    const [formData, setFormData] = useState({
        title: '',
        topic: '',
        pptxFile: null,
        voiceId: '',
        talkingPhotoId: ''
    });

    const [isGenerating, setIsGenerating] = useState(false);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.type !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
                toast.error("Please upload a valid PowerPoint (.pptx) file");
                return;
            }
            setFormData(prev => ({
                ...prev,
                pptxFile: file
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title.trim() || !formData.topic.trim() || !formData.pptxFile || !formData.voiceId || !formData.talkingPhotoId) {
            toast.error("Please fill in all required fields and upload a PPTX file");
            return;
        }

        setIsGenerating(true);

        // Show a persistent loading message
        const loadingToast = toast.loading("Video generation in progress... This may take 10-15 minutes. Please don't close this tab.", {
            duration: Infinity, // Keep the toast until manually dismissed
        });

        try {
            const videoData = {
                pptx_file: formData.pptxFile,
                voice_id: formData.voiceId,
                talking_photo_id: formData.talkingPhotoId,
                title: formData.title
            };

            const result = await generateVideoFromPPTX(videoData);

            // Dismiss the loading toast
            toast.dismiss(loadingToast);

            if (result.success) {
                // Only show success and call onVideoGenerated if we have a video URL
                if (result.video_url) {
                    toast.success("Video generation completed successfully!");

                    // Pass the generated video data to parent component
                    if (onVideoGenerated) {
                        onVideoGenerated({
                            title: formData.title,
                            topic: formData.topic,
                            voiceId: formData.voiceId,
                            talkingPhotoId: formData.talkingPhotoId,
                            voiceName: selectedVoice?.name,
                            talkingPhotoName: selectedAvatar?.talking_photo_name,
                            videoUrl: result.video_url,
                            videoId: result.video_id,
                            slidesCount: result.slides_count,
                            status: 'completed'
                        });
                    }
                } else {
                    // Just show that generation started
                    toast.info("Video generation started. This will take some time...");
                }
            } else {
                toast.error(result.error || "Failed to generate video");
            }
        } catch (error) {
            // Dismiss the loading toast
            toast.dismiss(loadingToast);

            console.error("Error:", error);

            if (error.message.includes('timed out')) {
                toast.error("Request timed out. Video generation may still be in progress. Please check back later or try again.");
            } else {
                toast.error("Failed to generate video. Please try again.");
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const selectedVoice = voiceIds.find(voice => voice.voice_id === formData.voiceId);
    const selectedAvatar = talkingImages.find(avatar => avatar.talking_photo_id === formData.talkingPhotoId);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <Card className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-none shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200">
                        <Video className="h-5 w-5" />
                        Create AI Video Presentation
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Transform your PowerPoint presentations into engaging AI-powered videos with talking avatars
                    </p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Video Title */}
                        <div className="space-y-2">
                            <Label htmlFor="title" className="text-sm font-medium">
                                Video Title *
                            </Label>
                            <Input
                                id="title"
                                type="text"
                                placeholder="e.g., Introduction to Physics - Laws of Motion"
                                value={formData.title}
                                onChange={(e) => handleInputChange('title', e.target.value)}
                                className="bg-white/60 dark:bg-gray-800/60"
                                required
                            />
                        </div>

                        {/* Topic */}
                        <div className="space-y-2">
                            <Label htmlFor="topic" className="text-sm font-medium">
                                Topic *
                            </Label>
                            <Input
                                id="topic"
                                type="text"
                                placeholder="e.g., Laws of Motion"
                                value={formData.topic}
                                onChange={(e) => handleInputChange('topic', e.target.value)}
                                className="bg-white/60 dark:bg-gray-800/60"
                                required
                            />
                        </div>

                        {/* PPTX File Upload */}
                        <div className="space-y-2">
                            <Label htmlFor="pptxFile" className="text-sm font-medium flex items-center gap-2">
                                <Upload className="h-4 w-4" />
                                PowerPoint File (.pptx) *
                            </Label>
                            <Input
                                id="pptxFile"
                                type="file"
                                accept=".pptx"
                                onChange={handleFileChange}
                                className="bg-white/60 dark:bg-gray-800/60"
                                required
                            />
                            {formData.pptxFile && (
                                <p className="text-sm text-green-600 dark:text-green-400">
                                    ✓ Selected: {formData.pptxFile.name}
                                </p>
                            )}
                        </div>

                        {/* Voice Selection */}
                        <div className="grid grid-cols-2 gap-4">

                            <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                    <Mic className="h-4 w-4" />
                                    Voice Selection *
                                </Label>
                                <Select value={formData.voiceId} onValueChange={(value) => handleInputChange('voiceId', value)}>
                                    <SelectTrigger className="bg-white/60 dark:bg-gray-800/60">
                                        <SelectValue placeholder="Select a voice" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {voiceIds.map((voice) => (
                                            <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{voice.name}</span>
                                                    <span className="text-xs text-gray-500">({voice.gender})</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedVoice && (
                                    <div className="p-3 bg-white/40 dark:bg-gray-800/40 rounded-lg">
                                        <p className="text-sm font-medium">{selectedVoice.name}</p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            {selectedVoice.gender} • {selectedVoice.language}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Avatar Selection */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Avatar Selection *
                                </Label>
                                <Select value={formData.talkingPhotoId} onValueChange={(value) => handleInputChange('talkingPhotoId', value)}>
                                    <SelectTrigger className="bg-white/60 dark:bg-gray-800/60">
                                        <SelectValue placeholder="Select an avatar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {talkingImages.map((avatar) => (
                                            <SelectItem key={avatar.talking_photo_id} value={avatar.talking_photo_id}>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{avatar.talking_photo_name}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedAvatar && (
                                    <div className="p-3 bg-white/40 dark:bg-gray-800/40 rounded-lg">
                                        <p className="text-sm font-medium">{selectedAvatar.talking_photo_name}</p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            AI Talking Avatar
                                        </p>
                                    </div>
                                )}
                            </div>

                        </div>
                        <Button
                            type="submit"
                            disabled={isGenerating}
                            className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white py-3"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Generating Video...
                                </>
                            ) : (
                                <>
                                    <Wand2 className="h-4 w-4 mr-2" />
                                    Generate Video
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default VideoForm;
