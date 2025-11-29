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
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Presentation } from "lucide-react"
import { toast } from "sonner"
import { saveMediaContent } from "../action"
import { SlidePreview } from "@/components/ui/slide-preview"

const formSchema = z.object({
  plainText: z.string().min(1, "Topic is required"),
  customUserInstructions: z.string().optional(),
  length: z.number().min(1).max(50),
  language: z.enum(["ENGLISH", "HINDI"]),
  fetchImages: z.boolean(),
  verbosity: z.enum(["concise", "standard", "text-heavy"]),
  tone: z.enum(["educational", "playful", "professional", "persuasive", "inspirational"]),
  template: z.enum(["default", "aurora", "lavender", "monarch", "serene", "iris", "clyde", "adam", "nebula", "bruno"]),
})

type FormValues = z.infer<typeof formSchema>

export function SlideForm() {
  const [generatedContent, setGeneratedContent] = React.useState<any>(null)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [showPreview, setShowPreview] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plainText: "",
      customUserInstructions: "",
      length: 10,
      language: "ENGLISH",
      fetchImages: true,
      verbosity: "standard",
      tone: "educational",
      template: "default",
    },
  })

  const generateSlide = async (values: FormValues) => {
    setIsGenerating(true)
    setGeneratedContent(null)

    try {
      const response = await fetch("/api/media-toolkit/slide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate slide")
      }

      const data = await response.json()
      setGeneratedContent(data)
      setShowPreview(true)
    } catch (error) {
      console.error("Error generating slide:", error)
      toast.error(error instanceof Error ? error.message : "Failed to generate slide")
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
    formData.append("contentType", "slide")
    formData.append("title", `Slide Presentation - ${values.plainText.substring(0, 50)}`)
    formData.append("content", generatedContent.presentation_url || JSON.stringify(generatedContent))
    formData.append("metadata", JSON.stringify(values))

    try {
      await saveMediaContent(formData)
      toast.success("Slide presentation saved successfully")
      setShowPreview(false)
      setGeneratedContent(null)
      form.reset()
    } catch (error) {
      toast.error("Failed to save slide presentation")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(generateSlide)} className="space-y-6">
              <FormField
                control={form.control}
                name="plainText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topic *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter the main topic for the presentation"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customUserInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Specific instructions for the AI"
                        className="min-h-[80px]"
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
                  name="length"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Slides *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={50}
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
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ENGLISH">English</SelectItem>
                          <SelectItem value="HINDI">Hindi</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="verbosity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verbosity *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select verbosity" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="concise">Concise</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="text-heavy">Text Heavy</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tone *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select tone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="educational">Educational</SelectItem>
                          <SelectItem value="playful">Playful</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="persuasive">Persuasive</SelectItem>
                          <SelectItem value="inspirational">Inspirational</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="template"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select template" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="default">Default</SelectItem>
                          <SelectItem value="aurora">Aurora</SelectItem>
                          <SelectItem value="lavender">Lavender</SelectItem>
                          <SelectItem value="monarch">Monarch</SelectItem>
                          <SelectItem value="serene">Serene</SelectItem>
                          <SelectItem value="iris">Iris</SelectItem>
                          <SelectItem value="clyde">Clyde</SelectItem>
                          <SelectItem value="adam">Adam</SelectItem>
                          <SelectItem value="nebula">Nebula</SelectItem>
                          <SelectItem value="bruno">Bruno</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="fetchImages"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Include Stock Images</FormLabel>
                      <FormDescription>
                        Whether to include stock images in the presentation
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
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
                      <Presentation className="mr-2 h-4 w-4" />
                      Generate Slide
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {showPreview && generatedContent && (
        <SlidePreview
          content={generatedContent}
          onSave={handleSave}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

