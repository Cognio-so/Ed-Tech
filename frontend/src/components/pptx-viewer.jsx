"use client"

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  ExternalLink,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle,
  Save as SaveIcon,
  Eye,
  Play,
  Monitor,
  Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PPTXViewer = ({
  presentationUrl,
  downloadUrl,
  title,
  slideCount,
  status = 'SUCCESS',
  errorMessage,
  onSave,
  isSaving = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [currentViewerIndex, setCurrentViewerIndex] = useState(0);
  const [showDirectPreview, setShowDirectPreview] = useState(false);

  // Different viewer methods to try
  const viewerMethods = [
    {
      name: 'Google Docs Viewer',
      url: `https://docs.google.com/viewer?url=${encodeURIComponent(presentationUrl)}&embedded=true`,
      fallback: `https://docs.google.com/gview?url=${encodeURIComponent(presentationUrl)}&embedded=true`
    },
    {
      name: 'Office Online',
      url: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(presentationUrl)}`,
      fallback: null
    },
    {
      name: 'Direct Link',
      url: presentationUrl,
      fallback: null
    }
  ];

  useEffect(() => {
    if (presentationUrl) {
      setPreviewUrl(viewerMethods[0].url);
      setCurrentViewerIndex(0);
      setPreviewError(false);
      setIframeLoaded(false);
    }
  }, [presentationUrl]);

  const handlePreview = () => {
    if (presentationUrl) {
      // Try multiple viewer methods
      const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(presentationUrl)}`;
      window.open(viewerUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = async () => {
    if (!downloadUrl && !presentationUrl) return;

    setIsLoading(true);
    try {
      const url = downloadUrl || presentationUrl;

      if (url.includes('s3.') || url.includes('amazonaws.com') || url.includes('slidespeak')) {
        // For S3 or SlideSpeak URLs, create direct download link
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'presentation'}.pptx`;
        downloadLink.target = '_blank';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      } else {
        // For other URLs, try to fetch and download
        const response = await fetch(url);
        const blob = await response.blob();

        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = `${title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'presentation'}.pptx`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadLink.href);
      }
    } catch (error) {
      console.error('Download failed:', error);
      setPreviewError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIframeError = () => {
    console.log('Iframe failed, trying next viewer method...');
    const nextIndex = currentViewerIndex + 1;
    
    if (nextIndex < viewerMethods.length) {
      setCurrentViewerIndex(nextIndex);
      setPreviewUrl(viewerMethods[nextIndex].url);
      setIframeLoaded(false);
    } else {
      setPreviewError(true);
    }
  };

  const handleIframeLoad = () => {
    setIframeLoaded(true);
    setPreviewError(false);
  };

  const tryNextViewer = () => {
    const nextIndex = currentViewerIndex + 1;
    if (nextIndex < viewerMethods.length) {
      setCurrentViewerIndex(nextIndex);
      setPreviewUrl(viewerMethods[nextIndex].url);
      setIframeLoaded(false);
      setPreviewError(false);
    }
  };

  const openInNewTab = () => {
    if (presentationUrl) {
      window.open(presentationUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (status === 'FAILURE') {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">Generation Failed</p>
              <p className="text-sm text-red-500 dark:text-red-300">
                {errorMessage || 'An error occurred while generating the presentation'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'PENDING') {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-yellow-600 dark:text-yellow-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <div>
              <p className="font-medium">Generating Presentation...</p>
              <p className="text-sm text-yellow-500 dark:text-yellow-300">
                This may take a few minutes. Please wait.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Presentation Ready
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 dark:text-gray-300">
              Preview & Actions
            </h4>

            {/* Presentation Info */}
            <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Title:</span>
                <span className="text-sm text-gray-800 dark:text-gray-200">{title || 'Untitled Presentation'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Slides:</span>
                <span className="text-sm text-gray-800 dark:text-gray-200">{slideCount || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status:</span>
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">Ready</span>
              </div>
            </div>

            {/* Preview Section */}
            {presentationUrl && previewUrl && !previewError && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Preview ({viewerMethods[currentViewerIndex].name})
                  </span>
                  {currentViewerIndex < viewerMethods.length - 1 && (
                    <Button
                      onClick={tryNextViewer}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      Try Different Viewer
                    </Button>
                  )}
                </div>
                
                <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                  {!iframeLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Loading preview...</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Using {viewerMethods[currentViewerIndex].name}
                        </p>
                      </div>
                    </div>
                  )}
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-0"
                    onError={handleIframeError}
                    onLoad={handleIframeLoad}
                    title="Presentation Preview"
                    sandbox="allow-scripts allow-same-origin allow-popups"
                    style={{ display: iframeLoaded ? 'block' : 'none' }}
                  />
                </div>
              </div>
            )}

            {/* Fallback when preview fails */}
            {(previewError || !presentationUrl) && (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {presentationUrl
                    ? "Preview not available. Use the buttons below to download or open the presentation."
                    : "No presentation URL available."
                  }
                </p>
                {presentationUrl && (
                  <div className="text-xs text-gray-500 mb-4 p-3 bg-gray-200 dark:bg-gray-700 rounded">
                    <p className="font-medium mb-1">Direct URL:</p>
                    <p className="break-all">{presentationUrl}</p>
                  </div>
                )}
                {presentationUrl && (
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button
                      onClick={openInNewTab}
                      variant="outline"
                      size="sm"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Direct Link
                    </Button>
                    <Button
                      onClick={handlePreview}
                      variant="outline"
                      size="sm"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Try Google Viewer
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {onSave && (
              <Button
                onClick={onSave}
                disabled={isSaving}
                className="sm:flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <SaveIcon className="h-4 w-4 mr-2" />
                    Save to Library
                  </>
                )}
              </Button>
            )}

            {presentationUrl && (
              <Button
                onClick={openInNewTab}
                variant="outline"
                className="sm:flex-1 border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/20"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
            )}

            <Button
              onClick={handleDownload}
              disabled={isLoading || (!downloadUrl && !presentationUrl)}
              className="sm:flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download PPTX
                </>
              )}
            </Button>
          </div>

          {/* Additional Info */}
          {presentationUrl && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              <p>💡 Tip: If preview doesn't work, try downloading the file or opening it in a new tab</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PPTXViewer;