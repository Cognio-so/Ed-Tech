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
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Video } from "lucide-react"
import { toast } from "sonner"
import { saveMediaContent } from "../action"
import { VideoPreview } from "@/components/ui/video-preview"

const formSchema = z.object({
  pptxFile: z.instanceof(File).refine((file) => file.size > 0, "File is required"),
  voiceId: z.string().min(1, "Voice ID is required"),
  talkingPhotoId: z.string().min(1, "Talking Photo ID is required"),
  title: z.string().min(1, "Title is required"),
  language: z.string(),
})

type FormValues = z.infer<typeof formSchema>

export function VideoForm() {
  const [generatedContent, setGeneratedContent] = React.useState<any>(null)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [showPreview, setShowPreview] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      voiceId: "",
      talkingPhotoId: "",
      title: "",
      language: "english",
    } as any,
  })

  const generateVideo = async (values: FormValues) => {
    setIsGenerating(true)
    setGeneratedContent(null)

    try {
      const formData = new FormData()
      formData.append("pptxFile", values.pptxFile)
      formData.append("voiceId", values.voiceId)
      formData.append("talkingPhotoId", values.talkingPhotoId)
      formData.append("title", values.title)
      formData.append("language", values.language)

      const response = await fetch("/api/media-toolkit/video", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate video")
      }

      const data = await response.json()
      setGeneratedContent(data)
      setShowPreview(true)
    } catch (error) {
      console.error("Error generating video:", error)
      toast.error(error instanceof Error ? error.message : "Failed to generate video")
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
    formData.append("contentType", "video")
    formData.append("title", `Video - ${values.title}`)
    formData.append("content", JSON.stringify(generatedContent))
    formData.append("metadata", JSON.stringify({
      voiceId: values.voiceId,
      talkingPhotoId: values.talkingPhotoId,
      language: values.language,
    }))

    try {
      await saveMediaContent(formData)
      toast.success("Video saved successfully")
      setShowPreview(false)
      setGeneratedContent(null)
      form.reset()
    } catch (error) {
      toast.error("Failed to save video")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(generateVideo)} className="space-y-6">
              <FormField
                control={form.control}
                name="pptxFile"
                render={({ field: { value, onChange, ...field } }) => (
                  <FormItem>
                    <FormLabel>PowerPoint File (.pptx) *</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept=".pptx"
                        {...field}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            onChange(file)
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter video title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="voiceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voice ID *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter HeyGen Voice ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="talkingPhotoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Talking Photo ID *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter HeyGen Avatar ID" {...field} />
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
                        <Input placeholder="e.g., english" {...field} />
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
                      <Video className="mr-2 h-4 w-4" />
                      Generate Video
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {showPreview && generatedContent && (
        <VideoPreview
          content={generatedContent}
          title={form.getValues().title}
          onSave={handleSave}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

