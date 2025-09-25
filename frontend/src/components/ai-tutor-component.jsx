"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Send,
    Bot,
    MessageCircle,
    Settings,
    Brain,
    Sparkle,
    Sparkles,
    User,
    AudioLines,
    File,
    UploadCloud,
    History,
    MessageCircle as MessageCircleIcon,
    Calendar,
    Clock,
    Search,
    Trash2,
    Edit3,
    Eye,
    Filter,
    MoreHorizontal,
    Bot as BotIcon,
    User as UserIcon,
    FileText,
    Mic,
    MicOff
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PythonApi from '@/lib/PythonApi';
import { toast } from 'sonner';
import { 
    uploadDocuments, 
    createAiTutorSession,
    getStudentProgressData,
    getStudentAchievementsData,
    getStudentLearningStats,
    getCurrentUserData
} from '../app/(home)/student/ai-tutor/action';
import { saveStudentConversation } from '../app/(home)/student/history/action';
import { RealtimeOpenAIService } from '@/lib/realtimeOpenAI';

// Import the 3D LipSyncTeacher component with SSR disabled
import dynamic from 'next/dynamic';

const LipSyncTeacher3D = dynamic(() => import('./LipSyncTeacher3D'), { 
    ssr: false,
    loading: () => (
        <div className="w-full h-[500px] flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading 3D Teacher...</p>
            </div>
        </div>
    )
});

