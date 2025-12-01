import { toast } from "sonner";

export type DownloadFormat = "word" | "markdown";

/**
 * Downloads content as a Word document (.doc)
 * Uses HTML format that Word can open natively
 */
export function downloadAsWord(content: string, title: string): void {
  // Convert markdown-like content to HTML for Word
  // Word can open HTML files with .doc extension
  const htmlContent = `
    <!DOCTYPE html>
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <meta name="ProgId" content="Word.Document">
        <meta name="Generator" content="Microsoft Word">
        <meta name="Originator" content="Microsoft Word">
        <title>${escapeHtml(title)}</title>
        <style>
          @page {
            size: 8.5in 11in;
            margin: 1in;
          }
          body {
            font-family: 'Calibri', 'Arial', sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #000000;
          }
          h1 {
            font-size: 18pt;
            font-weight: bold;
            margin-top: 12pt;
            margin-bottom: 6pt;
          }
          h2 {
            font-size: 16pt;
            font-weight: bold;
            margin-top: 10pt;
            margin-bottom: 5pt;
          }
          h3 {
            font-size: 14pt;
            font-weight: bold;
            margin-top: 8pt;
            margin-bottom: 4pt;
          }
          p {
            margin-top: 6pt;
            margin-bottom: 6pt;
          }
          ul, ol {
            margin-top: 6pt;
            margin-bottom: 6pt;
            padding-left: 30pt;
          }
          li {
            margin-top: 3pt;
            margin-bottom: 3pt;
          }
          code {
            font-family: 'Courier New', monospace;
            background-color: #f5f5f5;
            padding: 2pt 4pt;
          }
          pre {
            font-family: 'Courier New', monospace;
            background-color: #f5f5f5;
            padding: 8pt;
            border: 1pt solid #ddd;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        ${convertMarkdownToHtml(content)}
      </body>
    </html>
  `;

  const blob = new Blob([htmlContent], {
    type: "application/msword",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(title || "content")}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("Content downloaded as Word document");
}

/**
 * Downloads content as a Markdown file (.md)
 */
export function downloadAsMarkdown(content: string, title: string): void {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(title || "content")}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("Content downloaded as Markdown");
}

/**
 * Downloads content in the specified format
 */
export function downloadContent(
  content: string,
  title: string,
  format: DownloadFormat
): void {
  if (format === "word") {
    downloadAsWord(content, title);
  } else if (format === "markdown") {
    downloadAsMarkdown(content, title);
  }
}

/**
 * Helper function to escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Helper function to sanitize filename
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 100);
}

/**
 * Converts markdown-like content to HTML for Word document
 * This is a simple converter for basic markdown syntax
 */
function convertMarkdownToHtml(content: string): string {
  let html = content;

  // Convert headers
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // Convert bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");

  // Convert italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.*?)_/g, "<em>$1</em>");

  // Convert code blocks
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.replace(/```/g, "").trim();
    return `<pre>${escapeHtml(code)}</pre>`;
  });

  // Convert inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Convert unordered lists
  html = html.replace(/^\* (.*$)/gim, "<li>$1</li>");
  html = html.replace(/^- (.*$)/gim, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>(?:\s*<li>[\s\S]*?<\/li>)*)/g, "<ul>$1</ul>");

  // Convert ordered lists
  html = html.replace(/^\d+\. (.*$)/gim, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>(?:\s*<li>[\s\S]*?<\/li>)*)/g, "<ol>$1</ol>");

  // Convert line breaks to paragraphs
  html = html.split("\n\n").map((para) => {
    if (para.trim() && !para.match(/^<[h|u|o|l|p]/)) {
      return `<p>${para.trim()}</p>`;
    }
    return para;
  }).join("\n");

  // Convert single line breaks to <br>
  html = html.replace(/\n/g, "<br>");

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p><br><\/p>/g, "");

  return html;
}

