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
import { MarkdownStyles } from '@/components/Markdown';
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
    debugDatabaseCollections,
    // NEW: Import optimized functions
    initializeVoiceCoachSession,
    clearTeacherDataCache
} from '../app/(home)/teacher/voice-coach/action';

// Import RealtimeOpenAIService from the separate file
import { RealtimeOpenAIService } from '@/lib/realtimeOpenAI';

// Import the Video component instead of 3D model
import dynamic from 'next/dynamic';

// Comment out the 3D component
// const LipSyncTeacher3D = dynamic(() => import('./LipSyncTeacher3D'), { 
//     ssr: false,
//     loading: () => (
//         <div className="w-full h-[500px] flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl">
//             <div className="text-center">
//                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
//                 <p className="text-sm text-gray-600 dark:text-gray-400">Loading 3D Teacher...</p>
//             </div>
//         </div>
//     )
// });

// Import the new Video component
const VoiceCoachVideo = dynamic(() => import('./VoiceCoachVideo'), { 
    ssr: false,
    loading: () => (
        <div className="w-[200px] h-[500px] rounded-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Loading Video...</p>
            </div>
        </div>
    )
});

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

    // NEW: Video state instead of lip sync
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    // Add voice preference state
    const [selectedVoice, setSelectedVoice] = useState('alloy'); // Default to female voice

    // Get API key from environment or localStorage
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || (typeof window !== 'undefined' ? localStorage.getItem('openai_api_key') : '');

    // OPTIMIZED: Single state for all teacher data
    const [teacherData, setTeacherData] = useState({
        teacher: null,
        students: [],
        content: {
            lessons: [],
            assessments: [],
            presentations: [],
            comics: [],
            images: [],
            videos: [],
            websearches: []
        },
        achievements: [],
        stats: {}
    });
    const [dataLoading, setDataLoading] = useState(true);

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

    // OPTIMIZED: Single data fetch with caching
    useEffect(() => {
        const fetchOptimizedTeacherData = async () => {
            setDataLoading(true);
            try {
                // OPTIMIZED: Single call to get all data
                const result = await initializeVoiceCoachSession();
                
                if (result.success) {
                    setTeacherData(result.teacherData);
                    setSessionId(result.sessionId);
                    
                    // FIXED: Remove undefined setUser and setStudents calls
                    // The teacherData is already set above with all the data
                } else {
                    toast.error('Failed to load your teaching data');
                    // Set fallback data
                    setTeacherData({
                        teacher: {
                            _id: 'fallback_teacher_id',
                            email: 'teacher@example.com',
                            name: 'Teacher',
                            grades: ['Grade 8', 'Grade 9', 'Grade 10'],
                            subjects: ['Mathematics', 'Science', 'English']
                        },
                        students: [],
                        content: {
                            lessons: [],
                            assessments: [],
                            presentations: [],
                            comics: [],
                            images: [],
                            videos: [],
                            websearches: []
                        },
                        achievements: [],
                        stats: {}
                    });
                }
            } catch (error) {
                console.error('Error fetching teacher data:', error);
                toast.error('Failed to load your teaching data');
                
                // Set fallback data
                setTeacherData({
                    teacher: {
                        _id: 'fallback_teacher_id',
                        email: 'teacher@example.com',
                        name: 'Teacher',
                        grades: ['Grade 8', 'Grade 9', 'Grade 10'],
                        subjects: ['Mathematics', 'Science', 'English']
                    },
                    students: [],
                    content: {
                        lessons: [],
                        assessments: [],
                        presentations: [],
                        comics: [],
                        images: [],
                        videos: [],
                        websearches: []
                    },
                    achievements: [],
                    stats: {}
                });
            } finally {
                setDataLoading(false);
            }
        };

        fetchOptimizedTeacherData();
    }, []);

    // OPTIMIZED: Send message handler with cached data
    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading || !sessionId || !teacherData.teacher) return;

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
            
            // OPTIMIZED: No need to send student data - it's already cached in backend
            formData.append('studentData', JSON.stringify({}));
            
            // Pass the names of the uploaded files to the server action
            const fileNames = uploadedFiles.map(file => file.name);
            formData.append('uploadedFiles', JSON.stringify(fileNames));

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
            toast.error('Failed to send message. Please try again.');

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

    // OPTIMIZED: Voice functionality with cached data
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

            // Remove lip sync callback, keep speaking state for video
            // openAIServiceRef.current.onLipSyncData = (data) => {
            //     setLipSyncData(data);
            //     // Determine if currently speaking based on lip sync intensity
            //     const totalIntensity = Object.values(data).reduce((sum, val) => sum + val, 0);
            //     setIsSpeaking(totalIntensity > 0.1);
            // };

            // Add callback for when new response starts
            openAIServiceRef.current.onResponseStart = () => {
                setTranscript(''); // Reset transcript for new response
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
            openAIServiceRef.current.onResponseComplete = () => {
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

            // OPTIMIZED: Use cached teacher data
            const teacherDataForAI = {
                teacherName: teacherData.teacher?.name || 'Teacher',
                students: teacherData.students.slice(0, 5).map(student => ({
                    student_name: student.name,
                    student_id: student._id,
                    email: student.email,
                    grades: student.grades,
                    subjects: student.subjects,
                    performance: {
                        overall: student.performance?.overall || 0 // FIXED: Remove hardcoded 75, use 0 as fallback
                    }
                })),
                studentPerformance: {
                    totalStudents: teacherData.students.length,
                    averagePerformance: teacherData.stats.averageStudentPerformance || 0 // FIXED: Remove hardcoded 75, use 0 as fallback
                },
                learningAnalytics: {
                    totalLessons: teacherData.stats.totalLessons || 0,
                    totalAssessments: teacherData.stats.totalAssessments || 0,
                    averageStudentPerformance: teacherData.stats.averageStudentPerformance || 0 // FIXED: Remove hardcoded 75, use 0 as fallback
                }
            };

            // Connect with the selected voice
            await openAIServiceRef.current.connect(teacherDataForAI, 'teacher', selectedVoice);
            
            setIsConnected(true);
            setIsFirstLoad(false); // Trigger intro video
            setMessages(prev => [...prev, { 
                id: Date.now() + Math.random(),
                type: 'system', 
                content: `🎤 Voice connection established with ${selectedVoice} voice! Start speaking with your AI Voice Coach.` 
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
            setIsSpeaking(false);
            
            setMessages(prev => [...prev, { 
                id: Date.now() + Math.random(),
                type: 'system', 
                content: '🔌 Voice connection ended. It was a pleasure to help you today!' 
            }]);
            
        } catch (error) {
            setError(`Disconnect error: ${error.message}`);
        }
    };

    // File upload handler
    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0 || !sessionId || !teacherData.teacher) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            files.forEach(file => formData.append('files', file));
            formData.append('sessionId', sessionId);
            formData.append('studentData', JSON.stringify({
                id: teacherData.teacher._id,
                name: teacherData.teacher.name,
                email: teacherData.teacher.email,
                grades: teacherData.teacher.grades,
                subjects: teacherData.teacher.subjects,
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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-lg text-gray-600 dark:text-gray-400">Loading your teaching data...</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">This may take a moment</p>
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
                <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* NEW: Video Teacher Section */}
                    <div className="lg:col-span-1 flex items-center justify-center">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="w-full flex justify-center"
                        >
                            <Card className="bg-transparent backdrop-blur-sm border-0 shadow-none">
                                <CardContent className="p-4">
                                    <VoiceCoachVideo 
                                        isSpeaking={isSpeaking}
                                        isConnected={isConnected}
                                        onVoiceChange={(voice) => {
                                            console.log('Voice change requested:', voice);
                                            console.log('openAIServiceRef.current:', openAIServiceRef.current);
                                            
                                            // Store the voice preference
                                            setSelectedVoice(voice);
                                            
                                            // If already connected, change the voice immediately
                                            if (openAIServiceRef.current && isConnected) {
                                                console.log('Calling setVoice on service');
                                                openAIServiceRef.current.setVoice(voice);
                                            } else {
                                                console.log('Voice preference stored, will be applied on next connection');
                                            }
                                        }}
                                    />
                                </CardContent>

                                {/* Error Display */}
                                {error && (
                                    <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
                                        {error}
                                    </div>
                                )}
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
                            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg h-[600px] flex flex-col">
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
                                        
                                        {/* Connect Voice Button - Moved here between upload and send */}
                                        <Button 
                                            onClick={handleVoiceToggle}
                                            disabled={isLoading || isUploading}
                                            className={`${
                                                isConnected 
                                                    ? 'bg-red-500 hover:bg-red-600' 
                                                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                                            } text-white dark:text-white rounded-2xl px-6 py-3`}
                                            title={isConnected ? 'Disconnect Voice' : 'Connect Voice'}
                                        >
                                            {isLoading ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                            ) : isConnected ? (
                                                <MicOff className="w-4 h-4 mr-2" />
                                            ) : (
                                                <Mic className="w-4 h-4 mr-2" />
                                            )}
                                            {isConnected ? 'Disconnect' : 'Connect Voice'}
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