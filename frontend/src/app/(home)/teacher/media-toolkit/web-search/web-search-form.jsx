"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";
import { subject, grade, language } from "@/config/data";

export default function WebSearchForm({ onSubmit, isLoading = false }) {
  const [formData, setFormData] = useState({
    topic: "",
    subject: "math",
    gradeLevel: "8",
    contentType: "Articles & Blogs",
    language: "English",
    comprehension: "intermediate"
  });

  const contentTypes = [
    "Articles & Blogs", "Eductaional Vidoes","Interactive Tutorials"
  ];

  const comprehensionLevels = [
    "basic", "intermediate", "advanced"
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.topic.trim()) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Topic */}
        <div className="space-y-2">
          <Label htmlFor="topic">Search Topic *</Label>
          <Input
            id="topic"
            value={formData.topic}
            onChange={(e) => handleInputChange("topic", e.target.value)}
            placeholder="Enter your search topic..."
            required
            disabled={isLoading}
          />
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Select
            value={formData.subject}
            onValueChange={(value) => handleInputChange("subject", value)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {subject.map((subjectItem) => (
                <SelectItem key={subjectItem} value={subjectItem}>
                  {subjectItem.charAt(0).toUpperCase() + subjectItem.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Grade Level */}
        <div className="space-y-2">
          <Label htmlFor="gradeLevel">Grade Level</Label>
          <Select
            value={formData.gradeLevel}
            onValueChange={(value) => handleInputChange("gradeLevel", value)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select grade level" />
            </SelectTrigger>
            <SelectContent>
              {grade.map((gradeItem) => (
                <SelectItem key={gradeItem} value={gradeItem}>
                  Grade {gradeItem}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Content Type */}
        <div className="space-y-2">
          <Label htmlFor="contentType">Content Type</Label>
          <Select
            value={formData.contentType}
            onValueChange={(value) => handleInputChange("contentType", value)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select content type" />
            </SelectTrigger>
            <SelectContent>
              {contentTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Select
            value={formData.language}
            onValueChange={(value) => handleInputChange("language", value)}
            disabled={isLoading}
          >
            <SelectTrigger>
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

        {/* Comprehension Level */}
        <div className="space-y-2">
          <Label htmlFor="comprehension">Comprehension Level</Label>
          <Select
            value={formData.comprehension}
            onValueChange={(value) => handleInputChange("comprehension", value)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select comprehension level" />
            </SelectTrigger>
            <SelectContent>
              {comprehensionLevels.map((level) => (
                <SelectItem key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>


      {/* Submit Button */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!formData.topic.trim() || isLoading}
          className="min-w-[140px] bg-gradient-to-r from-indigo-500 to-blue-600 hover:opacity-90 text-white"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Search Web
            </>
          )}
        </Button>
      </div>
    </form>
  );
}


