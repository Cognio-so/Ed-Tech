"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, BookOpen } from "lucide-react"
import { toast } from "sonner"
import { saveMediaContent } from "../action"
import { ComicPreview } from "@/components/ui/comic-preview"

const formSchema = z.object({
  instructions: z.string().min(1, "Story topic is required"),
  gradeLevel: z.string().min(1, "Grade level is required"),
  numPanels: z.number().min(1).max(20),
  language: z.string(),
})

type FormValues = z.infer<typeof formSchema>

interface ComicPanel {
  index: number
  url: string
  footer_text: string
  prompt: string
}

export function ComicForm() {
  const [generatedContent, setGeneratedContent] = React.useState<{
    story?: string
    panels?: ComicPanel[]
  } | null>(null)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [showPreview, setShowPreview] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      instructions: "",
      gradeLevel: "",
      numPanels: 4,
      language: "English",
    },
  })

  const generateComic = async (values: FormValues) => {
    setIsGenerating(true)
    setGeneratedContent(null)

    try {
      const response = await fetch("/api/media-toolkit/comic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate comic")
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No response body")
      }

      const decoder = new TextDecoder()
      let story = ""
      const panels: ComicPanel[] = []
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer.trim())
              if (parsed.type === "story_prompts") {
                story = parsed.content || ""
              } else if (parsed.type === "panel_image") {
                const panelIndex = parsed.index || parsed.panel_index
                const imageUrl = parsed.url || parsed.image_url || parsed.image_data_url
                const footerText = parsed.footer_text || parsed.footer || ""
                const prompt = parsed.prompt_used || parsed.prompt || ""
                
                if (imageUrl && panelIndex !== undefined) {
                  const existingIndex = panels.findIndex(p => p.index === panelIndex)
                  const panelData = {
                    index: panelIndex,
                    url: imageUrl,
                    footer_text: footerText,
                    prompt: prompt,
                  }
                  
                  if (existingIndex >= 0) {
                    panels[existingIndex] = panelData
                  } else {
                    panels.push(panelData)
                  }
                }
              }
            } catch (e) {
              console.error("Error parsing final buffer:", e)
            }
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        
        for (const line of lines) {
          const trimmedLine = line.trim()
          if (trimmedLine) {
            try {
              const parsed = JSON.parse(trimmedLine)
              console.log("Parsed comic chunk:", parsed.type, parsed.index || parsed.panel_index)
              
              if (parsed.type === "story_prompts") {
                story = parsed.content || ""
                setGeneratedContent({ story, panels: [...panels] })
              } else if (parsed.type === "panel_image") {
                const panelIndex = parsed.index || parsed.panel_index
                const imageUrl = parsed.url || parsed.image_url || parsed.image_data_url
                const footerText = parsed.footer_text || parsed.footer || ""
                const prompt = parsed.prompt_used || parsed.prompt || ""
                
                if (imageUrl && panelIndex !== undefined) {
                  console.log("Adding panel:", panelIndex, "URL length:", imageUrl.length)
                  const existingIndex = panels.findIndex(p => p.index === panelIndex)
                  const panelData = {
                    index: panelIndex,
                    url: imageUrl,
                    footer_text: footerText,
                    prompt: prompt,
                  }
                  
                  if (existingIndex >= 0) {
                    panels[existingIndex] = panelData
                  } else {
                    panels.push(panelData)
                  }
                  
                  panels.sort((a, b) => a.index - b.index)
                  setGeneratedContent({ story, panels: [...panels] })
                } else {
                  console.warn("Missing image URL or index:", { panelIndex, imageUrl: !!imageUrl })
                }
              }
            } catch (e) {
              console.error("Error parsing comic stream line:", e, trimmedLine.substring(0, 100))
            }
          }
        }
      }

      console.log("Final comic content:", { storyLength: story.length, panelsCount: panels.length })
      setGeneratedContent({ story, panels })
      setShowPreview(true)
    } catch (error) {
      console.error("Error generating comic:", error)
      toast.error(error instanceof Error ? error.message : "Failed to generate comic")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!generatedContent) {
      toast.error("No content to save")
      return
    }

    const values = form.getValues()
    const formData = new FormData()
    formData.append("contentType", "comic")
    formData.append("title", `Comic - ${values.instructions.substring(0, 50)}`)
    formData.append("content", JSON.stringify(generatedContent))
    formData.append("metadata", JSON.stringify(values))

    try {
      await saveMediaContent(formData)
      toast.success("Comic saved successfully")
      setShowPreview(false)
      setGeneratedContent(null)
      form.reset()
    } catch (error) {
      toast.error("Failed to save comic")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(generateComic)} className="space-y-6">
              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Story Topic *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter educational story topic, e.g., Water cycle"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="gradeLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grade Level *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Grade 5 or 5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="numPanels"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Panels *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., English" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset()
                    setGeneratedContent(null)
                    setShowPreview(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <BookOpen className="mr-2 h-4 w-4" />
                      Generate Comic
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {showPreview && generatedContent && (
        <ComicPreview
          content={generatedContent}
          topic={form.getValues().instructions}
          onSave={handleSave}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

