"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Wand2, FileText, Image, Globe, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { language, presentationTemplates } from '@/config/data';
import { generatePresentation } from './action';

const SlideForm = ({ onPresentationGenerated }) => {
  const [formData, setFormData] = useState({
    title: '',
    topic: '',
    slideCount: 10,
    language: 'English',
    verbosity: 'standard',
    template: 'default',
    includeImages: true,
    instructions: ''
  });

  const [isGenerating, setIsGenerating] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.topic.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generatePresentation(formData);

      if (result.success) {
        toast.success("Presentation generated successfully!");
        
        // Pass the generated presentation data to parent component
        if (onPresentationGenerated) {
          onPresentationGenerated({
            ...result.presentation,
            title: formData.title,
            topic: formData.topic,
            slideCount: formData.slideCount,
            template: formData.template,
            language: formData.language,
            verbosity: formData.verbosity,
            includeImages: formData.includeImages,
            instructions: formData.instructions
          });
        }
      } else {
        toast.error(result.error || "Failed to generate presentation");
      }
    } catch (error) {
      toast.error("Failed to generate presentation");
      console.error("Error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="bg-white dark:bg-secondary border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-white">
            <FileText className="h-5 w-5" />
            Create AI Presentation
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-white">
            Generate professional presentations with AI-powered content and design
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Presentation Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">
                Presentation Title *
              </Label>
              <Input
                id="title"
                type="text"
                placeholder="e.g., Introduction to Machine Learning"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="bg-white/60 dark:bg-secondary/60"
                required
              />
            </div>

            {/* Topic */}
            <div className="space-y-2">
              <Label htmlFor="topic" className="text-sm font-medium">
                Topic*
              </Label>
              <Input
                id="topic"
                type="text"
                placeholder="e.g., Machine Learning Fundamentals"
                value={formData.topic}
                onChange={(e) => handleInputChange('topic', e.target.value)}
                className="bg-white/60 dark:bg-secondary/60"
                required
              />
            </div>

            {/* Number of Slides */}
            <div className="space-y-2">
              <Label htmlFor="slideCount" className="text-sm font-medium">
                Number of Slides
              </Label>
              <Input
                id="slideCount"
                type="number"
                min="1"
                max="50"
                value={formData.slideCount}
                onChange={(e) => handleInputChange('slideCount', parseInt(e.target.value) || 10)}
                className="bg-white/60 dark:bg-secondary/60"
              />
            </div>

            {/* Language, Verbosity, and Template in a single row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Language */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Language
                </Label>
                <Select value={formData.language} onValueChange={(value) => handleInputChange('language', value)}>
                  <SelectTrigger className="bg-white/60 dark:bg-secondary/60">
                    <SelectValue placeholder="Select language" />
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

              {/* Verbosity */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Content Verbosity
                </Label>
                <Select value={formData.verbosity} onValueChange={(value) => handleInputChange('verbosity', value)}>
                  <SelectTrigger className="bg-white/60 dark:bg-secondary/60">
                    <SelectValue placeholder="Select verbosity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concise">Concise</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="text-heavy">Text Heavy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Template */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Template
                </Label>
                <Select value={formData.template} onValueChange={(value) => handleInputChange('template', value)}>
                  <SelectTrigger className="bg-white/60 dark:bg-secondary/60">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {presentationTemplates.map((template) => (
                      <SelectItem key={template} value={template}>
                        {template.charAt(0).toUpperCase() + template.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Include Stock Images */}
            <div className="flex items-center justify-between p-4 bg-white/40 dark:bg-secondary/40 rounded-lg">
              <div className="flex items-center gap-3">
                <Image className="h-4 w-4 text-blue-600" />
                <div>
                  <Label className="text-sm font-medium">Include Stock Images</Label>
                  <p className="text-xs text-gray-500 dark:text-white">
                    Add relevant images to enhance your presentation
                  </p>
                </div>
              </div>
              <Switch
                checked={formData.includeImages}
                onCheckedChange={(checked) => handleInputChange('includeImages', checked)}
              />
            </div>

            {/* Custom Instructions */}
            <div className="space-y-2">
              <Label htmlFor="instructions" className="text-sm font-medium">
                Custom Instructions (Optional)
              </Label>
              <Textarea
                id="instructions"
                placeholder="e.g., Focus on practical applications, include real-world examples, make it suitable for beginners..."
                value={formData.instructions}
                onChange={(e) => handleInputChange('instructions', e.target.value)}
                className="bg-white/60 dark:bg-secondary/60 min-h-[100px]"
                rows={4}
              />
            </div>

            {/* Generate Button */}
            <Button
              type="submit"
              disabled={isGenerating}
              className="w-full bg-purple-600 hover:bg-purple-600/90 text-white py-3"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Presentation...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Presentation
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default SlideForm;