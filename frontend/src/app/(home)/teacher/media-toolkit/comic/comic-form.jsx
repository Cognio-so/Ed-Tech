"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Loader2, Sparkles } from "lucide-react";
import { subject, grade, language } from "@/config/data";
import { getUserAssignedGradesAndSubjects } from './action';

export default function ComicForm({ onSubmit, onStop, isLoading = false, isGenerating = false }) {
  const [formData, setFormData] = useState({
    instructions: "",
    subject: "General",
    gradeLevel: "8",
    numPanels: 4,
    language: "English"
  });
  const [userGrades, setUserGrades] = useState([]);
  const [userSubjects, setUserSubjects] = useState([]);
  const [loadingUserData, setLoadingUserData] = useState(true);

  // Fetch user's assigned grades and subjects
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoadingUserData(true);
        const result = await getUserAssignedGradesAndSubjects();
        
        if (result.success) {
          setUserGrades(result.grades);
          setUserSubjects(result.subjects);
          // Set default values if user has assigned data
          if (result.grades.length > 0) {
            setFormData(prev => ({ ...prev, gradeLevel: result.grades[0] }));
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

  const comicTypes = [
    "educational", "storytelling", "scientific", "historical", "mathematical"
  ];

  const panelOptions = Array.from({ length: 20 }, (_, i) => i + 1);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.instructions.trim()) return;
    onSubmit(formData);
  };

  const handleStop = (e) => {
    e.preventDefault();
    onStop();
  };

  const canGenerate = formData.instructions.trim() && formData.gradeLevel && formData.numPanels > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-6">
        {/* Left Column - Form Controls */}
        <div className="space-y-6">
          {/* Instructions */}
          <div className="space-y-2">
            <Label htmlFor="instructions">Topic & Instructions *</Label>
            <Textarea
              id="instructions"
              placeholder="e.g., Create a fun comic explaining photosynthesis for 5th graders with plant characters"
              value={formData.instructions}
              onChange={(e) => handleInputChange("instructions", e.target.value)}
              className="min-h-[120px] resize-none"
              required
            />
            <p className="text-xs text-muted-foreground">
              Describe the educational topic and any specific requirements for your comic
            </p>
          </div>

          {/* Subject and Grade Level */}
          <div className=" grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              {loadingUserData ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Loading subjects...</span>
                </div>
              ) : userSubjects.length > 0 ? (
                <Select value={formData.subject} onValueChange={(value) => handleInputChange("subject", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {userSubjects.map((sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub.charAt(0).toUpperCase() + sub.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md text-center">
                  <p className="text-sm text-muted-foreground">No subjects assigned to your account</p>
                  <p className="text-xs text-muted-foreground mt-1">Contact your administrator to assign subjects</p>
                </div>
              )}
            </div>

            <div className=" space-y-2">
              <Label htmlFor="gradeLevel">Grade Level</Label>
              {loadingUserData ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Loading grades...</span>
                </div>
              ) : userGrades.length > 0 ? (
                <Select value={formData.gradeLevel} onValueChange={(value) => handleInputChange("gradeLevel", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {userGrades.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g === "kg1" ? "Kindergarten 1" : 
                         g === "kg2" ? "Kindergarten 2" : 
                         `${g}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md text-center">
                  <p className="text-sm text-muted-foreground">No grades assigned to your account</p>
                  <p className="text-xs text-muted-foreground mt-1">Contact your administrator to assign grades</p>
                </div>
              )}
            </div>
          </div>

          {/* Number of Panels and Language */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numPanels">Number of Panels</Label>
              <Select value={formData.numPanels.toString()} onValueChange={(value) => handleInputChange("numPanels", parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select number of panels" />
                </SelectTrigger>
                <SelectContent>
                  {panelOptions.map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} panel{num > 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select value={formData.language} onValueChange={(value) => handleInputChange("language", value)}>
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
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            {!isGenerating ? (
              <Button
                type="submit"
                disabled={!canGenerate || isLoading}
                className="flex-1 bg-purple-600 hover:bg-purple-600/90 text-white shadow-lg"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Create Comic
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleStop}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                <Pause className="h-4 w-4 mr-2" />
                Stop Generation
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
