"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Image from 'next/image';
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
    MicOff,
    GraduationCap,
    BookOpen,
    Users,
    TrendingUp
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { MarkdownStyles } from '@/components/Markdown'; // FIXED: Import the proper MarkdownStyles
import { 
    sendVoiceCoachMessage, 
    uploadDocumentsToVoiceCoach, 
    startVoiceCoachSession, 
    stopVoiceCoachSession,
    performVoiceCoachWebSearch,
    getVoiceCoachHealth,
    createVoiceCoachSession,
    getTeacherLearningInsights,
    saveVoiceCoachChatSession,
    getTeacherProgressData,
    getTeacherAchievementsData,
    getTeacherLearningStats,
    getCurrentTeacherData,
    getStudentsForTeacher,
    debugDatabaseCollections
} from '../app/(home)/teacher/voice-coach/action';

// Import RealtimeOpenAIService from the separate file
import { RealtimeOpenAIService } from '@/lib/realtimeOpenAI';

const VoiceCoach = () => {
    const [messages, setMessages] = useState([
        {
            id: 1,
            type: 'ai',
            content: "Hello! 👋 I'm your Voice Coach! I'm here to help you improve your teaching methods, classroom management, and student engagement. What teaching challenge would you like to work on today?",
            timestamp: new Date(),
            avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const messagesEndRef = useRef(null);
    const scrollAreaRef = useRef(null);
    
    // Voice state using RealtimeOpenAIService
    const [isConnected, setIsConnected] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState('');
    const openAIServiceRef = useRef(null);

    // Get API key from environment or localStorage
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || (typeof window !== 'undefined' ? localStorage.getItem('openai_api_key') : '');

    // Teacher data state
    const [user, setUser] = useState(null);
    const [teacherData, setTeacherData] = useState({
        lessons: [],
        resources: [],
        progress: [],
        achievements: [],
        learningStats: {},
        userProgress: []
    });
    const [dataLoading, setDataLoading] = useState(true);

    // Add real student data state
    const [students, setStudents] = useState([]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // API key validation and cleanup
    useEffect(() => {
        if (!apiKey) {
            setError('❌ OpenAI API key required. Set NEXT_PUBLIC_OPENAI_API_KEY or add to localStorage.');
        }

        return () => {
            if (openAIServiceRef.current) {
                openAIServiceRef.current.disconnect();
            }
        };
    }, [apiKey]);

    // Handle transcript updates - automatically add to messages
    useEffect(() => {
        if (transcript !== undefined && transcript !== '') {
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                
                // Only create new message if there's no existing live AI message
                if (!lastMessage || lastMessage.type !== 'ai' || !lastMessage.isLive) {
                    // Add new live message
                    newMessages.push({ 
                        id: Date.now() + Math.random(),
                        type: 'ai', 
                        content: transcript, 
                        isLive: true,
                        timestamp: new Date(),
                        avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
                    });
                } else {
                    // Update existing live message
                    newMessages[newMessages.length - 1] = { 
                        ...lastMessage, 
                        content: transcript,
                        id: lastMessage.id // Keep the same ID
                    };
                }
                
                return newMessages;
            });
        }
    }, [transcript]);

    // Fetch teacher data and real student data
    useEffect(() => {
        const fetchTeacherData = async () => {
            setDataLoading(true);
            try {
                const debugResult = await debugDatabaseCollections();

                const [userResult, progressResult, achievementsResult, statsResult, studentsResult] = await Promise.all([
                    getCurrentTeacherData(),
                    getTeacherProgressData(),
                    getTeacherAchievementsData(),
                    getTeacherLearningStats(),
                    getStudentsForTeacher()
                ]);

                if (userResult.success) {
                    setUser({
                        _id: userResult.data._id,
                        email: userResult.data.email,
                        name: userResult.data.name || userResult.data.email,
                        grades: userResult.data.grades || ['Grade 8', 'Grade 9', 'Grade 10'],
                        subjects: userResult.data.subjects || ['Mathematics', 'Science', 'English']
                    });
                } else {
                    setUser({
                        _id: 'fallback_teacher_id',
                        email: 'teacher@example.com',
                        name: 'Teacher',
                        grades: ['Grade 8', 'Grade 9', 'Grade 10'],
                        subjects: ['Mathematics', 'Science', 'English']
                    });
                }

                if (studentsResult.success) {
                    setStudents(studentsResult.data);
                }

                setTeacherData({
                    lessons: progressResult.success ? progressResult.data.filter(item => item.contentType === 'lesson') : [],
                    resources: progressResult.success ? progressResult.data : [],
                    progress: progressResult.success ? progressResult.data : [],
                    achievements: achievementsResult.success ? achievementsResult.data : [],
                    learningStats: statsResult.success ? statsResult.data : {},
                    userProgress: progressResult.success ? progressResult.data : []
                });

                if (debugResult.success) {
                    toast.info(`Database: ${debugResult.data.userCounts.students} students, ${debugResult.data.teacherContentCounts.contents} contents`);
                }

            } catch (error) {
                toast.error('Failed to load your teaching data');
                
                setUser({
                    _id: 'fallback_teacher_id',
                    email: 'teacher@example.com',
                    name: 'Teacher',
                    grades: ['Grade 8', 'Grade 9', 'Grade 10'],
                    subjects: ['Mathematics', 'Science', 'English']
                });
            } finally {
                setDataLoading(false);
            }
        };

        fetchTeacherData();
    }, []);

    // Initialize session when user data is loaded
    useEffect(() => {
        if (user && !dataLoading) {
            const initializeSession = async () => {
                try {
                    const sessionFormData = new FormData();
                    sessionFormData.append('userId', user._id);
                    sessionFormData.append('teacherData', JSON.stringify({
                        grades: user.grades,
                        subjects: user.subjects,
                        recentActivities: teacherData.progress.slice(0, 5),
                        teachingExperience: 'intermediate'
                    }));

                    const sessionResult = await createVoiceCoachSession(sessionFormData);
                    
                    if (sessionResult.success) {
                        setSessionId(sessionResult.sessionId);
                    } else {
                        toast.error('Failed to initialize session');
                    }
                } catch (error) {
                    toast.error('Failed to initialize session');
                }
            };

            initializeSession();
        }
    }, [user, dataLoading, teacherData]);

    // Save conversation to history
    const saveConversationToHistory = async (allMessages, sessionType) => {
        try {
            const cleanMessages = allMessages.map(message => ({
                id: message.id,
                type: message.type,
                content: message.content,
                timestamp: message.timestamp?.toISOString() || new Date().toISOString()
            }));

            const formData = new FormData();
            formData.append('sessionId', sessionId || 'temp_session');
            formData.append('messages', JSON.stringify(cleanMessages));
            formData.append('sessionType', sessionType);

            await saveVoiceCoachChatSession(formData);
        } catch (error) {
            console.error('Failed to save conversation:', error);
        }
    };

    // Send message handler - OPTIMIZED FOR MINIMAL DATA
    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading || !sessionId || !user) return;

        const userMessage = {
            id: Date.now(),
            type: 'user',
            content: inputValue,
            timestamp: new Date(),
            avatar: <User className="w-4 h-4 text-blue-500" />
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('message', inputValue);
            formData.append('sessionId', sessionId);
            
            // OPTIMIZED: Create minimal student data - only essential fields
            const minimalStudentData = {
                teacher_name: user.name,
                teacher_id: user._id,
                teacherName: user.name,
                teacherId: user._id,
                
                // OPTIMIZED: Only send essential student data - limit to 10 students max (CONSISTENT WITH BACKEND)
                students: students.slice(0, 10).map(student => ({
                    name: student.name,
                    _id: student._id,
                    email: student.email,
                    grades: student.grades || [],
                    subjects: student.subjects || [],
                    performance: {
                        overall: student.performance?.overall || 75
                    }
                })),
                
                // OPTIMIZED: Only send summary data
                studentOverview: {
                    totalStudents: students.length,
                    averageProgress: students.length > 0 ? 
                        students.reduce((sum, s) => sum + (s.performance?.overall || 75), 0) / students.length : 75
                },
                
                // OPTIMIZED: Only send counts, not full data
                media_counts: {
                    totalContent: (teacherData.learningStats?.totalContent || 0),
                    comics: (teacherData.learningStats?.totalComics || 0),
                    images: (teacherData.learningStats?.totalImages || 0),
                    slides: (teacherData.learningStats?.totalPresentations || 0),
                    videos: (teacherData.learningStats?.totalVideos || 0),
                    webSearch: (teacherData.learningStats?.totalWebSearches || 0)
                },
                
                // OPTIMIZED: Only send summary analytics
                learning_analytics: {
                    totalLessons: teacherData.lessons?.length || 0,
                    totalAssessments: teacherData.assessments?.length || 0,
                    averageStudentPerformance: students.length > 0 ? 
                        students.reduce((sum, s) => sum + (s.performance?.overall || 75), 0) / students.length : 75
                }
            };

            formData.append('studentData', JSON.stringify(minimalStudentData));

            const response = await sendVoiceCoachMessage(formData);

            if (response.success) {
                const aiMessage = {
                    id: Date.now() + 1,
                    type: 'ai',
                    content: response.response,
                    timestamp: new Date(),
                    avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
                };

                setMessages(prev => [...prev, aiMessage]);
            } else {
                const errorMessage = {
                    id: Date.now() + 1,
                    type: 'ai',
                    content: `Sorry, I encountered an error: ${response.error}`,
                    timestamp: new Date(),
                    avatar: <GraduationCap className="w-4 h-4 text-red-500" />
                };

                setMessages(prev => [...prev, errorMessage]);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage = {
                id: Date.now() + 1,
                type: 'ai',
                content: 'Sorry, I encountered an error while processing your message. Please try again.',
                timestamp: new Date(),
                avatar: <GraduationCap className="w-4 h-4 text-red-500" />
            };

            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle key press
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Clear chat
    const handleClearChat = () => {
        const clearMessage = {
            id: Date.now(),
            type: 'ai',
            content: "Chat cleared! How can I help you with your teaching today?",
            timestamp: new Date(),
            avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
        };
        setMessages([clearMessage]);
    };

    // Updated handleStart function
    const handleStart = async () => {
        if (!apiKey) {
            setError('❌ OpenAI API key required');
            return;
        }
        
        if (isLoading) return;
        
        setIsLoading(true);
        setError('');
        
        try {
            openAIServiceRef.current = new RealtimeOpenAIService(apiKey);

            // Add callback for when new response starts
            openAIServiceRef.current.onResponseStart = () => {
                setTranscript(''); // Reset transcript for new response
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
            openAIServiceRef.current.onResponseComplete = () => {
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

            openAIServiceRef.current.onTranscript = (delta) => {
                setTranscript(prev => prev + delta);
            };

            openAIServiceRef.current.onUserTranscript = (userTranscript) => {
                const userMessage = {
                    id: Date.now() + Math.random(),
                    type: 'user',
                    content: userTranscript,
                    timestamp: new Date(),
                    avatar: <User className="w-4 h-4 text-blue-500" />
                };
                
                setMessages(prev => [...prev, userMessage]);
            };

            // OPTIMIZED: Create minimal teacher data for voice AI - only essential fields
            const minimalTeacherDataForAI = {
                teacherName: user?.name || 'Teacher',
                
                // OPTIMIZED: Only send essential student data - limit to 10 students max (CONSISTENT WITH BACKEND)
                students: students.slice(0, 10).map(student => ({
                    student_name: student.name,
                    student_id: student._id,
                    email: student.email,
                    grades: student.grades || [],
                    subjects: student.subjects || [],
                    performance: {
                        overall: student.performance?.overall || 75
                    }
                })),
                
                // OPTIMIZED: Only send summary data
                studentPerformance: {
                    totalStudents: students.length,
                    averagePerformance: students.length > 0 ? 
                        students.reduce((sum, s) => sum + (s.performance?.overall || 75), 0) / students.length : 0
                },
                
                // OPTIMIZED: Only send summary analytics
                learningAnalytics: {
                    totalLessons: teacherData.lessons?.length || 0,
                    totalAssessments: teacherData.assessments?.length || 0,
                    averageStudentPerformance: students.length > 0 ? 
                        students.reduce((sum, s) => sum + (s.performance?.overall || 75), 0) / students.length : 0
                }
            };

            await openAIServiceRef.current.connect(minimalTeacherDataForAI);
            
            setIsConnected(true);
            setMessages(prev => [...prev, { 
                id: Date.now() + Math.random(),
                type: 'system', 
                content: `start speaking with AI Assistant` 
            }]);
            
        } catch (error) {
            setError(`Failed to connect: ${error.message}`);
            setMessages(prev => [...prev, { 
                id: Date.now() + Math.random(),
                type: 'error', 
                content: `❌ Connection failed: ${error.message}` 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Add the handleVoiceToggle function after handleDisconnect
    const handleVoiceToggle = async () => {
        if (isConnected) {
            handleDisconnect();
        } else {
            await handleStart();
        }
    };

    // Improve the handleDisconnect function
    const handleDisconnect = () => {
        try {
            if (openAIServiceRef.current) {
                openAIServiceRef.current.disconnect();
                openAIServiceRef.current = null;
            }
            
            setIsConnected(false);
            setTranscript('');
            setError('');
            setIsLoading(false);
            
            setMessages(prev => [...prev, { 
                id: Date.now() + Math.random(),
                type: 'system', 
                content: 'Its a pleasure to help you today' 
            }]);
            
        } catch (error) {
            setError(`Disconnect error: ${error.message}`);
        }
    };

    // File upload handler
    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0 || !sessionId || !user) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            files.forEach(file => formData.append('files', file));
            formData.append('sessionId', sessionId);
            formData.append('studentData', JSON.stringify({
                id: user._id,
                name: user.name,
                email: user.email,
                grades: user.grades,
                subjects: user.subjects,
                role: 'teacher'
            }));

            const response = await uploadDocumentsToVoiceCoach(formData);

            if (response.success) {
                setUploadedFiles(prev => [...prev, ...files]);
                toast.success(`Uploaded ${files.length} file(s) successfully`);
                
                const uploadMessage = {
                    id: Date.now() + Math.random(),
                    type: 'ai',
                    content: `I've received ${files.length} file(s). I can now help you analyze and discuss the content. What would you like to know about these documents?`,
                    timestamp: new Date(),
                    avatar: <File className="w-4 h-4 text-green-500" />
                };
                setMessages(prev => [...prev, uploadMessage]);
            } else {
                throw new Error(response.error || 'Upload failed');
            }
        } catch (error) {
            toast.error('Failed to upload files. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    // Clear uploaded files
    const handleClearFiles = () => {
        setUploadedFiles([]);
        toast.info('Cleared uploaded documents');
        
        const clearMessage = {
            id: Date.now() + Math.random(),
            type: 'ai',
            content: "🗑️ Cleared all uploaded documents. You can upload new ones anytime!",
            timestamp: new Date(),
            avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
        };
        setMessages(prev => [...prev, clearMessage]);
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
                const formData = new FormData();
                formData.append('sessionId', sessionId);
                files.forEach(file => {
                    formData.append('files', file);
                });

                const uploadResult = await uploadDocumentsToVoiceCoach(formData);
                
                if (uploadResult.success) {
                    setUploadedFiles(prev => [...prev, ...files]);
                    
                    const uploadMessage = {
                        id: Date.now() + Math.random(),
                        type: 'ai',
                        content: `✅ Successfully uploaded ${files.length} document(s)! I can now help you with questions about these files.`,
                        timestamp: new Date(),
                        avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
                    };
                    setMessages(prev => [...prev, uploadMessage]);
                    
                    toast.success(`Uploaded ${files.length} document(s) successfully!`);
                } else {
                    throw new Error(uploadResult.error);
                }
            } catch (error) {
                toast.error('Failed to upload documents. Please try again.');
                
                const errorMessage = {
                    id: Date.now() + Math.random(),
                    type: 'error',
                    content: "❌ Failed to upload your documents. Please try again or contact support if the problem persists.",
                    timestamp: new Date(),
                    avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
                };
                setMessages(prev => [...prev, errorMessage]);
            } finally {
                setIsUploading(false);
            }
        };
        fileInput.click();
    };

    // Enhanced image rendering component
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
        
        return (
            <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownStyles}>
                    {content}
                </ReactMarkdown>
            </div>
        );
    };

    // Update the renderMessageContent function to handle images properly
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

    if (dataLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-lg text-gray-600 dark:text-gray-400">Loading your teaching data...</p>
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
                                    <GraduationCap className="w-5 h-5 text-white" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                    Voice Coach
                                </h1>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Your personalized teaching companion
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
                <div className="w-full">
                    {/* Main Content Area - Full Width Chat */}
                    <div className="w-full">
                        {/* Chat Section */}
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
                                                                    : message.type === 'system'
                                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                                    : message.type === 'error'
                                                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
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
                                                                <GraduationCap className="w-4 h-4 text-blue-500" />
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
                                                placeholder="Ask me about teaching methods, classroom management, or student engagement..."
                                                className="border bg-gray-50 dark:bg-gray-700 border-purple-500 dark:border-purple-500 rounded-2xl px-6 py-6 w-full text-black dark:text-white"
                                                disabled={isLoading || isUploading}
                                            />
                                        </div>
                                       <div className="flex items-center space-x-2">
                                        <Button 
                                        onClick={handleUpload}
                                        disabled={isLoading || isUploading}
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
                                        
                                        {uploadedFiles.length > 0 && (
                                            <Button 
                                            onClick={handleClearFiles}
                                            disabled={isLoading || isUploading}
                                            size="icon" 
                                            variant="outline"
                                            className="rounded-2xl px-6 py-3"
                                            title="Clear uploaded files"
                                            >
                                                <File className="w-4 h-4" />
                                            </Button>
                                        )}
                                        
                                        <Button 
                                        onClick={handleVoiceToggle}
                                        disabled={isLoading || isUploading}
                                        size="icon" 
                                        className={`rounded-2xl px-6 py-3 ${
                                            isConnected 
                                                ? 'bg-red-500 hover:bg-red-600' 
                                                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                                        } text-white dark:text-white`}
                                        title={isConnected ? 'Disconnect from OpenAI' : 'Connect to OpenAI Realtime API'}
                                    >
                                        {isLoading ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : isConnected ? (
                                            <div className="w-4 h-4 bg-white rounded-full animate-pulse" />
                                        ) : (
                                            <AudioLines className="w-4 h-4" />
                                        )}
                                    </Button>
                                       <Button
                                            onClick={handleSendMessage}
                                            disabled={!inputValue.trim() || isLoading || isUploading}
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

export default VoiceCoach;