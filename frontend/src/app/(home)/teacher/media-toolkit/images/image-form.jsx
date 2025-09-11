"use client";

import React, { useState } from 'react';
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
import { generateImage, uploadImageToCloudinaryAndSave } from './action';

const ImageForm = ({ onImageGenerated }) => {
    const [formData, setFormData] = useState({
        title: '',
        topic: '',
        subject: '',
        grade: '',
        instructions: '',
        visualType: '',
        language: 'English',
        difficultyFlag: false
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [generatedImage, setGeneratedImage] = useState(null);

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

        const loadingToast = toast.loading("Generating image... This may take a few moments.", {
            duration: Infinity,
        });

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
                toast.success("Image generated successfully!");
                
                // Store the generated image data (don't save to DB yet)
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
                    imageBase64: result.image.image_url,
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

    const handleSave = async () => {
        if (!generatedImage) {
            toast.error("No image to save. Please generate an image first.");
            return;
        }

        setIsSaving(true);

        try {
            const saveResult = await uploadImageToCloudinaryAndSave(generatedImage);

            if (saveResult.success) {
                toast.success("Image saved successfully!");

                // Pass the saved image data to parent component
                if (onImageGenerated) {
                    onImageGenerated({
                        _id: saveResult.imageId,
                        title: generatedImage.title,
                        topic: generatedImage.topic,
                        subject: generatedImage.subject,
                        grade: generatedImage.grade,
                        instructions: generatedImage.instructions,
                        visualType: generatedImage.visualType,
                        language: generatedImage.language,
                        difficultyFlag: generatedImage.difficultyFlag,
                        imageUrl: saveResult.cloudinaryUrl,
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

                // Reset form and generated image
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
                toast.error("Failed to save image: " + saveResult.error);
            }
        } catch (error) {
            console.error("Error saving image:", error);
            toast.error("An error occurred while saving the image");
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
            {/* Form Card */}
            <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-2xl font-bold text-gray-800">
                        <Image className="h-6 w-6 text-blue-600" />
                        AI Image Generator
                    </CardTitle>
                    <p className="text-gray-600 mt-2">
                        Create educational images, charts, and diagrams with AI
                    </p>
                </CardHeader>
                
                <CardContent className="p-6">
                    <form onSubmit={handleGenerate} className="space-y-6">
                        {/* Title */}
                        <div className="space-y-2">
                            <Label htmlFor="title" className="text-sm font-medium flex items-center gap-2">
                                <BookOpen className="h-4 w-4" />
                                Image Title *
                            </Label>
                            <Input
                                id="title"
                                type="text"
                                placeholder="Enter a descriptive title for your image"
                                value={formData.title}
                                onChange={(e) => handleInputChange('title', e.target.value)}
                                className="w-full"
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
                                placeholder="e.g., Photosynthesis, Water Cycle, Solar System"
                                value={formData.topic}
                                onChange={(e) => handleInputChange('topic', e.target.value)}
                                className="w-full"
                                required
                            />
                        </div>

                        {/* Subject and Grade */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="subject" className="text-sm font-medium">
                                    Subject *
                                </Label>
                                <Select value={formData.subject} onValueChange={(value) => handleInputChange('subject', value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select subject" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {subject.map((sub) => (
                                            <SelectItem key={sub} value={sub}>
                                                {sub.charAt(0).toUpperCase() + sub.slice(1)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="grade" className="text-sm font-medium">
                                    Grade Level *
                                </Label>
                                <Select value={formData.grade} onValueChange={(value) => handleInputChange('grade', value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select grade" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {grade.map((g) => (
                                            <SelectItem key={g} value={g}>
                                                {g.toUpperCase()}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Visual Type */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-2">
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
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
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
                                                <div className="font-medium text-gray-900">{type.label}</div>
                                                <div className="text-sm text-gray-500 mt-1">{type.description}</div>
                                            </div>
                                        </label>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="space-y-2">
                            <Label htmlFor="instructions" className="text-sm font-medium">
                                Detailed Instructions *
                            </Label>
                            <Textarea
                                id="instructions"
                                placeholder="Describe what you want in the image. Be specific about colors, style, elements, and any text labels needed..."
                                value={formData.instructions}
                                onChange={(e) => handleInputChange('instructions', e.target.value)}
                                className="w-full min-h-[100px]"
                                required
                            />
                        </div>

                        {/* Language and Difficulty */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                    <Globe className="h-4 w-4" />
                                    Language for Labels
                                </Label>
                                <Select value={formData.language} onValueChange={(value) => handleInputChange('language', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {language.map((lang) => (
                                            <SelectItem key={lang} value={lang}>
                                                {lang}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                    Advanced Difficulty
                                </Label>
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="difficulty"
                                        checked={formData.difficultyFlag}
                                        onCheckedChange={(checked) => handleInputChange('difficultyFlag', checked)}
                                    />
                                    <Label htmlFor="difficulty" className="text-sm text-gray-600">
                                        More detailed and complex
                                    </Label>
                                </div>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Button
                                type="submit"
                                disabled={isGenerating}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 text-lg font-medium"
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

            {/* Generated Image Preview and Save */}
            {generatedImage && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Card className="border-0 shadow-lg">
                        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                            <CardTitle className="flex items-center gap-2 text-xl font-bold text-gray-800">
                                <Eye className="h-5 w-5 text-green-600" />
                                Generated Image Preview
                            </CardTitle>
                            <p className="text-gray-600">
                                Review your generated image and save it to your gallery
                            </p>
                        </CardHeader>
                        
                        <CardContent className="p-6">
                            <div className="space-y-4">
                                {/* Image Preview */}
                                <div className="flex justify-center">
                                    <div className="relative max-w-md w-full">
                                        <img
                                            src={generatedImage.imageUrl}
                                            alt={generatedImage.title}
                                            className="w-full h-auto rounded-lg shadow-lg"
                                        />
                                    </div>
                                </div>

                                {/* Image Details */}
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-semibold text-gray-900 mb-2">{generatedImage.title}</h3>
                                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                                        <div><strong>Topic:</strong> {generatedImage.topic}</div>
                                        <div><strong>Subject:</strong> {generatedImage.subject}</div>
                                        <div><strong>Grade:</strong> {generatedImage.grade}</div>
                                        <div><strong>Type:</strong> {generatedImage.visualType}</div>
                                        <div><strong>Language:</strong> {generatedImage.language}</div>
                                        <div><strong>Difficulty:</strong> {generatedImage.difficultyFlag ? 'Advanced' : 'Standard'}</div>
                                    </div>
                                </div>

                                {/* Save Button */}
                                <motion.div
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 text-lg font-medium"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="mr-2 h-5 w-5" />
                                                S
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
