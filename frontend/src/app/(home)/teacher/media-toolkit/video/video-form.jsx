"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Wand2, Video, Upload, Mic, User, Clock, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { voiceIds, talkingImages } from '@/config/data';
import { generateVideoFromPPTX, checkVideoGenerationStatus } from './action';

const VideoForm = ({ onVideoGenerated }) => {
    const [formData, setFormData] = useState({
        title: '',
        topic: '',
        pptxFile: null,
        voiceId: '',
        talkingPhotoId: '',
        language: 'english'
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [currentTaskId, setCurrentTaskId] = useState(null);
    const [generationStatus, setGenerationStatus] = useState(null);
    const [pollingInterval, setPollingInterval] = useState(null);

    // NEW: Fetch actual voices from HeyGen API
    const [availableVoices, setAvailableVoices] = useState([]);
    const [isLoadingVoices, setIsLoadingVoices] = useState(false);

    // Fetch voices from HeyGen API
    const fetchVoicesFromAPI = async () => {
        setIsLoadingVoices(true);
        try {
            const response = await fetch('https://api.heygen.com/v1/voices', {
                headers: {
                    'X-Api-Key': process.env.NEXT_PUBLIC_HEYGEN_API_KEY || 'your-api-key-here'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                setAvailableVoices(data.data || []);
            } else {
                console.error('Failed to fetch voices:', response.status);
                // Fallback to predefined voices
                setAvailableVoices(voiceIds);
            }
        } catch (error) {
            console.error('Error fetching voices:', error);
            // Fallback to predefined voices
            setAvailableVoices(voiceIds);
        } finally {
            setIsLoadingVoices(false);
        }
    };

    // Fetch voices on component mount
    useEffect(() => {
        fetchVoicesFromAPI();
    }, []);

    // Clean up polling on unmount
    useEffect(() => {
        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        };
    }, [pollingInterval]);

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

    const startStatusPolling = (taskId) => {
        const interval = setInterval(async () => {
            try {
                const result = await checkVideoGenerationStatus(taskId);
                
                if (result.success) {
                    setGenerationStatus(result);
                    
                    if (result.status === 'completed') {
                        clearInterval(interval);
                        setPollingInterval(null);
                        setIsGenerating(false);
                        
                        toast.success("Video generation completed successfully!");
                        
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
                        
                        setFormData({
                            title: '',
                            topic: '',
                            pptxFile: null,
                            voiceId: '',
                            talkingPhotoId: '',
                            language: 'english'
                        });
                        setCurrentTaskId(null);
                        setGenerationStatus(null);
                        
                    } else if (result.status === 'failed') {
                        clearInterval(interval);
                        setPollingInterval(null);
                        setIsGenerating(false);
                        
                        toast.error(result.error || "Video generation failed");
                        setCurrentTaskId(null);
                        setGenerationStatus(null);
                    }
                } else {
                    console.error('Failed to check video status:', result.error);
                }
            } catch (error) {
                console.error('Error checking video status:', error);
            }
        }, 10000);
        
        setPollingInterval(interval);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title.trim() || !formData.topic.trim() || !formData.pptxFile || !formData.voiceId || !formData.talkingPhotoId) {
            toast.error("Please fill in all required fields and upload a PPTX file");
            return;
        }

        setIsGenerating(true);
        setGenerationStatus({ status: 'processing' });

        const loadingToast = toast.loading("Starting video generation... This may take 10-15 minutes. Please don't close this tab.", {
            duration: Infinity,
        });

        try {
            const videoData = {
                pptx_file: formData.pptxFile,
                voice_id: formData.voiceId,
                talking_photo_id: formData.talkingPhotoId,
                title: formData.title,
                language: formData.language
            };

            const result = await generateVideoFromPPTX(videoData);

            toast.dismiss(loadingToast);

            if (result.success) {
                setCurrentTaskId(result.task_id);
                setGenerationStatus({ status: result.status });
                startStatusPolling(result.task_id);
            } else {
                toast.error(result.error || "Failed to start video generation");
                setIsGenerating(false);
                setGenerationStatus(null);
            }
        } catch (error) {
            toast.dismiss(loadingToast);
            console.error("Error:", error);
            toast.error("Failed to start video generation. Please try again.");
            setIsGenerating(false);
            setGenerationStatus(null);
        }
    };

    const selectedVoice = voiceIds.find(voice => voice.voice_id === formData.voiceId);
    const selectedAvatar = talkingImages.find(avatar => avatar.talking_photo_id === formData.talkingPhotoId);

    // NEW: Use actual Arabic voice IDs from voice_details.txt
    const getVoiceForLanguage = (language) => {
        if (language?.toLowerCase() === 'arabic') {
            // These are ACTUAL Arabic voice IDs from HeyGen voice_details.txt
            return {
                "042173e02d18478384c64fdfe37ddd67": "GHIZLANE - Arabic (Female)",
                "04fa555734714c3a90ac08a1ed64021c": "Moncellence - Arabic (Male)",
                "0eb85e6e8710473b82f7e88609ba3053": "Hushed Hiba - Excited - Arabic (Female)",
                "61cfb9ee298d419fa76d7f913f817447": "Hakeem Hassan - Arabic (Male)",
                "7042665eceec4300afd14e4f3ecf9157": "Sana - Arabic (Female)",
                "e406a437e338443e9412162a0fff5289": "Hushed Hiba - Arabic (Female)",
                "d12916aac1c44e6e8025ad820f1e9d4a": "Hushed Hiba - Friendly - Arabic (Female)"
            };
        } else {
            // English/multilingual voices
            return {
                "baae7852b7824c8aaec62fc1c4e3064b": "Rex - Serious (Male)",
                "bb2850ee8c76464d8e3d43f51b963fd1": "Christine - Soothing (Female)",
                "9aa98f478ac94b3a85272470dff2aae4": "Paul - Excited (Male)",
                "dadd7050adc04e5e91d6f381b2605484": "Christine - Serious (Female)",
                "6dfaa3b29f0b46f79677abdd25b66d15": "Theo - Serious (Male)",
                "5cb81a519c4845f2b3c3d12b9630e258": "Paul - Friendly (Male)",
                "1776ddbd05374fa480e92f0297bbc67e": "Melissa - Friendly (Female)",
                "080f8e5cb3ae424989242b0efe5205e6": "Ceecee - Serious (Female)",
                "91120f72682e4459a19e311ba2ee4cb2": "Elizabeth - Excited (Female)",
                "5c1ade5e514c4c6c900b0ded224970fd": "Theo - Friendly (Male)"
            };
        }
    };

    // NEW: Filter voices based on selected language
    const getFilteredVoices = () => {
        if (!formData.language) return voiceIds;
        
        const availableVoices = getVoiceForLanguage(formData.language);
        return Object.keys(availableVoices).map(voiceId => ({
            id: voiceId,
            name: availableVoices[voiceId],
            language: formData.language.toLowerCase() === 'arabic' ? 'Arabic' : 'Multilingual'
        }));
    };

    // NEW: Auto-select default voice when language changes
    useEffect(() => {
        if (formData.language) {
            const availableVoices = getVoiceForLanguage(formData.language);
            const voiceIds = Object.keys(availableVoices);
            
            // Auto-select the first available voice for the language
            if (voiceIds.length > 0) {
                setFormData(prev => ({
                    ...prev,
                    voiceId: voiceIds[0] // Default to first voice
                }));
            }
        }
    }, [formData.language]);

    // NEW: Get avatars based on language
    const getFilteredAvatars = () => {
        // For now, all avatars work with both languages
        // But you can add language-specific avatars here if needed
        return talkingImages.map(avatar => ({
            id: avatar.talking_photo_id,
            name: avatar.talking_photo_name,
            language: 'Universal' // All avatars work with both languages
        }));
    };

    const getStatusIcon = () => {
        if (!generationStatus) return null;
        
        switch (generationStatus.status) {
            case 'processing':
            case 'generating':
                return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'failed':
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            default:
                return <Clock className="h-4 w-4 text-yellow-500" />;
        }
    };

    const getStatusMessage = () => {
        if (!generationStatus) return null;
        
        switch (generationStatus.status) {
            case 'processing':
                return "Initializing video generation...";
            case 'generating':
                return "Generating your video... This may take 10-15 minutes.";
            case 'completed':
                return "Video generation completed!";
            case 'failed':
                return `Generation failed: ${generationStatus.error || 'Unknown error'}`;
            default:
                return "Processing...";
        }
    };

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
                    {generationStatus && (
                        <div className="mb-6 p-4 bg-white/60 dark:bg-gray-800/60 rounded-lg border">
                            <div className="flex items-center gap-3">
                                {getStatusIcon()}
                                <div>
                                    <p className="font-medium text-gray-800 dark:text-gray-200">
                                        {getStatusMessage()}
                                    </p>
                                    {currentTaskId && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Task ID: {currentTaskId}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
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
                                disabled={isGenerating}
                            />
                        </div>

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
                                disabled={isGenerating}
                            />
                        </div>

                        {/* Language Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="language" className="text-sm font-medium flex items-center gap-2">
                                <Globe className="h-4 w-4" />
                                Video Language *
                            </Label>
                            <Select 
                                value={formData.language} 
                                onValueChange={(value) => handleInputChange('language', value)}
                                disabled={isGenerating}
                            >
                                <SelectTrigger className="bg-white/60 dark:bg-gray-800/60">
                                    <SelectValue placeholder="Select language" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="english">English</SelectItem>
                                    <SelectItem value="arabic">Arabic</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

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
                                disabled={isGenerating}
                            />
                            {formData.pptxFile && (
                                <p className="text-sm text-green-600 dark:text-green-400">
                                    ✓ Selected: {formData.pptxFile.name}
                                </p>
                            )}
                        </div>

                        {/* Voice Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="voice_id" className="text-sm font-medium">
                                Voice * {isLoadingVoices && <span className="text-xs text-gray-500">(Loading...)</span>}
                            </Label>
                            <Select
                                value={formData.voiceId}
                                onValueChange={(value) => handleInputChange('voiceId', value)}
                                disabled={isGenerating || isLoadingVoices}
                            >
                                <SelectTrigger className="bg-white/60 dark:bg-gray-800/60">
                                    <SelectValue placeholder={isLoadingVoices ? "Loading voices..." : "Select a voice"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {getFilteredVoices().map((voice) => (
                                        <SelectItem key={voice.id} value={voice.id}>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{voice.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {voice.language} • {voice.id}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {formData.language?.toLowerCase() === 'arabic' 
                                    ? 'Showing voices that support Arabic language'
                                    : 'Showing voices that support English language'
                                }
                            </p>
                            {getFilteredVoices().length === 0 && !isLoadingVoices && (
                                <p className="text-xs text-red-500">
                                    No voices found for {formData.language}. Please try a different language.
                                </p>
                            )}
                        </div>

                        {/* Avatar Selection */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Avatar Selection *
                            </Label>
                            <Select 
                                value={formData.talkingPhotoId} 
                                onValueChange={(value) => handleInputChange('talkingPhotoId', value)}
                                disabled={isGenerating}
                            >
                                <SelectTrigger className="bg-white/60 dark:bg-gray-800/60">
                                    <SelectValue placeholder="Select an avatar" />
                                </SelectTrigger>
                                <SelectContent>
                                    {getFilteredAvatars().map((avatar) => (
                                        <SelectItem key={avatar.id} value={avatar.id}>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{avatar.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {avatar.language} • {avatar.id}
                                                </span>
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

                        <Button
                            type="submit"
                            disabled={isGenerating}
                            className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white py-3"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    {generationStatus?.status === 'processing' ? 'Starting...' : 'Generating Video...'}
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
