"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Wand2, Image, Palette, Globe, BookOpen, Save, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { subject, grade, language } from '@/config/data';
import { generateImage, saveImageWithCloudinaryUrl, getUserAssignedGradesAndSubjects } from './action';

const ImageForm = ({ onImageGenerated }) => {
    const [formData, setFormData] = useState({
        title: '',
        topic: '',
        subject: '',
        grade: '',
        instructions: '',
        visualType: '',
        difficultyFlag: false,
        language: 'English'
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState(null);
    const [userGrades, setUserGrades] = useState([]);
    const [userSubjects, setUserSubjects] = useState([]);
    const [loadingUserData, setLoadingUserData] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                setLoadingUserData(true);
                const result = await getUserAssignedGradesAndSubjects();
                
                if (result.success) {
                    setUserGrades(result.grades);
                    setUserSubjects(result.subjects);
                    if (result.grades.length > 0) {
                        setFormData(prev => ({ ...prev, grade: result.grades[0] }));
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

    const visualTypes = [
        { value: 'image', label: 'Image', description: 'General educational image' },
        { value: 'chart', label: 'Chart', description: 'Data visualization or graph' },
        { value: 'diagram', label: 'Diagram', description: 'Technical or scientific diagram' }
    ];

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleGenerate = async (e) => {
        e.preventDefault();

        if (!formData.title.trim() || !formData.topic.trim() || !formData.subject || 
            !formData.grade || !formData.instructions.trim() || !formData.visualType) {
            toast.error("Please fill in all required fields");
            return;
        }

        setIsGenerating(true);
        const loadingToast = toast.loading(`Generating ${formData.visualType}...`);

        try {
            const imageData = {
                topic: formData.topic,
                gradeLevel: formData.grade,
                preferred_visual_type: formData.visualType,
                subject: formData.subject,
                difficultyFlag: formData.difficultyFlag,
                instructions: formData.instructions,
                language: formData.language
            };

            const result = await generateImage(imageData);

            toast.dismiss(loadingToast);

            if (result.success) {
                toast.success(`${formData.visualType.charAt(0).toUpperCase() + formData.visualType.slice(1)} generated successfully!`);
                
                setGeneratedImage({
                    title: formData.title,
                    topic: formData.topic,
                    subject: formData.subject,
                    grade: formData.grade,
                    instructions: formData.instructions,
                    visualType: formData.visualType,
                    language: formData.language,
                    difficultyFlag: formData.difficultyFlag,
                    imageUrl: result.image.image_url,
                    imageBase64: result.image.image_url.split(',')[1], // Extract base64 part from data URL
                    status: 'generated'
                });
            } else {
                toast.error(result.error || "Failed to generate image");
            }
        } catch (error) {
            toast.dismiss(loadingToast);
            console.error("Error generating image:", error);
            toast.error("An error occurred while generating the image");
        } finally {
            setIsGenerating(false);
        }
    };

    // Update the import (line 15)
    // Update handleSave function
    const handleSave = async () => {
        if (!generatedImage) {
            toast.error("No image to save. Please generate an image first.");
            return;
        }

        setIsSaving(true);

        try {
            // Prepare image data with Cloudinary URLs only (no base64) - SAME AS COMIC PATTERN
            const imageData = {
                title: generatedImage.title,
                topic: generatedImage.topic,
                subject: generatedImage.subject,
                grade: generatedImage.grade,
                instructions: generatedImage.instructions,
                visualType: generatedImage.visualType,
                language: generatedImage.language,
                difficultyFlag: generatedImage.difficultyFlag,
                imageUrl: generatedImage.imageUrl, // Cloudinary URL only
                cloudinaryPublicId: generatedImage.cloudinaryPublicId || '', // Cloudinary public ID
                status: 'completed'
            };

            // Use the NEW function that only saves Cloudinary URLs - SAME AS COMIC PATTERN
            const result = await saveImageWithCloudinaryUrl(imageData);
            if (result.success) {
                if (onImageGenerated) {
                    onImageGenerated({
                        _id: result.imageId,
                        title: generatedImage.title,
                        topic: generatedImage.topic,
                        subject: generatedImage.subject,
                        grade: generatedImage.grade,
                        instructions: generatedImage.instructions,
                        visualType: generatedImage.visualType,
                        language: generatedImage.language,
                        difficultyFlag: generatedImage.difficultyFlag,
                        imageUrl: result.cloudinaryUrl,
                        status: 'completed',
                        metadata: {
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            tags: [],
                            isPublic: false,
                            downloadCount: 0,
                            viewCount: 0
                        }
                    });
                }

                toast.success("Image saved successfully!");
                setFormData({
                    title: '',
                    topic: '',
                    subject: '',
                    grade: '',
                    instructions: '',
                    visualType: '',
                    language: 'English',
                    difficultyFlag: false
                });
                setGeneratedImage(null);
            } else {
                throw new Error(result.error || "Failed to save image");
            }
        } catch (error) {
            console.error("Failed to save image:", error);
            toast.error(`Failed to save image: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-4xl mx-auto space-y-6"
        >
            <Card className="shadow-lg dark:bg-secondary ">
                <CardContent className="p-6">
                    <form onSubmit={handleGenerate} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="title" className="text-sm font-medium flex items-center gap-2 dark:text-white">
                                <BookOpen className="h-4 w-4" />
                                Image Title *
                            </Label>
                            <Input
                                id="title"
                                type="text"
                                placeholder="Enter a descriptive title for your image"
                                value={formData.title}
                                onChange={(e) => handleInputChange('title', e.target.value)}
                                className="w-full dark:bg-secondary dark:text-white"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="topic" className="text-sm font-medium dark:text-white">
                                Topic *
                            </Label>
                            <Input
                                id="topic"
                                type="text"
                                placeholder="e.g., Photosynthesis, Water Cycle, Solar System"
                                value={formData.topic}
                                onChange={(e) => handleInputChange('topic', e.target.value)}
                                className="w-full dark:bg-secondary dark:text-white"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="subject" className="text-sm font-medium dark:text-white">
                                    Subject *
                                </Label>
                                {loadingUserData ? (
                                    <div className="flex items-center justify-center p-4">
                                        <Loader2 className="h-4 w-4 animate-spin mr-2 dark:text-white" />
                                        <span className="text-sm text-muted-foreground dark:text-gray-500">Loading subjects...</span>
                                    </div>
                                ) : userSubjects.length > 0 ? (
                                    <Select value={formData.subject} onValueChange={(value) => handleInputChange('subject', value)}>
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
                                    <div className="p-4 border border-dashed border-muted-foreground/25 dark:border-white rounded-md text-center">
                                        <p className="text-sm text-muted-foreground dark:text-white">No subjects assigned</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="grade" className="text-sm font-medium dark:text-white">
                                    Grade Level *
                                </Label>
                                {loadingUserData ? (
                                    <div className="flex items-center justify-center p-4">
                                        <Loader2 className="h-4 w-4 animate-spin mr-2 dark:text-white" />
                                        <span className="text-sm text-muted-foreground dark:text-gray-500">Loading grades...</span>
                                    </div>
                                ) : userGrades.length > 0 ? (
                                    <Select value={formData.grade} onValueChange={(value) => handleInputChange('grade', value)}>
                                        <SelectTrigger className="dark:bg-secondary dark:text-white">
                                            <SelectValue placeholder="Select grade" />
                                        </SelectTrigger>
                                        <SelectContent className="dark:bg-secondary dark:text-white">
                                            {userGrades.map((g) => (
                                                <SelectItem key={g} value={g}>
                                                    {g.toUpperCase()}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="p-4 border border-dashed border-muted-foreground/25 dark:border-white rounded-md text-center">
                                        <p className="text-sm text-muted-foreground dark:text-white">No grades assigned</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-2 dark:text-white">
                                <Palette className="h-4 w-4" />
                                Visual Type *
                            </Label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {visualTypes.map((type) => (
                                    <motion.div
                                        key={type.value}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <label className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                            formData.visualType === type.value
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 dark:border-blue-500'
                                                : 'border-gray-200 hover:border-gray-300 dark:border-white dark:hover:border-gray-600'
                                        }`}>
                                            <input
                                                type="radio"
                                                name="visualType"
                                                value={type.value}
                                                checked={formData.visualType === type.value}
                                                onChange={(e) => handleInputChange('visualType', e.target.value)}
                                                className="sr-only"
                                            />
                                            <div className="text-center">
                                                <div className="font-medium text-gray-900 dark:text-white">{type.label}</div>
                                                <div className="text-sm text-gray-500 dark:text-white mt-1">{type.description}</div>
                                            </div>
                                        </label>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="instructions" className="text-sm font-medium dark:text-white">
                                Detailed Instructions *
                            </Label>
                            <Textarea
                                id="instructions"
                                placeholder="Describe what you want in the image. Be specific about colors, style, elements, and any text labels needed..."
                                value={formData.instructions}
                                onChange={(e) => handleInputChange('instructions', e.target.value)}
                                className="w-full min-h-[100px] dark:bg-secondary dark:text-white"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-2 dark:text-white">
                                    <Globe className="h-4 w-4" />
                                    Language for Labels
                                </Label>
                                <Select value={formData.language} onValueChange={(value) => handleInputChange('language', value)}>
                                    <SelectTrigger className="dark:bg-secondary dark:text-white">
                                        <SelectValue />
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

                            <div className="space-y-2">
                                <Label className="text-sm font-medium dark:text-white">
                                    Advanced Difficulty
                                </Label>
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="difficulty"
                                        checked={formData.difficultyFlag}
                                        onCheckedChange={(checked) => handleInputChange('difficultyFlag', checked)}
                                    />
                                    <Label htmlFor="difficulty" className="text-sm text-muted-foreground dark:text-white">
                                        More detailed and complex
                                    </Label>
                                </div>
                            </div>
                        </div>

                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Button
                                type="submit"
                                disabled={isGenerating}
                                className="w-full text-black dark:text-white py-3 text-lg font-medium bg-purple-600 hover:bg-purple-600/90"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Generating Image...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="mr-2 h-5 w-5" />
                                        Generate Image
                                    </>
                                )}
                            </Button>
                        </motion.div>
                    </form>
                </CardContent>
            </Card>

            {generatedImage && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Card className="border-gray-200 dark:border-white shadow-lg dark:bg-secondary">
                        <CardContent className="p-6">
                            <div className="space-y-4">
                                <div className="flex justify-center">
                                    <div className="relative max-w-md w-full">
                                        <img
                                            src={generatedImage.imageUrl}
                                            alt={generatedImage.title}
                                            className="w-full h-auto rounded-lg shadow-lg"
                                        />
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-secondary p-4 rounded-lg">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{generatedImage.title}</h3>
                                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground dark:text-white">
                                        <div><strong>Topic:</strong> {generatedImage.topic}</div>
                                        <div><strong>Subject:</strong> {generatedImage.subject}</div>
                                        <div><strong>Grade:</strong> {generatedImage.grade}</div>
                                        <div><strong>Type:</strong> {generatedImage.visualType}</div>
                                        <div><strong>Language:</strong> {generatedImage.language}</div>
                                        <div><strong>Difficulty:</strong> {generatedImage.difficultyFlag ? 'Advanced' : 'Standard'}</div>
                                    </div>
                                </div>

                                <motion.div
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="w-full bg-purple-600 hover:bg-purple-600/90 text-white py-3 text-lg font-medium dark:from-green-500 dark:to-emerald-500 dark:hover:from-green-600 dark:hover:to-emerald-600 cursor-pointer"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="mr-2 h-5 w-5" />
                                                Save to Gallery
                                            </>
                                        )}
                                    </Button>
                                </motion.div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </motion.div>
    );
};

export default ImageForm;