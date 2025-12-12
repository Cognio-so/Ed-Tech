import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"] as const,
  style: ["normal", "italic"] as const,
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"] as const,
});

export const metadata: Metadata = {
  title: {
    default: "VidyaLabs - AI-Powered Personalized Learning for Every Student",
    template: "%s | VidyaLabs",
  },
  description:
    "VidyaLabs transforms education with AI-powered personalized learning. Give every student a personal tutor that speaks their language, adapts to their pace, and never gives up. Available 24/7 in 12+ regional languages.",
  keywords: [
    "AI education",
    "personalized learning",
    "EdTech India",
    "multilingual education",
    "AI tutor",
    "Swarika",
    "NCERT aligned",
    "adaptive learning",
    "education technology",
    "CSR education",
  ],
  authors: [{ name: "VidyaLabs", url: "https://vidyalabs.org" }],
  creator: "VidyaLabs",
  publisher: "Cognio Labs",
  metadataBase: new URL("https://vidyalabs.org"),
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "VidyaLabs",
    title: "VidyaLabs - AI-Powered Personalized Learning for Every Student",
    description:
      "Transform education with AI-powered personalized learning. Give every student a personal tutor that speaks their language and adapts to their pace.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VidyaLabs - AI-Powered Education Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VidyaLabs - AI-Powered Personalized Learning",
    description:
      "Give every student a personal AI tutor that speaks their language and adapts to their pace. Available 24/7 in 12+ regional languages.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${playfairDisplay.variable} ${inter.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
