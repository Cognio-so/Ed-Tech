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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { saveMediaContent } from "../action"
import { ImagePreview } from "@/components/ui/image-preview"

const formSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  gradeLevel: z.string().min(1, "Grade level is required"),
  preferredVisualType: z.enum(["image", "chart", "diagram"]),
  subject: z.string().min(1, "Subject is required"),
  instructions: z.string().min(1, "Instructions are required"),
  difficultyFlag: z.string(),
  language: z.string(),
})

type FormValues = z.infer<typeof formSchema>

interface ImageFormProps {
  initialGrades: { id: string; name: string }[]
  initialSubjects: { id: string; name: string }[]
}

export function ImageForm({ initialGrades, initialSubjects }: ImageFormProps) {
  const [generatedContent, setGeneratedContent] = React.useState<string | null>(null)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [showPreview, setShowPreview] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
      gradeLevel: "",
      preferredVisualType: "image",
      subject: "",
      instructions: "",
      difficultyFlag: "false",
      language: "English",
    },
  })

  const generateImage = async (values: FormValues) => {
    setIsGenerating(true)
    setGeneratedContent(null)

    try {
      const response = await fetch("/api/media-toolkit/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate image")
      }

      const data = await response.json()
      setGeneratedContent(data.image_url)
      setShowPreview(true)
    } catch (error) {
      console.error("Error generating image:", error)
      toast.error(error instanceof Error ? error.message : "Failed to generate image")
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
    formData.append("contentType", "image")
    formData.append("title", `Image - ${values.topic}`)
    formData.append("content", generatedContent)
    formData.append("metadata", JSON.stringify(values))

    try {
      await saveMediaContent(formData)
      toast.success("Image saved successfully")
      setShowPreview(false)
      setGeneratedContent(null)
      form.reset()
    } catch (error) {
      toast.error("Failed to save image")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(generateImage)} className="space-y-6">
              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topic *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter the topic for the image" {...field} />
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
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select grade" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {initialGrades.map((grade) => (
                            <SelectItem key={grade.id} value={grade.name}>
                              {grade.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select subject" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {initialSubjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.name}>
                              {subject.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferredVisualType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visual Type *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select visual type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="image">Image</SelectItem>
                          <SelectItem value="chart">Chart</SelectItem>
                          <SelectItem value="diagram">Diagram</SelectItem>
                        </SelectContent>
                      </Select>
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

              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detailed Instructions *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what you want in the image"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      <ImageIcon className="mr-2 h-4 w-4" />
                      Generate Image
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {showPreview && generatedContent && (
        <ImagePreview
          imageUrl={generatedContent}
          topic={form.getValues().topic}
          onSave={handleSave}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