const AiTutor = () => {
    const [messages, setMessages] = useState([
        {
            id: 1,
            type: 'ai',
            content: "Hi there! 👋 I'm your AI Tutor Buddy! I'm here to help you learn and understand your homework. What would you like to work on today?",
            timestamp: new Date(),
            avatar: <Sparkle className="w-4 h-4 text-yellow-500" />
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const messagesEndRef = useRef(null);
    const scrollAreaRef = useRef(null);
    
    // Updated voice session state for RealtimeOpenAI - matching voice-coach approach
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [realtimeService, setRealtimeService] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [transcription, setTranscription] = useState('');
    
    // NEW: Lip sync state - exactly like voice-coach
    const [lipSyncData, setLipSyncData] = useState({ A: 0, E: 0, I: 0, O: 0, U: 0 });
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Real student data state
    const [user, setUser] = useState(null);
    const [studentData, setStudentData] = useState({
        lessons: [],
        resources: [],
        progress: [],
        achievements: [],
        learningStats: {},
        userProgress: []
    });
    const [dataLoading, setDataLoading] = useState(true);

    // FIXED: Initialize audio context when component mounts
    useEffect(() => {
        const initAudioContext = async () => {
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                console.log('Audio context initialized');
            } catch (error) {
                console.error('Failed to initialize audio context:', error);
            }
        };

        initAudioContext();
    }, []);

    // FIXED: Improved autoscrolling with proper timing
    const scrollToBottom = () => {
        setTimeout(() => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
            }
        }, 100);
    };

    // FIXED: Scroll to bottom when messages change or loading state changes
    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    // FIXED: Handle transcript updates - exactly like voice-coach
    useEffect(() => {
        if (transcription) {
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                
                if (lastMessage && lastMessage.type === 'ai' && lastMessage.isLive) {
                    // Update existing live message
                    newMessages[newMessages.length - 1] = { 
                        ...lastMessage, 
                        content: transcription,
                        id: lastMessage.id // Keep the same ID
                    };
                } else {
                    // Add new live message
                    newMessages.push({ 
                        id: Date.now() + Math.random(),
                        type: 'ai', 
                        content: transcription, 
                        isLive: true,
                        timestamp: new Date(),
                        avatar: <Sparkle className="w-4 h-4 text-yellow-500" />
                    });
                }
                
                return newMessages;
            });
        }
    }, [transcription]);

    // Fetch real student data
    useEffect(() => {
        const fetchStudentData = async () => {
            setDataLoading(true);
            try {
                // Fetch all student data in parallel using the new action functions
                const [userResult, progressResult, achievementsResult, statsResult] = await Promise.all([
                    getCurrentUserData(),
                    getStudentProgressData(),
                    getStudentAchievementsData(),
                    getStudentLearningStats()
                ]);

                // Set user data from the API response
                if (userResult.success) {
                    setUser({
                        _id: userResult.data._id,
                        email: userResult.data.email,
                        name: userResult.data.name || userResult.data.email,
                        grade: userResult.data.grade || '8',
                        subjects: userResult.data.subjects || ['Mathematics', 'Science', 'English']
                    });
                } else {
                    // Fallback user data
                    setUser({
                        _id: 'fallback_user_id',
                        email: 'student@example.com',
                        name: 'Student',
                        grade: '8',
                        subjects: ['Mathematics', 'Science', 'English']
                    });
                }

                // Set student data from API responses
                setStudentData({
                    lessons: progressResult.success ? progressResult.data.filter(item => item.contentType === 'lesson') : [],
                    resources: progressResult.success ? progressResult.data : [],
                    progress: progressResult.success ? progressResult.data : [],
                    achievements: achievementsResult.success ? achievementsResult.data : [],
                    learningStats: statsResult.success ? statsResult.data : {},
                    userProgress: progressResult.success ? progressResult.data : []
                });

                console.log('Student data loaded:', {
                    user: userResult.success ? userResult.data.name : 'fallback',
                    progress: progressResult.success ? progressResult.data.length : 0,
                    achievements: achievementsResult.success ? achievementsResult.data.length : 0,
                    stats: statsResult.success ? statsResult.data : {}
                });

            } catch (error) {
                console.error('Failed to fetch student data:', error);
                toast.error('Failed to load your learning data');
                
                // Set fallback data
                setUser({
                    _id: 'fallback_user_id',
                    email: 'student@example.com',
                    name: 'Student',
                    grade: '8',
                    subjects: ['Mathematics', 'Science', 'English']
                });
            } finally {
                setDataLoading(false);
            }
        };

        fetchStudentData();
    }, []);

    // Initialize session when user data is loaded
    useEffect(() => {
        if (user && !dataLoading) {
            const initializeSession = async () => {
                try {
                    // Create session using action
                    const sessionFormData = new FormData();
                    sessionFormData.append('userId', user._id);
                    sessionFormData.append('studentData', JSON.stringify({
                        grade: user.grade,
                        subjects: user.subjects || [],
                        progress: studentData.progress,
                        achievements: studentData.achievements,
                        learningStats: studentData.learningStats
                    }));
                    
                    const sessionResult = await createAiTutorSession(sessionFormData);
                    if (sessionResult.success) {
                        setSessionId(sessionResult.sessionId);
                    }
                } catch (error) {
                    console.error('Failed to create session:', error);
                }
            };

            initializeSession();
        }
    }, [user, dataLoading, studentData]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Clean up RealtimeOpenAI service on unmount
            if (realtimeService) {
                realtimeService.disconnect();
            }
        };
    }, [realtimeService]);

    // Save conversation to history
    const saveConversationToHistory = async (messages, sessionType = 'text') => {
        try {
            const conversationData = {
                sessionId: sessionId,
                title: `AI Tutor Chat - ${new Date().toLocaleDateString()}`,
                sessionType: sessionType,
                messages: messages.map(msg => ({
                    id: msg.id.toString(),
                    role: msg.type === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                    timestamp: msg.timestamp,
                    isImageResponse: msg.isImageResponse || false,
                    metadata: {
                        messageType: msg.isImageResponse ? 'image' : 'text',
                        fileAttachments: [],
                        processingTime: 0
                    }
                })),
                uploadedFiles: uploadedFiles.map(file => ({
                    filename: file.name,
                    originalName: file.name,
                    fileType: file.type,
                    uploadTime: new Date()
                })),
                studentData: {
                    grade: user?.grade || '8',
                    subjects: user?.subjects || [],
                    progress: studentData.progress,
                    achievements: studentData.achievements,
                    learningStats: studentData.learningStats
                },
                conversationStats: {
                    totalMessages: messages.length,
                    userMessages: messages.filter(m => m.type === 'user').length,
                    aiMessages: messages.filter(m => m.type === 'ai').length,
                    totalDuration: 0,
                    topicsDiscussed: [],
                    difficultyLevel: 'medium',
                    learningOutcomes: []
                },
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lastMessageAt: new Date(),
                    isActive: true,
                    tags: []
                }
            };

            const formData = new FormData();
            formData.append('conversationData', JSON.stringify(conversationData));
            
            const result = await saveStudentConversation(formData);
            
            if (result.success) {
                console.log('Conversation saved to history');
            } else {
                console.error('Failed to save conversation:', result.error);
            }
        } catch (error) {
            console.error('Error saving conversation to history:', error);
        }
    };

    // Send message handler - FIXED to properly handle uploaded files AND images
    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const currentQuery = inputValue.trim();
        setInputValue('');
        
        // Declare streamingMessage at function level so it's accessible in catch block
        let streamingMessage = null;

        try {
            setIsLoading(true);

            // Add user message to chat - FIXED: Use unique key generation
            const userMessage = {
                id: Date.now() + Math.random(),
                type: 'user',
                content: currentQuery,
                timestamp: new Date(),
                avatar: <User className="w-4 h-4 text-blue-500" />
            };

            setMessages(prev => [...prev, userMessage]);

            // Prepare student data for AI tutor - match Python backend schema
            const enhancedStudentData = {
                id: user._id || 'fallback_user_id',
                email: user.email || 'student@example.com',
                name: user.name || 'Student',
                grade: user.grade || '8',
                progress: {
                    totalResources: studentData.progress?.length || 0,
                    completedResources: studentData.progress?.filter(p => p.status === 'completed').length || 0,
                    averageProgress: studentData.progress?.length > 0 ? 
                        (studentData.progress.filter(p => p.status === 'completed').length / studentData.progress.length) * 100 : 0,
                    totalStudyTime: studentData.progress?.reduce((sum, p) => sum + (p.progress?.timeSpent || 0), 0) || 0
                },
                achievements: studentData.achievements || [],
                learning_stats: studentData.learningStats || {},
                assessments: studentData.assessments || [],
                lessons: studentData.lessons || [],
                resources: studentData.resources || [],
                analytics: studentData.analytics || []
            };

            // Make direct fetch request to Python backend for streaming
            const payload = {
                session_id: sessionId,
                query: currentQuery,
                history: [...messages, userMessage].slice(1).map(msg => ({
                    role: msg.type === 'user' ? 'user' : 'assistant',
                    content: msg.content
                })),
                web_search_enabled: true,
                student_data: enhancedStudentData,
                uploaded_files: uploadedFiles.map(f => f.name) // Just file names, not objects
            };

            console.log('Sending payload to Python backend:', payload);

            const response = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/chatbot_endpoint`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Backend error: ${response.status} - ${errorText}`);
            }

            // Create AI message for streaming - FIXED: Use unique key generation
            streamingMessage = {
                id: Date.now() + Math.random(),
                type: 'ai',
                content: '',
                timestamp: new Date(),
                avatar: <Sparkle className="w-4 h-4 text-yellow-500" />,
                isStreaming: true,
                isImageResponse: false
            };

            setMessages(prev => [...prev, streamingMessage]);

            // Handle streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                buffer += chunk;
                
                // Split by lines and process each complete line
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.slice(6);
                            
                            // FIXED: Check if this is an image response - EXACTLY like voice-coach action
                            if (jsonStr.includes('__IMAGE_RESPONSE__')) {
                                const imageContent = jsonStr.replace('__IMAGE_RESPONSE__', '');
                                
                                try {
                                    const data = JSON.parse(imageContent);
                                    if (data.content) {
                                        // Update the streaming message with image content
                                        setMessages(prev => prev.map(msg => 
                                            msg.id === streamingMessage.id 
                                                ? { 
                                                    ...msg, 
                                                    content: data.content,
                                                    isImageResponse: true,
                                                    isStreaming: false
                                                }
                                                : msg
                                        ));
                                    } else {
                                        // Update with raw image content
                                        setMessages(prev => prev.map(msg => 
                                            msg.id === streamingMessage.id 
                                                ? { 
                                                    ...msg, 
                                                    content: imageContent,
                                                    isImageResponse: true,
                                                    isStreaming: false
                                                }
                                                : msg
                                        ));
                                    }
                                } catch (parseError) {
                                    // Update with raw image content if parsing fails
                                    setMessages(prev => prev.map(msg => 
                                        msg.id === streamingMessage.id 
                                            ? { 
                                                ...msg, 
                                                content: imageContent,
                                                isImageResponse: true,
                                                isStreaming: false
                                            }
                                            : msg
                                    ));
                                }
                                continue;
                            }
                            
                            // Handle regular text chunks
                            const data = JSON.parse(jsonStr);
                            
                            if (data.type === 'text_chunk' && data.content) {
                                setMessages(prev => prev.map(msg => 
                                    msg.id === streamingMessage.id 
                                        ? { 
                                            ...msg, 
                                            content: msg.content + data.content
                                        }
                                        : msg
                                ));
                            } else if (data.type === 'done') {
                                setMessages(prev => prev.map(msg => 
                                    msg.id === streamingMessage.id 
                                        ? { ...msg, isStreaming: false }
                                        : msg
                                ));
                                
                                // Save conversation to history asynchronously (don't block UI)
                                setTimeout(async () => {
                                    try {
                                        const updatedMessages = [...messages, userMessage, streamingMessage];
                                        await saveConversationToHistory(updatedMessages, 'text');
                                    } catch (error) {
                                        console.error('Failed to save conversation:', error);
                                    }
                                }, 0);
                            } else if (data.type === 'error') {
                                throw new Error(data.message || 'Unknown error');
                            }
                        } catch (parseError) {
                            console.warn('Failed to parse SSE data:', parseError);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Failed to send message. Please try again.');
            
            // Update streaming message with error
            if (streamingMessage) {
                setMessages(prev => prev.map(msg => 
                    msg.id === streamingMessage.id 
                        ? { 
                            ...msg, 
                            content: `❌ Error: ${error.message}`,
                            isStreaming: false 
                        }
                        : msg
                ));
            } else {
                // Add error message if no streaming message was created - FIXED: Use unique key generation
                const errorMessage = {
                    id: Date.now() + Math.random(),
                    type: 'ai',
                    content: `❌ Error: ${error.message}`,
                    timestamp: new Date(),
                    avatar: <Sparkle className="w-4 h-4 text-red-500" />
                };
                setMessages(prev => [...prev, errorMessage]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Enhanced file upload handler using action
    const handleUpload = () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.mp3,.mp4,.wav,.ogg,.webm,.zip,.rar,.7z,.tar,.gz,.bz2,.xlsx,.xls,.csv,.ppt,.pptx';
        fileInput.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            setIsUploading(true);
            try {
                // Use action to upload files
                const formData = new FormData();
                formData.append('sessionId', sessionId);
                files.forEach(file => {
                    formData.append('files', file);
                });

                const uploadResult = await uploadDocuments(formData);
                
                if (uploadResult.success) {
                    // Add files to local state
                    setUploadedFiles(prev => [...prev, ...files]);
                    
                    // Add success message to chat - FIXED: Use unique key generation
                    const uploadMessage = {
                        id: Date.now() + Math.random(),
                        type: 'ai',
                        content: `✅ Successfully uploaded ${files.length} document(s)! I can now help you with questions about these files.`,
                        timestamp: new Date(),
                        avatar: <Sparkle className="w-4 h-4 text-yellow-500" />
                    };
                    setMessages(prev => [...prev, uploadMessage]);
                    
                    toast.success(`Uploaded ${files.length} document(s) successfully!`);
                    
                    // Show warnings if any files were rejected
                    if (uploadResult.errors && uploadResult.errors.length > 0) {
                        toast.warning(`Some files were rejected: ${uploadResult.errors.join(', ')}`);
                    }
                } else {
                    throw new Error(uploadResult.error);
                }
            } catch (error) {
                console.error('Upload error:', error);
                toast.error('Failed to upload documents. Please try again.');
                
                // Add error message to chat - FIXED: Use unique key generation
                const errorMessage = {
                    id: Date.now() + Math.random(),
                    type: 'ai',
                    content: `❌ Failed to upload documents: ${error.message}`,
                    timestamp: new Date(),
                    avatar: <Sparkle className="w-4 h-4 text-red-500" />
                };
                setMessages(prev => [...prev, errorMessage]);
            } finally {
                setIsUploading(false);
            }
        };
        fileInput.click();
    };

    // Clear uploaded files
    const handleClearFiles = () => {
        setUploadedFiles([]);
        toast.info('Cleared uploaded documents');
        
        // Add info message to chat - FIXED: Use unique key generation
        const clearMessage = {
            id: Date.now() + Math.random(),
            type: 'ai',
            content: "🗑️ Cleared all uploaded documents. You can upload new ones anytime!",
            timestamp: new Date(),
            avatar: <Sparkle className="w-4 h-4 text-blue-500" />
        };
        setMessages(prev => [...prev, clearMessage]);
    };

    // UPDATED: Start voice session handler using RealtimeOpenAI (same approach as voice-coach)
    const startVoiceSessionHandler = async () => {
        if (isVoiceActive) {
            // Stop voice session
            try {
                if (realtimeService) {
                    realtimeService.disconnect();
                    setRealtimeService(null);
                }
            } catch (error) {
                console.error('Error disconnecting RealtimeOpenAI:', error);
            }
            setIsVoiceActive(false);
            setIsListening(false);
            setTranscription(''); // Reset transcription
            setIsSpeaking(false); // Reset speaking state
            setLipSyncData({ A: 0, E: 0, I: 0, O: 0, U: 0 }); // Reset lip sync data
            return;
        }

        try {
            setIsLoading(true);
            
            // Get comprehensive student data
            const studentDataResult = await getCurrentUserData();
            const progressResult = await getStudentProgressData();
            const achievementsResult = await getStudentAchievementsData();
            const statsResult = await getStudentLearningStats();
            
            if (!studentDataResult.success) {
                throw new Error("Failed to load student data");
            }

            const user = studentDataResult.data;
            const studentData = {
                progress: progressResult.success ? progressResult.data : [],
                achievements: achievementsResult.success ? achievementsResult.data : [],
                learningStats: statsResult.success ? statsResult.data : {},
                resources: [],
                lessons: [],
                userProgress: statsResult.success ? statsResult.data : {}
            };

            // Prepare comprehensive student data for RealtimeOpenAI
            const studentContext = {
                studentName: user.name || user.email,
                studentId: user._id,
                email: user.email,
                grade: user.grade || '8',
                subjects: user.subjects || ['Mathematics', 'Science', 'English'],
                role: 'student',
                
                // Learning progress data
                progress: {
                    totalResources: studentData.progress?.length || 0,
                    completedResources: studentData.progress?.filter(p => p.status === 'completed').length || 0,
                    averageProgress: studentData.progress?.length > 0 ? 
                        (studentData.progress.filter(p => p.status === 'completed').length / studentData.progress.length) * 100 : 0,
                    totalStudyTime: studentData.progress?.reduce((sum, p) => sum + (p.progress?.timeSpent || 0), 0) || 0
                },
                
                // Recent activities and performance
                recentActivities: studentData.progress.slice(0, 5),
                pending_tasks: studentData.progress.filter(p => p.status === 'pending').slice(0, 5),
                performance: studentData.learningStats || {},
                achievements: studentData.achievements || [],
                learningAnalytics: statsResult.success ? statsResult.data : {},
                
                // Learning preferences and context
                learningExperience: 'intermediate',
                topicInterests: user.subjects || [],
                currentChallenges: studentData.progress.filter(p => p.status === 'struggling').slice(0, 3),
                strengths: studentData.achievements.slice(0, 3),
                
                // Session context
                sessionId: sessionId,
                uploadedFiles: uploadedFiles.map(f => f.name),
                conversationHistory: messages.slice(-10) // Last 10 messages for context
            };

            // Initialize RealtimeOpenAI service
            const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
            if (!apiKey) {
                throw new Error('OpenAI API key not configured');
            }

            const service = new RealtimeOpenAIService(apiKey);
            
            // Set up event handlers - same approach as voice-coach
            service.onLipSyncData = (data) => {
                setLipSyncData(data);
                // Determine if currently speaking based on lip sync intensity
                const totalIntensity = Object.values(data).reduce((sum, val) => sum + val, 0);
                setIsSpeaking(totalIntensity > 0.1);
            };

            // Add callback for when new response starts
            service.onResponseStart = () => {
                setTranscription(''); // Reset transcript for new response
                setIsSpeaking(true); // Start speaking animation
                // Mark the last live message as complete
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage && lastMessage.type === 'ai' && lastMessage.isLive) {
                        newMessages[newMessages.length - 1] = {
                            ...lastMessage,
                            isLive: false // Mark as complete
                        };
                    }
                    return newMessages;
                });
            };

            // Add callback for when response is complete
            service.onResponseComplete = () => {
                setIsSpeaking(false); // Stop speaking animation
                // Mark the current live message as complete
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage && lastMessage.type === 'ai' && lastMessage.isLive) {
                        newMessages[newMessages.length - 1] = {
                            ...lastMessage,
                            isLive: false // Mark as complete
                        };
                    }
                    return newMessages;
                });
            };

            // Handle AI response transcripts - exactly like voice-coach
            service.onTranscript = (delta) => {
                setTranscription(prev => prev + delta);
            };

            // Handle user input transcripts - exactly like voice-coach
            service.onUserTranscript = (userTranscript) => {
                console.log('🎤 User said:', userTranscript);
                
                // Add user message to chat
                const userMessage = {
                    id: Date.now() + Math.random(),
                    type: 'user',
                    content: userTranscript,
                    timestamp: new Date(),
                    avatar: <User className="w-4 h-4 text-blue-500" />
                };
                
                setMessages(prev => [...prev, userMessage]);
            };

            // Connect to RealtimeOpenAI with student data and userType
            await service.connect(studentContext, 'student');
            
            setRealtimeService(service);
            setIsVoiceActive(true);
            setIsListening(true);
            
            // FIXED: Wait a bit before sending test message to ensure data channel is ready
            setTimeout(() => {
                if (service && service.dc && service.dc.readyState === 'open') {
                    service.sendTestMessage();
                } else {
                    console.warn('Data channel not ready, skipping test message');
                }
            }, 1000);
            
            toast.success('Voice session started! You can now speak with your AI tutor.');
            
        } catch (error) {
            console.error('Error starting voice session:', error);
            toast.error('Failed to start voice session. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Markdown styles for the chat messages
    const MarkdownStyles = {
        h1: ({ node, ...props }) => (
            <h1 className="text-lg font-bold mb-2" {...props} />
        ),
        h2: ({ node, ...props }) => (
            <h2 className="text-base font-semibold mb-2" {...props} />
        ),
        h3: ({ node, ...props }) => (
            <h3 className="text-sm font-semibold mb-1" {...props} />
        ),
        p: ({ node, ...props }) => (
            <p className="mb-2 last:mb-0" {...props} />
        ),
        ul: ({ node, ...props }) => (
            <ul 
                className="mb-2 space-y-1 ml-4" 
                style={{ listStyleType: 'disc', paddingLeft: '1rem' }}
                {...props} 
            />
        ),
        ol: ({ node, ...props }) => (
            <ol 
                className="mb-2 space-y-1 ml-4" 
                style={{ listStyleType: 'decimal', paddingLeft: '1rem' }}
                {...props} 
            />
        ),
        li: ({ node, ...props }) => (
            <li className="mb-1 leading-relaxed" style={{ display: 'list-item' }} {...props} />
        ),
        strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
        em: ({ node, ...props }) => <em className="italic" {...props} />,
        code: ({ node, inline, ...props }) => (
            inline ?
                <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm" {...props} /> :
                <code className="block bg-gray-200 dark:bg-gray-700 p-2 rounded text-sm overflow-x-auto" {...props} />
        ),
        pre: ({ node, ...props }) => (
            <pre className="bg-gray-200 dark:bg-gray-700 p-2 rounded text-sm overflow-x-auto mb-2" {...props} />
        ),
        blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic mb-2" {...props} />
        ),
        img: ({ node, src, alt, ...props }) => {
            if (!src || src.trim() === '') {
                console.warn('Empty image src detected, skipping render');
                return null;
            }
            
            return (
                <img 
                    src={src}
                    alt={alt || 'Generated image'}
                    className="max-w-full h-auto rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 my-4"
                    style={{ maxHeight: '400px' }}
                    onError={(e) => {
                        console.error('Image failed to load:', e.target.src);
                        e.target.style.display = 'none';
                    }}
                    onLoad={() => {
                        console.log('Image loaded successfully:', src);
                    }}
                    {...props}
                />
            );
        },
    };

    // Enhanced image rendering component - EXACTLY like voice-coach
    const ImageMessage = ({ content }) => {
        const imageMatch = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
        
        if (imageMatch) {
            const imageUrl = imageMatch[1];
            return (
                <div className="my-4 flex justify-center">
                    <img 
                        src={imageUrl}
                        alt="Generated image"
                        className="max-w-full h-auto rounded-lg shadow-lg border border-gray-200 dark:border-gray-600"
                        style={{ maxHeight: '400px' }}
                        onError={(e) => {
                            console.error('Image failed to load:', e.target.src);
                            e.target.style.display = 'none';
                        }}
                        onLoad={() => {
                            console.log('Image loaded successfully');
                        }}
                    />
                </div>
            );
        }
        
        // Fallback to markdown rendering
        return (
            <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownStyles}>
                    {content}
                </ReactMarkdown>
            </div>
        );
    };

    // Update the renderMessageContent function - EXACTLY like voice-coach
    const renderMessageContent = (message) => {
        if (message.isImageResponse) {
            return <ImageMessage content={message.content} />;
        } else {
            return (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownStyles}>
                        {message.content}
                    </ReactMarkdown>
                </div>
            );
        }
    };

    // For brevity, I'll include the essential parts of the render method
    if (dataLoading) {
        return (
            <div className="h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900 flex items-center justify-center overflow-hidden">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg text-gray-600 dark:text-gray-400">Loading your learning data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-purple-900/20 dark:via-blue-900/20 dark:to-indigo-900/20">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/90 backdrop-blur-md"
            >
                <div className="w-full px-2 py-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="relative">
                                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                                    <Sparkle className="w-5 h-5 text-white" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                    AI Tutor
                                </h1>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Your personalized learning companion
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            {uploadedFiles.length > 0 && (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                    📎 {uploadedFiles.length} file(s)
                                </Badge>
                            )}
                            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                                Online
                            </Badge>
                            <Button variant="ghost" size="icon">
                                <Settings className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className="w-full px-4 py-6">
                <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* NEW: 3D Teacher Lip Sync Section */}
                    <div className="lg:col-span-1">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="w-full"
                        >
                            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg ">
                                <CardContent className="p-0 m-0">
                                    <LipSyncTeacher3D 
                                        lipSyncData={lipSyncData}
                                        isConnected={isVoiceActive}
                                        isSpeaking={isSpeaking}
                                    />
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>

                    {/* Chat Section */}
                    <div className="lg:col-span-2">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="w-full"
                        >
                            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg h-[610px] flex flex-col">
                                {/* Messages Area */}
                                <div className="flex-1 overflow-hidden">
                                    <ScrollArea ref={scrollAreaRef} className="h-full w-full">
                                        <div className="p-4 space-y-2 min-h-full">
                                            <AnimatePresence>
                                                {messages.map((message) => (
                                                    <motion.div
                                                        key={message.id}
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -20 }}
                                                        className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                                                    >
                                                        <div className={`flex items-start space-x-3 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row space-x-3'}`}>
                                                            <Avatar className="w-8 h-8 flex-shrink-0">
                                                                <AvatarFallback className="text-lg">
                                                                    {message.avatar}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className={`rounded-2xl px-3 py-2 ${message.type === 'user'
                                                                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                                                    : 'text-black dark:text-white'
                                                                }`}>
                                                                {renderMessageContent(message)}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>

                                            {isLoading && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="flex justify-start"
                                                >
                                                    <div className="flex items-start space-x-3">
                                                        <Avatar className="w-8 h-8 flex-shrink-0">
                                                            <AvatarFallback className="text-lg">
                                                                <Sparkle className="w-4 h-4 text-yellow-500" />
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="text-black dark:text-white text-sm animate-pulse">
                                                            ⚪
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                        <div ref={messagesEndRef} className="h-4" />
                                    </ScrollArea>
                                </div>

                                {/* Input Area */}
                                <div className="p-2 flex-shrink-0">
                                    <div className="flex items-end space-x-3 w-full border-gray-200 dark:border-gray-700">
                                        <div className="flex-1">
                                            <Input
                                                value={inputValue}
                                                onChange={(e) => setInputValue(e.target.value)}
                                                onKeyPress={handleKeyPress}
                                                placeholder="Ask me anything about your homework..."
                                                className="border bg-gray-50 dark:bg-gray-700 border-purple-500 dark:border-purple-500 rounded-2xl px-6 py-6 w-full text-black dark:text-white"
                                                disabled={isLoading || isUploading || isVoiceActive}
                                            />
                                        </div>
                                       <div className="flex items-center space-x-2">
                                        <Button 
                                        onClick={handleUpload}
                                        disabled={isLoading || isUploading || isVoiceActive}
                                        size="icon" 
                                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-2xl px-6 py-3 text-white dark:text-white"
                                        title="Upload documents"
                                        >
                                            {isUploading ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <UploadCloud className="w-4 h-4" />
                                            )}
                                        </Button>
                                        
                                        {/* Connect Voice Button - Moved here between upload and send */}
                                        <Button 
                                            onClick={startVoiceSessionHandler}
                                            disabled={isLoading || isUploading}
                                            className={`${
                                                isVoiceActive 
                                                    ? 'bg-red-500 hover:bg-red-600' 
                                                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                                            } text-white dark:text-white rounded-2xl px-6 py-3`}
                                            title={isVoiceActive ? 'Disconnect Voice' : 'Connect Voice'}
                                        >
                                            {isLoading ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                            ) : isVoiceActive ? (
                                                <MicOff className="w-4 h-4 mr-2" />
                                            ) : (
                                                <Mic className="w-4 h-4 mr-2" />
                                            )}
                                            {isVoiceActive ? 'Disconnect' : 'Connect Voice'}
                                        </Button>
                                        
                                        {uploadedFiles.length > 0 && (
                                            <Button 
                                            onClick={handleClearFiles}
                                            disabled={isLoading || isUploading || isVoiceActive}
                                            size="icon" 
                                            variant="outline"
                                            className="rounded-2xl px-6 py-3"
                                            title="Clear uploaded files"
                                            >
                                                <File className="w-4 h-4" />
                                            </Button>
                                        )}
                                        
                                       <Button
                                            onClick={handleSendMessage}
                                            disabled={!inputValue.trim() || isLoading || isUploading || isVoiceActive}
                                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-2xl px-6 py-3 text-white dark:text-white"
                                        >
                                            <Send className="w-4 h-4" />
                                        </Button>
                                       </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiTutor;