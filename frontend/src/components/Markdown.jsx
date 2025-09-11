"use client";

import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// Helpers to embed video links
function getYouTubeEmbed(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {}
  return null;
}

function getVimeoEmbed(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {}
  return null;
}

function isDirectVideo(url) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url || "");
}

export const MarkdownStyles = {
  // Headings (shadcn typography)
  h1: ({ node, ...props }) => (
    <h1
      className="scroll-m-20 text-4xl font-extrabold tracking-tight text-balance lg:text-5xl mt-6 first:mt-0"
      {...props}
    />
  ),
  h2: ({ node, ...props }) => (
    <h2
      className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 mt-10"
      {...props}
    />
  ),
  h3: ({ node, ...props }) => (
    <h3
      className="scroll-m-20 text-2xl font-semibold tracking-tight mt-8"
      {...props}
    />
  ),
  h4: ({ node, ...props }) => (
    <h4
      className="scroll-m-20 text-xl font-semibold tracking-tight mt-6"
      {...props}
    />
  ),
  h5: ({ node, ...props }) => (
    <h5 className="text-lg font-semibold tracking-tight mt-4" {...props} />
  ),
  h6: ({ node, ...props }) => (
    <h6 className="text-base font-semibold tracking-tight mt-3" {...props} />
  ),

  // Text
  p: ({ node, ...props }) => (
    <p className="leading-7 [&:not(:first-child)]:mt-6" {...props} />
  ),
  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
  em: ({ node, ...props }) => <em className="italic" {...props} />,
  hr: () => <hr className="my-6 border-muted" />,

  // Lists
  ul: ({ node, ...props }) => (
    <ul className="my-6 ml-6 list-disc [&>li]:mt-2" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="my-6 ml-6 list-decimal [&>li]:mt-2" {...props} />
  ),
  li: ({ node, ordered, ...props }) => <li {...props} />,

  // Blockquote
  blockquote: ({ node, ...props }) => (
    <blockquote className="mt-6 border-l-2 pl-6 italic text-muted-foreground" {...props} />
  ),

  // Links (with video detection)
  a: ({ node, href, children, ...props }) => {
    const yt = getYouTubeEmbed(href);
    if (yt) {
      return (
        <div className="my-4 aspect-video w-full overflow-hidden rounded-lg border">
          <iframe
            src={yt}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube embed"
          />
        </div>
      );
    }
    const vimeo = getVimeoEmbed(href);
    if (vimeo) {
      return (
        <div className="my-4 aspect-video w-full overflow-hidden rounded-lg border">
          <iframe
            src={vimeo}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="Vimeo embed"
          />
        </div>
      );
    }
    if (isDirectVideo(href)) {
      return (
        <div className="my-4 w-full overflow-hidden rounded-lg border">
          <video controls className="w-full h-auto">
            <source src={href} />
          </video>
        </div>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-primary font-medium underline underline-offset-4 break-words"
        {...props}
      >
        {children}
      </a>
    );
  },

  // Images
  img: ({ node, src, alt, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt || ""}
      className="my-4 rounded-lg border max-w-full h-auto"
      loading="lazy"
      {...props}
    />
  ),

  // Code blocks and inline code
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    if (!inline && match) {
      return (
        <SyntaxHighlighter
          style={atomDark}
          language={match[1]}
          PreTag="div"
          className="rounded-md my-4"
          {...props}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      );
    }
    return (
      <code
        className={`bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold ${className || ""}`}
        {...props}
      >
        {children}
      </code>
    );
  },

  // Tables (shadcn-style)
  table: ({ node, ...props }) => (
    <div className="my-6 w-full overflow-x-auto">
      <table className="w-full text-sm" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => <thead {...props} />,
  tbody: ({ node, ...props }) => <tbody {...props} />,
  tr: ({ node, ...props }) => <tr className="even:bg-muted m-0 border-t p-0" {...props} />,
  th: ({ node, ...props }) => (
    <th className="border px-4 py-2 text-left font-bold" {...props} />
  ),
  td: ({ node, align, ...props }) => (
    <td
      className="border px-4 py-2 text-left"
      align={align}
      {...props}
    />
  ),
};