"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { InlineMath, BlockMath } from "react-katex";
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
  // Check for base64 data URLs
  if (url.startsWith("data:image/")) {
    return true;
  }
  
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)(\?.*)?$/i;
  const imageHosts = [
    'replicate.delivery',
    'imgur.com',
    'i.imgur.com',
    'cdn.discordapp.com',
    'media.discordapp.net',
    'images.unsplash.com',
    'picsum.photos',
    'via.placeholder.com',
    'cloudinary.com'
  ];
  
  const hasImageExtension = imageExtensions.test(url);
  const hasImageHost = imageHosts.some(host => url.includes(host));
  
  return hasImageExtension || hasImageHost;
};

// Utility function to get image source type
const getImageSourceType = (url: string): string => {
  if (url.startsWith('data:image/')) return 'Base64';
  if (url.includes('replicate.delivery')) return 'Replicate';
  if (url.includes('cloudinary.com')) return 'Cloudinary';
  if (url.includes('imgur.com')) return 'Imgur';
  if (url.includes('discordapp.com')) return 'Discord';
  if (url.includes('unsplash.com')) return 'Unsplash';
  if (url.includes('picsum.photos')) return 'Lorem Picsum';
  return 'External';
};

// Utility function to detect video URLs
const isVideoUrl = (url: string): boolean => {
  const videoHosts = [
    'youtube.com',
    'youtu.be',
    'vimeo.com',
    'dailymotion.com',
    'dai.ly',
    'twitch.tv',
    'vimeo.com'
  ];
  
  return videoHosts.some(host => url.includes(host));
};

// Utility function to extract YouTube video ID and convert to embed URL
const getYouTubeEmbedUrl = (url: string): string | null => {
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
  }
  
  return null;
};

// Utility function to get Vimeo video ID and convert to embed URL
const getVimeoEmbedUrl = (url: string): string | null => {
  const match = url.match(/(?:vimeo\.com\/)(\d+)/);
  if (match && match[1]) {
    return `https://player.vimeo.com/video/${match[1]}`;
  }
  return null;
};

// Utility function to get video embed URL
const getVideoEmbedUrl = (url: string): string | null => {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return getYouTubeEmbedUrl(url);
  }
  if (url.includes('vimeo.com')) {
    return getVimeoEmbedUrl(url);
  }
  return null;
};

