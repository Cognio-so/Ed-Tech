"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { InlineMath, BlockMath } from "react-katex";
import mermaid from "mermaid";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { Image as AIImage } from "@/components/ai-elements/image";

interface MarkdownProps {
  content: string;
  className?: string;
  sources?: Array<{ href: string; title: string }>;
}

// Utility function to detect image URLs
const isImageUrl = (url: string): boolean => {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)(\?.*)?$/i;
  const imageHosts = [
    "replicate.delivery",
    "imgur.com",
    "i.imgur.com",
    "cdn.discordapp.com",
    "media.discordapp.net",
    "images.unsplash.com",
    "picsum.photos",
    "via.placeholder.com",
  ];

  const hasImageExtension = imageExtensions.test(url);
  const hasImageHost = imageHosts.some((host) => url.includes(host));

  console.log("Image URL detection:", {
    url,
    hasImageExtension,
    hasImageHost,
    result: hasImageExtension || hasImageHost,
  });

  return hasImageExtension || hasImageHost;
};

// Mermaid Diagram Component
const MermaidDiagram: React.FC<{ code: string }> = ({ code }) => {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mermaidRef.current) return;

    // Initialize Mermaid if not already initialized
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      fontFamily: "inherit",
    });

    // Generate a unique ID for this diagram
    const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

    // Clear any previous content
    mermaidRef.current.innerHTML = "";

    // Sanitize code to fix common LLM generation errors
    const sanitizedCode = code.replace(/\[(.*?)\]/g, (match, content) => {
      // If content is already quoted, leave it mostly alone but check for arrows
      if (content.startsWith('"') && content.endsWith('"')) {
        return match;
      }
      
      let cleanContent = content
        .replace(/-->/g, " to ")
        .replace(/->/g, " to ")
        .replace(/</g, " less than ")
        .replace(/>/g, " greater than ")
        .replace(/"/g, "'"); // Replace double quotes with single quotes inside
        
      return `["${cleanContent}"]`; // Wrap in quotes to handle other special chars
    });

    // Render the diagram
    mermaid
      .render(id, sanitizedCode)
      .then((result) => {
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = result.svg;
          setError(null);
        }
      })
      .catch((err) => {
        console.error("Mermaid rendering error:", err);
        // Try fallback rendering with raw code if fails
        setError("Failed to render diagram. Please check the syntax.");
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = `<pre class="text-xs text-muted-foreground p-4 overflow-auto">${code}</pre>`;
        }
      });
  }, [code]);

  if (error) {
    return (
      <div className="my-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
          <span>⚠️</span> Diagram Syntax Error
        </p>
        <p className="text-xs text-muted-foreground mb-2">
          The AI generated an invalid diagram definition.
        </p>
        <div className="bg-muted/50 p-2 rounded overflow-x-auto">
          <pre className="text-xs text-muted-foreground">
            {code}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mermaidRef}
      className="my-6 flex justify-center items-center rounded-lg border bg-card p-6 overflow-x-auto shadow-sm"
    />
  );
};

// Utility function to get image source type
const getImageSourceType = (url: string): string => {
  if (url.includes("replicate.delivery")) return "Replicate";
  if (url.includes("imgur.com")) return "Imgur";
  if (url.includes("discordapp.com")) return "Discord";
  if (url.includes("unsplash.com")) return "Unsplash";
  if (url.includes("picsum.photos")) return "Lorem Picsum";
  return "External";
};

