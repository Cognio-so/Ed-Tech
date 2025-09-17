"use client";

import { toast } from 'sonner';
import ImageForm from './image-form';

export default function ImagesGenerator() {
    const handleImageGenerated = (newImage) => {
        toast.success("Image saved successfully!");
    };

    return (
        <div className="min-h-screen bg-background dark:bg-secondary py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="w-full">
                    <div className="space-y-6">
                        <ImageForm onImageGenerated={handleImageGenerated} />
                    </div>
                </div>
            </div>
        </div>
    );
}