"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Image, Download, Trash2, Eye, Calendar, Tag, User } from 'lucide-react';
import { toast } from 'sonner';
import ImageForm from './image-form';
import { getUserImages, deleteImageFromDatabase } from './action';

export default function ImagesGenerator() {
    const [images, setImages] = useState([]);
    const [activeTab, setActiveTab] = useState('generate');
    const [previewImage, setPreviewImage] = useState(null); // Add this line

    useEffect(() => {
        loadImages();
    }, []);

    const loadImages = async () => {
        try {
            const result = await getUserImages();
            if (result.success) {
                setImages(result.images);
            } else {
                toast.error("Failed to load images: " + result.error);
            }
        } catch (error) {
            console.error("Error loading images:", error);
            toast.error("Failed to load images");
        }
    };

    const handleImageGenerated = (newImage) => {
        // Refresh the images list from database instead of manual state update
        loadImages();
        setActiveTab('gallery');
        toast.success("Image saved successfully!");
    };

    const handleDeleteImage = async (imageId) => {
        if (!confirm("Are you sure you want to delete this image?")) {
            return;
        }

        try {
            const result = await deleteImageFromDatabase(imageId);
            if (result.success) {
                setImages(prev => prev.filter(img => img._id !== imageId));
                toast.success("Image deleted successfully");
            } else {
                toast.error("Failed to delete image: " + result.error);
            }
        } catch (error) {
            console.error("Error deleting image:", error);
            toast.error("Failed to delete image");
        }
    };

    const handleDownloadImage = (imageUrl, title) => {
        try {
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Image download started");
        } catch (error) {
            console.error("Error downloading image:", error);
            toast.error("Failed to download image");
        }
    };

    const handlePreviewImage = (image) => {
        setPreviewImage(image);
    };

    const handleClosePreview = () => {
        setPreviewImage(null);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown date';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-8"
                >
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Image Generator</h1>
                    <p className="text-gray-600">
                        Create educational images, charts, and diagrams with AI assistance
                    </p>
                </motion.div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="generate" className="flex items-center gap-2">
                            <Image className="h-4 w-4" />
                            Generate New Image
                        </TabsTrigger>
                        <TabsTrigger value="gallery" className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            My Images ({images.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="generate" className="space-y-6">
                        <ImageForm onImageGenerated={handleImageGenerated} />
                    </TabsContent>

                    <TabsContent value="gallery" className="space-y-6">
                        {images.length === 0 ? (
                            <Card className="border-0 shadow-lg">
                                <CardContent className="flex flex-col items-center justify-center py-12">
                                    <Image className="h-16 w-16 text-gray-400 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">No images yet</h3>
                                    <p className="text-gray-500 text-center mb-4">
                                        Generate your first AI image to get started
                                    </p>
                                    <Button 
                                        onClick={() => setActiveTab('generate')}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        Generate Image
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {images.map((image) => (
                                    <motion.div
                                        key={image._id}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <Card className="border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                                            <div className="aspect-square bg-gray-100 relative">
                                                <img
                                                    src={image.imageUrl}
                                                    alt={image.title}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute top-2 right-2 flex gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => handlePreviewImage(image)}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => handleDownloadImage(image.imageUrl, image.title)}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => handleDeleteImage(image._id)}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            
                                            <CardContent className="p-4">
                                                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                                                    {image.title}
                                                </h3>
                                                
                                                <div className="space-y-2 text-sm text-gray-600">
                                                    <div className="flex items-center gap-2">
                                                        <Tag className="h-3 w-3" />
                                                        <span>{image.topic}</span>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-3 w-3" />
                                                        <span>{image.subject} • Grade {image.grade}</span>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-3 w-3" />
                                                        <span>{formatDate(image.metadata?.createdAt || image.createdAt)}</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex flex-wrap gap-1 mt-3">
                                                    <Badge variant="secondary" className="text-xs">
                                                        {image.visualType}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-xs">
                                                        {image.language}
                                                    </Badge>
                                                    {image.difficultyFlag && (
                                                        <Badge variant="destructive" className="text-xs">
                                                            Advanced
                                                        </Badge>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl max-h-[105vh] overflow-auto">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-semibold">{previewImage.title}</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClosePreview}
                                className="h-8 w-8 p-0"
                            >
                                ×
                            </Button>
                        </div>
                        <div className="p-0">
                            <img
                                src={previewImage.imageUrl}
                                alt={previewImage.title}
                                className="w-full h-full rounded-lg"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}