const Markdown: React.FC<MarkdownProps> = ({ content, className, sources = [] }) => {
  // Memoize content processing to prevent unnecessary re-renders
  const cleanContent = useMemo(() => {
    let processedContent = content;

    // Process content to convert URL: lines to proper markdown links
    processedContent = processedContent.replace(/\* URL: (https?:\/\/[^\s]+)/g, '* [$1]($1)');

    // Process standalone URLs (not already in markdown format) - detect and convert to markdown images or links
    // This will automatically detect and convert various image URLs to markdown images
    // Video URLs will be converted to markdown links and handled by the link component
    const urlRegex = /(https?:\/\/[^\s\)]+)/g;
    let lastIndex = 0;
    const processedParts: string[] = [];
    
    let match;
    while ((match = urlRegex.exec(processedContent)) !== null) {
      const url = match[0];
      const matchIndex = match.index;
      
      // Add text before the URL
      if (matchIndex > lastIndex) {
        processedParts.push(processedContent.substring(lastIndex, matchIndex));
      }
      
      // Check if URL is already part of a markdown link or image
      const beforeUrl = processedContent.substring(Math.max(0, matchIndex - 50), matchIndex);
      const isInMarkdown = beforeUrl.includes('](') || beforeUrl.includes('![');
      
      if (!isInMarkdown) {
        if (isImageUrl(url)) {
          const sourceType = getImageSourceType(url);
          const altText = sourceType === 'Replicate' ? 'Generated Image' : 'Image';
          processedParts.push(`![${altText}](${url})`);
        } else if (isVideoUrl(url)) {
          processedParts.push(`[${url}](${url})`);
        } else {
          processedParts.push(url);
        }
      } else {
        processedParts.push(url);
      }
      
      lastIndex = matchIndex + url.length;
    }
    
    // Add remaining text
    if (lastIndex < processedContent.length) {
      processedParts.push(processedContent.substring(lastIndex));
    }
    
    processedContent = processedParts.join('');

    // Remove standalone double asterisks
    processedContent = processedContent.replace(/^\*\*$/gm, '');

    // Remove empty lines that might be left after removing **
    processedContent = processedContent.replace(/\n\s*\n\s*\n/g, '\n\n');

    return processedContent;
  }, [content]);

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Custom link component with Shadcn typography and text-primary styling
          // Also handles video URLs by converting them to embeds
          a({ href, children, ...props }) {
            // Check if this is a video URL
            if (href && isVideoUrl(href)) {
              const embedUrl = getVideoEmbedUrl(href);
              if (embedUrl) {
                return (
                  <div className="my-6">
                    <div className="relative w-full aspect-video rounded-lg border overflow-hidden bg-muted/50">
                      <iframe
                        src={embedUrl}
                        title={typeof children === 'string' ? children : 'Video'}
                        className="absolute inset-0 w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                      />
                    </div>
                    {typeof children === 'string' && children !== href && (
                      <p className="text-sm text-muted-foreground mt-2 text-center">
                        {children}
                      </p>
                    )}
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:text-primary/80 underline underline-offset-2 transition-colors mt-1 inline-block text-center w-full block"
                    >
                      Open in new tab
                    </a>
                  </div>
                );
              }
            }
            
            // Regular link
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
                className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mt-10 mb-6 first:mt-0 last:mb-6"
                {...props}
              >
                {children}
              </h1>
            );
          },
          h2({ children, ...props }) {
            return (
              <h2
                className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight mt-8 mb-4 first:mt-0 last:mb-5"
                {...props}
              >
                {children}
              </h2>
            );
          },
          h3({ children, ...props }) {
            return (
              <h3
                className="scroll-m-20 text-xl font-semibold tracking-tight mt-5 mb-2 first:mt-0 last:mb-3 text-primary"
                {...props}
              >
                {children}
              </h3>
            );
          },
          h4({ children, ...props }) {
            return (
              <h4
                className="scroll-m-20 text-xl font-semibold tracking-tight mt-5 mb-2 first:mt-0 last:mb-3"
                {...props}
              >
                {children}
              </h4>
            );
          },
          // Custom paragraph with proper spacing
          p({ children, ...props }) {
            return (
              <p
                className="leading-7 break-words [&:not(:first-child)]:mt-5 mb-4 last:mb-0"
                {...props}
              >
                {children}
              </p>
            );
          },
          // Custom list styling
          ul({ children, ...props }) {
            return (
              <ul className="my-5 ml-6 list-disc space-y-2" {...props}>
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol className="my-5 ml-6 list-decimal space-y-2" {...props}>
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
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";

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
              <blockquote className="mt-6 border-l-2 pl-6 italic break-words" {...props}>
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
                <table className="w-full border-collapse border border-border">
                  {children}
                </table>
              </div>
            );
          },
          th({ children, ...props }) {
            return (
              <th
                className="border border-border px-4 py-2 text-left font-bold bg-muted/50 [&[align=center]]:text-center [&[align=right]]:text-right break-words"
                {...props}
              >
                {children}
              </th>
            );
          },
          td({ children, ...props }) {
            return (
              <td
                className="border border-border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right break-words"
                {...props}
              >
                {children}
              </td>
            );
          },
          // Custom image component with enhanced typography and Replicate URL support
          img({ src, alt, ...props }) {
            // Check if this is an AI-generated image (base64 or has specific properties)
            if (typeof src === 'string' && (src.startsWith('data:image/') || src.includes('base64'))) {
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
            const isReplicateUrl = typeof src === 'string' && src.includes('replicate.delivery');
            const isGeneratedImage = alt?.toLowerCase().includes('generated') || isReplicateUrl;
            const sourceType = typeof src === 'string' ? getImageSourceType(src) : 'Unknown';

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
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'block';
                    }}
                    {...props}
                  />
                  {/* Fallback for broken images */}
                  <div 
                    className="hidden rounded-lg border bg-muted/50 p-8 text-center"
                    style={{ display: 'none' }}
                  >
                    <p className="text-muted-foreground">Failed to load image</p>
                    <a 
                      href={typeof src === 'string' ? src : '#'} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 underline underline-offset-4 transition-colors text-sm mt-2 inline-block"
                    >
                      View original
                    </a>
                  </div>
                  
                  {/* Image overlay with source info */}
                  {(isGeneratedImage || sourceType !== 'External') && (
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
                      href={typeof src === 'string' ? src : '#'} 
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
                <Source
                  href={source.href}
                  key={index}
                  title={source.title}
                />
              ))}
            </SourcesContent>
          </Sources>
        </div>
      )}
    </div>
  );
};

export default Markdown;
