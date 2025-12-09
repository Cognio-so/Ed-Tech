"use client"

import type React from "react"
import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type InputHTMLAttributes,
} from "react"

export type FileMetadata = {
  name: string
  size: number
  type: string
  url: string
  id: string
}

export type FileWithPreview = {
  file: File | FileMetadata
  id: string
  preview?: string
}

export type FileUploadOptions = {
  maxFiles?: number // Only used when multiple is true, defaults to Infinity
  maxSize?: number // in bytes
  accept?: string
  multiple?: boolean // Defaults to false
  initialFiles?: FileMetadata[]
  onFilesChange?: (files: FileWithPreview[]) => void // Callback when files change
  onFilesAdded?: (addedFiles: FileWithPreview[]) => void // Callback when new files are added
  // R2 Upload options
  uploadToR2?: boolean // Whether to upload files to R2 bucket, defaults to true
  // Backend integration options
  backendUrl?: string // Backend URL for sending document URLs
  userId?: string // User ID (teacher_id or student_id)
  sessionId?: string // Session ID
  userType?: "teacher" | "student" // User type to determine which endpoint to use
  onUploadProgress?: (progress: { fileId: string; progress: number }) => void
  onUploadError?: (error: { fileId: string; error: string }) => void
}

export type FileUploadState = {
  files: FileWithPreview[]
  isDragging: boolean
  errors: string[]
  isUploading: boolean
  uploadProgress: Record<string, number> // fileId -> progress percentage
}

export type FileUploadActions = {
  addFiles: (files: FileList | File[]) => void
  removeFile: (id: string) => void
  clearFiles: () => void
  clearErrors: () => void
  handleDragEnter: (e: DragEvent<HTMLElement>) => void
  handleDragLeave: (e: DragEvent<HTMLElement>) => void
  handleDragOver: (e: DragEvent<HTMLElement>) => void
  handleDrop: (e: DragEvent<HTMLElement>) => void
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  openFileDialog: () => void
  getInputProps: (
    props?: InputHTMLAttributes<HTMLInputElement>
  ) => InputHTMLAttributes<HTMLInputElement> & {
    ref: React.Ref<HTMLInputElement>
  }
}

// Helper function to upload file to R2
async function uploadFileToR2(
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ url: string; key: string }> {
  // Step 1: Get presigned URL from backend
  const presignedResponse = await fetch("/api/r2/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type,
    }),
  })

  if (!presignedResponse.ok) {
    const error = await presignedResponse.json()
    throw new Error(error.error || "Failed to get presigned URL")
  }

  const { uploadUrl, fileUrl, key } = await presignedResponse.json()

  // Step 2: Upload file to R2 using presigned URL
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
  })

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload file to R2")
  }

  onProgress?.(100)

  return { url: fileUrl, key }
}

// Helper function to send document URLs to backend
async function sendDocumentsToBackend(
  documents: Array<{ url: string; filename: string; type: string; id: string; size: number }>,
  options: {
    backendUrl?: string
    userId?: string
    sessionId?: string
    userType?: "teacher" | "student"
  }
): Promise<void> {
  const { backendUrl, userId, sessionId, userType } = options

  // Validate all required parameters are present
  if (!backendUrl || !userId || !sessionId || !userType) {
    console.warn("Cannot send documents to backend - missing required parameters:", {
      hasBackendUrl: !!backendUrl,
      hasUserId: !!userId,
      hasSessionId: !!sessionId,
      hasUserType: !!userType,
    })
    throw new Error("Missing required parameters to send documents to backend. Session may not be initialized yet.")
  }

  // Ensure sessionId is not empty and is a valid string
  if (!sessionId.trim()) {
    throw new Error("Session ID is empty. Please wait for session to be created.")
  }

  const endpoint =
    userType === "teacher"
      ? `${backendUrl}/api/teacher/${userId}/session/${sessionId}/add-documents`
      : `${backendUrl}/api/student/${userId}/session/${sessionId}/add-documents`

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documents: documents.map((doc) => ({
          file_url: doc.url,
          filename: doc.filename,
          file_type: doc.type,
          id: doc.id,
          size: doc.size,
        })),
      }),
    })
  } catch (error) {
    console.error("Error sending documents to backend:", error)
    throw error
  }
}

