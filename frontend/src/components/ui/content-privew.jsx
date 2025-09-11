"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Calendar, User, Tag, Eye, Download } from 'lucide-react';

const ContentPreview = ({ content, contentType }) => {
    if (!content) {
        return (
            <Card className="bg-white shadow-lg border-0">
                <CardContent className="pt-6">
                    <div className="text-center text-gray-500">
                        <p>No content to preview</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const renderWebSearchPreview = () => (
        <Card className="bg-white shadow-lg border-0">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                    <ExternalLink className="h-5 w-5 text-blue-600" />
                    Web Search Preview
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium">Title:</span>
                            <span className="text-sm text-gray-600">{content.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium">Topic:</span>
                            <span className="text-sm text-gray-600">{content.topic}</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium">Created:</span>
                            <span className="text-sm text-gray-600">
                                {new Date(content.metadata?.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium">Views:</span>
                            <span className="text-sm text-gray-600">{content.metadata?.viewCount || 0}</span>
                        </div>
                    </div>
                </div>

                {/* Tags */}
                {content.metadata?.tags && content.metadata.tags.length > 0 && (
                    <div>
                        <h4 className="font-medium text-gray-900 mb-2">Tags:</h4>
                        <div className="flex flex-wrap gap-2">
                            {content.metadata.tags.map((tag, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Search Query */}
                <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Search Query:</h4>
                    <p className="text-blue-800 text-sm">{content.searchQuery}</p>
                </div>

                {/* Search Results Summary */}
                <div>
                    <h4 className="font-semibold text-gray-900 mb-3">
                        Search Results ({content.searchResults?.length || 0} found):
                    </h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {content.searchResults?.map((result, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h5 className="font-medium text-gray-900 text-sm mb-1 line-clamp-1">
                                            {result.title}
                                        </h5>
                                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                                            {result.snippet}
                                        </p>
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                            <span><strong>Source:</strong> {result.source}</span>
                                            <span><strong>Relevance:</strong> {(result.relevanceScore * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                    {result.url !== '#' && (
                                        <a
                                            href={result.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ml-2 p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Status:</span>
                        <Badge 
                            variant={content.status === 'published' ? 'default' : 'secondary'}
                            className="text-xs"
                        >
                            {content.status}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Download className="h-4 w-4" />
                        <span>{content.metadata?.downloadCount || 0} downloads</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    const renderGenericPreview = () => (
        <Card className="bg-white shadow-lg border-0">
            <CardHeader>
                <CardTitle>Content Preview</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div>
                        <h4 className="font-medium text-gray-900 mb-2">Title:</h4>
                        <p className="text-gray-600">{content.title || 'No title'}</p>
                    </div>
                    
                    {content.topic && (
                        <div>
                            <h4 className="font-medium text-gray-900 mb-2">Topic:</h4>
                            <p className="text-gray-600">{content.topic}</p>
                        </div>
                    )}
                    
                    {content.metadata?.createdAt && (
                        <div>
                            <h4 className="font-medium text-gray-900 mb-2">Created:</h4>
                            <p className="text-gray-600">
                                {new Date(content.metadata.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    )}
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">Raw Content:</h4>
                        <pre className="text-xs text-gray-600 overflow-auto max-h-40">
                            {JSON.stringify(content, null, 2)}
                        </pre>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    // Render based on content type
    switch (contentType) {
        case 'web-search':
            return renderWebSearchPreview();
        default:
            return renderGenericPreview();
    }
};

export default ContentPreview;
