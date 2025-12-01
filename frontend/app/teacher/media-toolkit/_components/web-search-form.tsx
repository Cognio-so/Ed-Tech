"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
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
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { saveMediaContent } from "../action"
import { WebSearchPreview } from "@/components/ui/web-search-preview"

const formSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  gradeLevel: z.string().min(1, "Grade level is required"),
  subject: z.string().min(1, "Subject is required"),
  contentType: z.string().min(1, "Content type is required"),
  language: z.string().min(1, "Language is required"),
  comprehension: z.string().min(1, "Comprehension level is required"),
})

type FormValues = z.infer<typeof formSchema>

interface WebSearchFormProps {
  initialGrades: { id: string; name: string }[]
  initialSubjects: { id: string; name: string }[]
}

export function WebSearchForm({ initialGrades, initialSubjects }: WebSearchFormProps) {
  const [generatedContent, setGeneratedContent] = React.useState("")
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [showPreview, setShowPreview] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
      gradeLevel: "",
      subject: "",
      contentType: "",
      language: "English",
      comprehension: "intermediate",
    },
  })

  const generateWebSearch = async (values: FormValues) => {
    setIsGenerating(true)
    setGeneratedContent("")

    try {
      const response = await fetch("/api/media-toolkit/web", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate web search content")
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No response body")
      }

      const decoder = new TextDecoder()
      let accumulatedContent = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        accumulatedContent += chunk
        setGeneratedContent(accumulatedContent)
      }
      
      setShowPreview(true)
    } catch (error) {
      console.error("Error generating web search:", error)
      toast.error(error instanceof Error ? error.message : "Failed to generate web search content")
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
    formData.append("contentType", "web")
    formData.append("title", `Web Search - ${values.topic}`)
    formData.append("content", generatedContent)
    formData.append("metadata", JSON.stringify(values))

    try {
      await saveMediaContent(formData)
      toast.success("Web search content saved successfully")
      setShowPreview(false)
      setGeneratedContent("")
      form.reset()
    } catch (error) {
      toast.error("Failed to save web search content")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(generateWebSearch)} className="space-y-6">
              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topic *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter search topic" {...field} />
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
                  name="contentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content Type *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., articles, videos" {...field} />
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

                <FormField
                  control={form.control}
                  name="comprehension"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comprehension Level *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select comprehension level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
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
                    setGeneratedContent("")
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
                      <Search className="mr-2 h-4 w-4" />
                      Generate Web Search
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {showPreview && generatedContent && (
        <WebSearchPreview
          content={generatedContent}
          topic={form.getValues().topic}
          onSave={handleSave}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