const Markdown: React.FC<MarkdownProps> = ({
  content,
  className,
  sources = [],
}) => {
  // Debug logging to see what content we're receiving
  console.log("Markdown component received content:", content);

  let cleanContent = content;

  // Process content to convert URL: lines to proper markdown links
  cleanContent = cleanContent.replace(
    /\* URL: (https?:\/\/[^\s]+)/g,
    "* [$1]($1)"
  );

  // Process image URLs - detect and convert to markdown images
  // This will automatically detect and convert various image URLs to markdown images
  cleanContent = cleanContent.replace(/(https?:\/\/[^\s]+)/g, (match) => {
    console.log("Checking URL for image:", match);
    if (isImageUrl(match)) {
      const sourceType = getImageSourceType(match);
      const altText = sourceType === "Replicate" ? "Generated Image" : "Image";
      console.log("Converting to image markdown:", `![${altText}](${match})`);
      return `![${altText}](${match})`;
    }
    return match;
  });

  // Remove standalone double asterisks
  cleanContent = cleanContent.replace(/^\*\*$/gm, "");

  // Remove empty lines that might be left after removing **
  cleanContent = cleanContent.replace(/\n\s*\n\s*\n/g, "\n\n");

  // Debug logging to see processed content
  console.log("Markdown processed content:", cleanContent);

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none break-words",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Custom link component with Shadcn typography and text-primary styling
          a({ href, children, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline underline-offset-4 transition-colors font-medium break-words break-all"
                {...props}
              >
                {children}
              </a>
            );
          },
          // Custom heading components with Shadcn typography
          h1({ children, ...props }) {
            return (
              <h1
                className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mt-8 mb-4 first:mt-0"
                {...props}
              >
                {children}
              </h1>
            );
          },
          h2({ children, ...props }) {
            return (
              <h2
                className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight mt-8 mb-4 first:mt-0"
                {...props}
              >
                {children}
              </h2>
            );
          },
          h3({ children, ...props }) {
            return (
              <h3
                className="scroll-m-20 text-2xl font-semibold tracking-tight mt-6 mb-3 first:mt-0"
                {...props}
              >
                {children}
              </h3>
            );
          },
          h4({ children, ...props }) {
            return (
              <h4
                className="scroll-m-20 text-xl font-semibold tracking-tight mt-5 mb-2 first:mt-0"
                {...props}
              >
                {children}
              </h4>
            );
          },
          // Custom centered heading for exam headers
          h5({ children, ...props }) {
            return (
              <h5
                className="scroll-m-20 text-lg font-bold tracking-tight mt-4 mb-2 text-center w-full block"
                {...props}
              >
                {children}
              </h5>
            );
          },
          // Custom paragraph with proper spacing
          p({ children, ...props }) {
            return (
              <p
                className="leading-7 [&:not(:first-child)]:mt-6 mb-4 last:mb-0"
                {...props}
              >
                {children}
              </p>
            );
          },
          // Custom list styling following Shadcn patterns
          ul({ children, ...props }) {
            return (
              <ul className="my-6 ml-6 list-disc [&>li]:mt-2" {...props}>
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol className="my-6 ml-6 list-decimal [&>li]:mt-2" {...props}>
                {children}
              </ol>
            );
          },
          // Custom list item styling
          li({ children, ...props }) {
            return (
              <li className="break-words leading-relaxed" {...props}>
                {children}
              </li>
            );
          },
          // Custom code styling with Shadcn typography
          code({ children, className }) {
            const match = /language-([\w-]+)/.exec(className || "");
            const language = match ? match[1] : "";

            // Handle Mermaid diagrams
            if (language === "mermaid") {
              return (
                <MermaidDiagram code={String(children).replace(/\n$/, "")} />
              );
            }

            // Handle Exam Header
            if (language === "exam-header" || (language === "json" && String(children).includes("organisation_name"))) {
              try {
                const data = JSON.parse(String(children));
                return (
                  <div className="w-full mb-8 font-sans">
                    <h1 className="text-3xl font-extrabold text-center uppercase tracking-wide mb-2">
                      {data.organisation_name}
                    </h1>
                    <h3 className="text-xl font-bold text-center text-muted-foreground mb-6">
                      {data.exam_name}
                    </h3>
                    
                    <div className="flex justify-between items-end mb-2 px-1">
                      <h3 className="text-lg font-semibold">
                        Subject: <span className="font-normal">{data.subject}</span>
                      </h3>
                      <h3 className="text-lg font-semibold">
                        Grade: <span className="font-normal">{data.grade}</span>
                      </h3>
                    </div>
                    
                    <div className="flex justify-between items-end px-1">
                      <p className="text-base font-medium">
                        Date: <span className="inline-block w-32 border-b border-black dark:border-white"></span>
                      </p>
                      <p className="text-base font-medium">
                        Duration: <span className="font-normal">{data.duration}</span>
                      </p>
                    </div>
                    
                    <div className="w-full h-px bg-border mt-6 mb-8" />
                  </div>
                );
              } catch (e) {
                console.error("Exam header parsing error:", e);
              }
            }

            if (language) {
              return (
                <SyntaxHighlighter
                  style={atomDark}
                  language={language}
                  PreTag="div"
                  className="rounded-lg my-4"
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              );
            }
            // Inline code with Shadcn styling
            return (
              <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
                {children}
              </code>
            );
          },
          pre({ children }) {
            return (
              <pre className="mb-4 mt-6 overflow-x-auto rounded-lg border bg-muted p-4">
                {children}
              </pre>
            );
          },
          // Custom blockquote styling
          blockquote({ children, ...props }) {
            return (
              <blockquote
                className="mt-6 border-l-2 pl-6 italic break-words"
                {...props}
              >
                {children}
              </blockquote>
            );
          },
          // Math components
          span({ className, children }) {
            if (className === "math math-inline") {
              return <InlineMath math={String(children)} />;
            }
            if (className === "math math-display") {
              return <BlockMath math={String(children)} />;
            }
            return <span>{children}</span>;
          },
          // Custom table styling with Shadcn design
          table({ children }) {
            return (
              <div className="my-6 w-full overflow-y-auto">
                <table className="w-full">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children, ...props }) {
            return <thead {...props}>{children}</thead>;
          },
          tbody({ children, ...props }) {
            return <tbody {...props}>{children}</tbody>;
          },
          tr({ children, ...props }) {
            return (
              <tr className="m-0 border-t p-0 even:bg-muted" {...props}>
                {children}
              </tr>
            );
          },
          th({ children, ...props }) {
            return (
              <th
                className="border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right"
                {...props}
              >
                {children}
              </th>
            );
          },
          td({ children, ...props }) {
            return (
              <td
                className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right"
                {...props}
              >
                {children}
              </td>
            );
          },
          // Custom image component with enhanced typography and Replicate URL support
          img({ src, alt, ...props }) {
            // Check if this is an AI-generated image (base64 or has specific properties)
            if (
              typeof src === "string" &&
              (src.startsWith("data:image/") || src.includes("base64"))
            ) {
              return (
                <div className="my-6">
                  <AIImage
                    base64={src}
                    mediaType="image/png"
                    uint8Array={new Uint8Array()}
                    alt={alt || "Generated image"}
                    className="rounded-lg border max-w-full h-auto"
                  />
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    {alt || "Generated image"}
                  </p>
                </div>
              );
            }

            // Check if this is a Replicate URL or other image source
            const isReplicateUrl =
              typeof src === "string" && src.includes("replicate.delivery");
            const isGeneratedImage =
              alt?.toLowerCase().includes("generated") || isReplicateUrl;
            const sourceType =
              typeof src === "string" ? getImageSourceType(src) : "Unknown";

            return (
              <div className="my-6">
                <div className="relative group">
                  <img
                    src={src}
                    alt={alt || "Image"}
                    className="rounded-lg border max-w-full h-auto shadow-sm transition-shadow hover:shadow-md"
                    loading="lazy"
                    onError={(e) => {
                      // Fallback for broken images
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = "block";
                    }}
                    {...props}
                  />
                  {/* Fallback for broken images */}
                  <div
                    className="hidden rounded-lg border bg-muted/50 p-8 text-center"
                    style={{ display: "none" }}
                  >
                    <p className="text-muted-foreground">
                      Failed to load image
                    </p>
                    <a
                      href={typeof src === "string" ? src : "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 underline underline-offset-4 transition-colors text-sm mt-2 inline-block"
                    >
                      View original
                    </a>
                  </div>

                  {/* Image overlay with source info */}
                  {(isGeneratedImage || sourceType !== "External") && (
                    <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 text-xs text-muted-foreground border border-border/50">
                      {sourceType}
                    </div>
                  )}
                </div>

                {/* Image caption with typography */}
                <div className="mt-3 text-center">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {alt || (isGeneratedImage ? "Generated image" : "Image")}
                  </p>
                  {src && (
                    <a
                      href={typeof src === "string" ? src : "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:text-primary/80 underline underline-offset-2 transition-colors mt-1 inline-block"
                    >
                      View full size
                    </a>
                  )}
                </div>
              </div>
            );
          },
        }}
      >
        {cleanContent}
      </ReactMarkdown>

      {/* AI SDK Sources Component */}
      {sources.length > 0 && (
        <div className="mt-4">
          <Sources>
            <SourcesTrigger count={sources.length} />
            <SourcesContent>
              {sources.map((source, index) => (
                <Source href={source.href} key={index} title={source.title} />
              ))}
            </SourcesContent>
          </Sources>
        </div>
      )}
    </div>
  );
};

export default Markdown;