export const useFileUpload = (
  options: FileUploadOptions = {}
): [FileUploadState, FileUploadActions] => {
  const {
    maxFiles = Infinity,
    maxSize = Infinity,
    accept = "*",
    multiple = false,
    initialFiles = [],
    onFilesChange,
    onFilesAdded,
    uploadToR2 = true,
    backendUrl,
    userId,
    sessionId,
    userType,
    onUploadProgress,
    onUploadError,
  } = options

  const [state, setState] = useState<FileUploadState>({
    files: initialFiles.map((file) => ({
      file,
      id: file.id,
      preview: file.url,
    })),
    isDragging: false,
    errors: [],
    isUploading: false,
    uploadProgress: {},
  })

  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback(
    (file: File | FileMetadata): string | null => {
      if (file instanceof File) {
        if (file.size > maxSize) {
          return `File "${file.name}" exceeds the maximum size of ${formatBytes(maxSize)}.`
        }
      } else {
        if (file.size > maxSize) {
          return `File "${file.name}" exceeds the maximum size of ${formatBytes(maxSize)}.`
        }
      }

      if (accept !== "*") {
        const acceptedTypes = accept.split(",").map((type) => type.trim())
        const fileType = file instanceof File ? file.type || "" : file.type
        const fileExtension = `.${file instanceof File ? file.name.split(".").pop() : file.name.split(".").pop()}`

        const isAccepted = acceptedTypes.some((type) => {
          if (type.startsWith(".")) {
            return fileExtension.toLowerCase() === type.toLowerCase()
          }
          if (type.endsWith("/*")) {
            const baseType = type.split("/")[0]
            return fileType.startsWith(`${baseType}/`)
          }
          return fileType === type
        })

        if (!isAccepted) {
          return `File "${file instanceof File ? file.name : file.name}" is not an accepted file type.`
        }
      }

      return null
    },
    [accept, maxSize]
  )

  const createPreview = useCallback(
    (file: File | FileMetadata): string | undefined => {
      if (file instanceof File) {
        return URL.createObjectURL(file)
      }
      return file.url
    },
    []
  )

  const generateUniqueId = useCallback((file: File | FileMetadata): string => {
    if (file instanceof File) {
      return `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }
    return file.id
  }, [])

  const clearFiles = useCallback(() => {
    setState((prev) => {
      // Clean up object URLs
      prev.files.forEach((file) => {
        if (
          file.preview &&
          file.file instanceof File &&
          file.file.type.startsWith("image/")
        ) {
          URL.revokeObjectURL(file.preview)
        }
      })

      if (inputRef.current) {
        inputRef.current.value = ""
      }

      const newState = {
        ...prev,
        files: [],
        errors: [],
      }

      onFilesChange?.(newState.files)
      return newState
    })
  }, [onFilesChange])

  const addFiles = useCallback(
    async (newFiles: FileList | File[]) => {
      if (!newFiles || newFiles.length === 0) return

      const newFilesArray = Array.from(newFiles)
      const errors: string[] = []

      // Clear existing errors when new files are uploaded
      setState((prev) => ({ ...prev, errors: [], isUploading: true }))

      // In single file mode, clear existing files first
      if (!multiple) {
        clearFiles()
      }

      // Check if adding these files would exceed maxFiles (only in multiple mode)
      if (
        multiple &&
        maxFiles !== Infinity &&
        state.files.length + newFilesArray.length > maxFiles
      ) {
        errors.push(`You can only upload a maximum of ${maxFiles} files.`)
        setState((prev) => ({ ...prev, errors, isUploading: false }))
        return
      }

      const validFiles: FileWithPreview[] = []
      const filesToValidate: File[] = []

      newFilesArray.forEach((file) => {
        // Only check for duplicates if multiple files are allowed
        if (multiple) {
          const isDuplicate = state.files.some(
            (existingFile) =>
              existingFile.file.name === file.name &&
              existingFile.file.size === file.size
          )

          // Skip duplicate files silently
          if (isDuplicate) {
            return
          }
        }

        // Check file size
        if (file.size > maxSize) {
          errors.push(
            multiple
              ? `Some files exceed the maximum size of ${formatBytes(maxSize)}.`
              : `File exceeds the maximum size of ${formatBytes(maxSize)}.`
          )
          return
        }

        const error = validateFile(file)
        if (error) {
          errors.push(error)
        } else {
          filesToValidate.push(file)
        }
      })

      if (filesToValidate.length === 0) {
        setState((prev) => ({
          ...prev,
          errors,
          isUploading: false,
        }))
        if (inputRef.current) {
          inputRef.current.value = ""
        }
        return
      }

      // Upload files to R2 if enabled
      const uploadedFiles: FileWithPreview[] = []
      const documentsForBackend: Array<{
        url: string
        filename: string
        type: string
        id: string
        size: number
      }> = []

      for (const file of filesToValidate) {
        const fileId = generateUniqueId(file)
        try {
          setState((prev) => ({
            ...prev,
            uploadProgress: { ...prev.uploadProgress, [fileId]: 0 },
          }))

          let fileUrl: string
          let fileMetadata: FileMetadata

          if (uploadToR2) {
            // Upload to R2
            const { url } = await uploadFileToR2(file, (progress) => {
              setState((prev) => ({
                ...prev,
                uploadProgress: { ...prev.uploadProgress, [fileId]: progress },
              }))
              onUploadProgress?.({ fileId, progress })
            })

            fileUrl = url
            fileMetadata = {
              name: file.name,
              size: file.size,
              type: file.type,
              url: fileUrl,
              id: fileId,
            }

            documentsForBackend.push({
              url: fileUrl,
              filename: file.name,
              type: file.type,
              id: fileId,
              size: file.size,
            })
          } else {
            // Just create preview URL (for local files)
            fileUrl = createPreview(file) || ""
            fileMetadata = {
              name: file.name,
              size: file.size,
              type: file.type,
              url: fileUrl,
              id: fileId,
            }
          }

          uploadedFiles.push({
            file: fileMetadata,
            id: fileId,
            preview: fileUrl,
          })

          setState((prev) => ({
            ...prev,
            uploadProgress: { ...prev.uploadProgress, [fileId]: 100 },
          }))
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Failed to upload file"
          errors.push(`Failed to upload "${file.name}": ${errorMessage}`)
          onUploadError?.({ fileId, error: errorMessage })
        }
      }

      // Send documents to backend if configured
      // Only send if we have a valid sessionId from backend
      if (uploadedFiles.length > 0 && documentsForBackend.length > 0) {
        // Check if sessionId is valid (not empty)
        const isValidSessionId = sessionId && sessionId.trim() !== ""
        
        if (!isValidSessionId) {
          console.warn("Session ID not yet available. Documents uploaded to R2 but not sent to backend yet.")
          console.warn("Please wait for session to be created, then upload documents again.")
          // Still show success for R2 upload, but warn about backend
          errors.push("Documents uploaded to storage but session not ready. Please wait for session initialization and try uploading again.")
        } else {
          try {
            console.log(`[FILE UPLOADER] Sending ${documentsForBackend.length} documents to backend with sessionId: ${sessionId}`)
            await sendDocumentsToBackend(documentsForBackend, {
              backendUrl,
              userId,
              sessionId,
              userType,
            })
            console.log(`[FILE UPLOADER] Successfully sent documents to backend`)
          } catch (error) {
            console.error("Error sending documents to backend:", error)
            const errorMessage = error instanceof Error ? error.message : "Unknown error"
            errors.push(`Failed to send documents to backend: ${errorMessage}`)
            // Don't fail the upload if backend call fails - files are already in R2
          }
        }
      }

      // Update state with uploaded files
      if (uploadedFiles.length > 0) {
        onFilesAdded?.(uploadedFiles)

        setState((prev) => {
          const newFiles = !multiple
            ? uploadedFiles
            : [...prev.files, ...uploadedFiles]
          onFilesChange?.(newFiles)
          return {
            ...prev,
            files: newFiles,
            errors,
            isUploading: false,
            uploadProgress: {},
          }
        })
      } else {
        setState((prev) => ({
          ...prev,
          errors,
          isUploading: false,
          uploadProgress: {},
        }))
      }

      // Reset input value after handling files
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    },
    [
      state.files,
      maxFiles,
      multiple,
      maxSize,
      validateFile,
      createPreview,
      generateUniqueId,
      clearFiles,
      onFilesChange,
      onFilesAdded,
      uploadToR2,
      backendUrl,
      userId,
      sessionId, // Include sessionId in dependencies so it uses latest value
      userType,
      onUploadProgress,
      onUploadError,
    ]
  )

  const removeFile = useCallback(
    (id: string) => {
      setState((prev) => {
        const fileToRemove = prev.files.find((file) => file.id === id)
        if (
          fileToRemove &&
          fileToRemove.preview &&
          fileToRemove.file instanceof File &&
          fileToRemove.file.type.startsWith("image/")
        ) {
          URL.revokeObjectURL(fileToRemove.preview)
        }

        const newFiles = prev.files.filter((file) => file.id !== id)
        onFilesChange?.(newFiles)

        return {
          ...prev,
          files: newFiles,
          errors: [],
        }
      })
    },
    [onFilesChange]
  )

  const clearErrors = useCallback(() => {
    setState((prev) => ({
      ...prev,
      errors: [],
    }))
  }, [])

  const handleDragEnter = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setState((prev) => ({ ...prev, isDragging: true }))
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return
    }

    setState((prev) => ({ ...prev, isDragging: false }))
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setState((prev) => ({ ...prev, isDragging: false }))

      // Don't process files if the input is disabled
      if (inputRef.current?.disabled) {
        return
      }

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        // In single file mode, only use the first file
        if (!multiple) {
          const file = e.dataTransfer.files[0]
          addFiles([file]).catch((error) => {
            console.error("Error in handleDrop:", error)
          })
        } else {
          addFiles(e.dataTransfer.files).catch((error) => {
            console.error("Error in handleDrop:", error)
          })
        }
      }
    },
    [addFiles, multiple]
  )

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files).catch((error) => {
          console.error("Error in handleFileChange:", error)
        })
      }
    },
    [addFiles]
  )

  const openFileDialog = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.click()
    }
  }, [])

  const getInputProps = useCallback(
    (props: InputHTMLAttributes<HTMLInputElement> = {}) => {
      return {
        ...props,
        type: "file" as const,
        onChange: handleFileChange,
        accept: props.accept || accept,
        multiple: props.multiple !== undefined ? props.multiple : multiple,
        ref: inputRef,
      }
    },
    [accept, multiple, handleFileChange]
  )

  return [
    state,
    {
      addFiles,
      removeFile,
      clearFiles,
      clearErrors,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handleFileChange,
      openFileDialog,
      getInputProps,
    },
  ]
}

// Helper function to format bytes to human-readable format
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + sizes[i]
}
