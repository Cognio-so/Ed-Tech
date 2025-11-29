"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PaperclipIcon, SendIcon, Loader2, XIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { useCallback, useState, useRef, useEffect, createContext, useContext } from "react";

export type PromptInputMessage = {
  text?: string;
  files?: File[];
};

type PromptInputContextType = {
  files: File[];
  setFiles: (files: File[] | ((prev: File[]) => File[])) => void;
  text: string;
  setText: (text: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  multiple: boolean;
};

const PromptInputContext = createContext<PromptInputContextType | null>(null);

const usePromptInputContext = () => {
  const context = useContext(PromptInputContext);
  if (!context) {
    throw new Error("PromptInput components must be used within PromptInput");
  }
  return context;
};

export type PromptInputProps = HTMLAttributes<HTMLFormElement> & {
  onSubmit?: (message: PromptInputMessage) => void;
  globalDrop?: boolean;
  multiple?: boolean;
  disabled?: boolean;
};

export const PromptInput = ({
  className,
  onSubmit,
  globalDrop = false,
  multiple = false,
  disabled = false,
  children,
  ...props
}: PromptInputProps) => {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (disabled || (!text.trim() && files.length === 0)) return;

      onSubmit?.({
        text: text.trim(),
        files: files.length > 0 ? files : undefined,
      });

      setText("");
      setFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [text, files, onSubmit, disabled]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (multiple) {
        setFiles((prev) => [...prev, ...selectedFiles]);
      } else {
        setFiles(selectedFiles);
      }
    },
    [multiple]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (multiple) {
        setFiles((prev) => [...prev, ...droppedFiles]);
      } else {
        setFiles(droppedFiles);
      }
    },
    [multiple]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (globalDrop) {
      const handleGlobalDrop = (e: DragEvent) => {
        if (e.dataTransfer?.files.length) {
          e.preventDefault();
          const droppedFiles = Array.from(e.dataTransfer.files);
          if (multiple) {
            setFiles((prev) => [...prev, ...droppedFiles]);
          } else {
            setFiles(droppedFiles);
          }
        }
      };

      const handleGlobalDragOver = (e: DragEvent) => {
        e.preventDefault();
      };

      document.addEventListener("drop", handleGlobalDrop);
      document.addEventListener("dragover", handleGlobalDragOver);

      return () => {
        document.removeEventListener("drop", handleGlobalDrop);
        document.removeEventListener("dragover", handleGlobalDragOver);
      };
    }
  }, [globalDrop, multiple]);

  return (
    <PromptInputContext.Provider
      value={{ files, setFiles, text, setText, fileInputRef, multiple }}
    >
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={cn("flex flex-col gap-2", className)}
        {...props}
      >
        {children}
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload files"
        />
      </form>
    </PromptInputContext.Provider>
  );
};

export type PromptInputHeaderProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputHeader = ({
  className,
  children,
  ...props
}: PromptInputHeaderProps) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);

export type PromptInputAttachmentsProps = {
  children: (attachment: File) => ReactNode;
};

export const PromptInputAttachments = ({
  children,
}: PromptInputAttachmentsProps) => {
  const { files } = usePromptInputContext();

  return (
    <>
      {files.map((file, index) => (
        <div key={index}>{children(file)}</div>
      ))}
    </>
  );
};

export type PromptInputAttachmentProps = {
  data: File | unknown;
  onRemove?: () => void;
};

export const PromptInputAttachment = ({ 
  data,
  onRemove 
}: PromptInputAttachmentProps) => {
  const file = data as File;
  if (!file) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2 text-sm">
      <PaperclipIcon className="size-4 shrink-0" />
      <span className="truncate flex-1">{file.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 hover:bg-muted rounded p-1"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </div>
  );
};

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = ({
  className,
  children,
  ...props
}: PromptInputBodyProps) => (
  <div className={cn("relative", className)} {...props}>
    {children}
  </div>
);

export type PromptInputTextareaProps = ComponentProps<typeof Textarea> & {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
};

export const PromptInputTextarea = ({
  className,
  value: controlledValue,
  onChange: controlledOnChange,
  placeholder = "Type your message...",
  ...props
}: PromptInputTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const context = useContext(PromptInputContext);
  
  const value = controlledValue ?? context?.text ?? "";
  const onChange = controlledOnChange ?? ((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    context?.setText(e.target.value);
  });

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={cn("min-h-[60px] max-h-[200px] resize-none", className)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          const form = textareaRef.current?.closest("form");
          form?.requestSubmit();
        }
      }}
      {...props}
    />
  );
};

export type PromptInputFooterProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputFooter = ({
  className,
  children,
  ...props
}: PromptInputFooterProps) => (
  <div
    className={cn("flex items-center justify-between gap-2", className)}
    {...props}
  >
    {children}
  </div>
);

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({
  className,
  children,
  ...props
}: PromptInputToolsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

export type PromptInputActionMenuProps = ComponentProps<
  typeof DropdownMenu
>;

export const PromptInputActionMenu = ({
  children,
  ...props
}: PromptInputActionMenuProps) => (
  <DropdownMenu {...props}>{children}</DropdownMenu>
);

export type PromptInputActionMenuTriggerProps = ComponentProps<
  typeof DropdownMenuTrigger
>;

export const PromptInputActionMenuTrigger = ({
  children,
  ...props
}: PromptInputActionMenuTriggerProps) => (
  <DropdownMenuTrigger asChild {...props}>
    {children || (
      <Button type="button" size="icon" variant="ghost">
        <PaperclipIcon className="size-4" />
      </Button>
    )}
  </DropdownMenuTrigger>
);

export type PromptInputActionMenuContentProps = ComponentProps<
  typeof DropdownMenuContent
>;

export const PromptInputActionMenuContent = ({
  children,
  ...props
}: PromptInputActionMenuContentProps) => (
  <DropdownMenuContent {...props}>{children}</DropdownMenuContent>
);

export type PromptInputActionAddAttachmentsProps = ComponentProps<
  typeof Button
> & {
  onAdd?: () => void;
};

export const PromptInputActionAddAttachments = ({
  onAdd,
  ...props
}: PromptInputActionAddAttachmentsProps) => {
  const { fileInputRef, setFiles, multiple } = usePromptInputContext();

  const handleClick = () => {
    fileInputRef.current?.click();
    onAdd?.();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={handleClick}
      className="w-full justify-start"
      {...props}
    >
      <PaperclipIcon className="mr-2 size-4" />
      Add attachments
    </Button>
  );
};

export type PromptInputButtonProps = ComponentProps<typeof Button>;

export const PromptInputButton = ({
  className,
  ...props
}: PromptInputButtonProps) => (
  <Button
    type="button"
    size="icon"
    variant="ghost"
    className={cn("shrink-0", className)}
    {...props}
  />
);

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: "submitted" | "streaming" | "ready";
  disabled?: boolean;
};

export const PromptInputSubmit = ({
  status,
  disabled,
  className,
  ...props
}: PromptInputSubmitProps) => {
  const isLoading = status === "submitted" || status === "streaming";

  return (
    <Button
      type="submit"
      size="icon"
      disabled={disabled || isLoading}
      className={cn("shrink-0", className)}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <SendIcon className="size-4" />
      )}
    </Button>
  );
};

