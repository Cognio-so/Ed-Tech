"use client"

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  ExternalLink,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle,
  Save as SaveIcon,
  Eye,
  Clock,
  User,
  Mic,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const VideoPreview = ({
  videoUrl,
  downloadUrl,
  title,
  slidesCount,
  status = 'completed',
  errorMessage,
  onSave,
  isSaving = false,
  voiceName,
  avatarName,
  videoId,
  onRetry
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handlePreview = () => {
    if (videoUrl) {
      window.open(videoUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = async () => {
    if (!downloadUrl && !videoUrl) return;

    setIsLoading(true);
    try {
      const url = downloadUrl || videoUrl;

      if (url.includes('s3.') || url.includes('amazonaws.com') || url.includes('heygen.com')) {
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'video'}.mp4`;
        downloadLink.target = '_blank';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      } else {
        const response = await fetch(url);
        const blob = await response.blob();

        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = `${title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'video'}.mp4`;
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

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setPreviewError(false);
    if (onRetry) {
      onRetry();
    }
  };

  if (status === 'failed') {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <div className="flex-1">
              <p className="font-medium">Generation Failed</p>
              <p className="text-sm text-red-500 dark:text-red-300">
                {errorMessage || 'An error occurred while generating the video'}
              </p>
            </div>
            {onRetry && (
              <Button
                onClick={handleRetry}
                variant="outline"
                size="sm"
                className="border-red-300 text-red-600 hover:bg-red-100"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'pending' || status === 'processing' || status === 'generating') {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-yellow-600 dark:text-yellow-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <div>
              <p className="font-medium">Generating Video...</p>
              <p className="text-sm text-yellow-500 dark:text-yellow-300">
                {status === 'processing' 
                  ? "Initializing video generation..." 
                  : "This may take several minutes. Please wait."}
              </p>
              {videoId && (
                <p className="text-xs text-yellow-400 mt-1">
                  Task ID: {videoId}
                </p>
              )}
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
      <Card className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Video Ready
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
              {title || 'Generated Video'}
            </h3>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Play className="h-4 w-4" />
                {slidesCount || 'Multiple'} slides
              </span>
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {avatarName || 'AI Avatar'}
              </span>
              <span className="flex items-center gap-1">
                <Mic className="h-4 w-4" />
                {voiceName || 'AI Voice'}
              </span>
            </div>
            {videoUrl && (
              <div className="mt-2 text-xs text-gray-500 break-all">
                <strong>URL:</strong> {videoUrl}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 dark:text-gray-300">
              Video Preview
            </h4>

            {videoUrl && !previewError ? (
              <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <video
                  src={videoUrl}
                  controls
                  className="w-full h-full"
                  poster=""
                  onError={() => setPreviewError(true)}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            ) : (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
                <Play className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {videoUrl
                    ? "Video preview not available. Use the buttons below to download or open the video."
                    : "No video URL available."
                  }
                </p>
                {videoUrl && (
                  <div className="text-xs text-gray-500 mb-4">
                    <p>Direct URL: {videoUrl}</p>
                  </div>
                )}
                {videoUrl && (
                  <div className="space-y-2">
                    <Button
                      onClick={handlePreview}
                      variant="outline"
                      size="sm"
                      className="mb-2"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Try Opening in Browser
                    </Button>
                    {previewError && (
                      <Button
                        onClick={handleRetry}
                        variant="outline"
                        size="sm"
                        className="ml-2"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry Preview
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

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

            {videoUrl && (
              <Button
                onClick={handlePreview}
                variant="outline"
                className="sm:flex-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Browser
              </Button>
            )}

            <Button
              onClick={handleDownload}
              disabled={isLoading || (!downloadUrl && !videoUrl)}
              className="sm:flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download MP4
                </>
              )}
            </Button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p>Generated with HeyGen AI • Professional video quality with talking avatars</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default VideoPreview;