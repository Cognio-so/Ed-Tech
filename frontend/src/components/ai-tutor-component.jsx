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
    sendChatMessage, 
    uploadDocuments, 
    startVoiceSession, 
    stopVoiceSession,
    performWebSearch,
    getAiTutorHealth,
    createAiTutorSession,
    getStudentLearningInsights,
    saveAiTutorChatSession,
    getStudentProgressData,
    getStudentAchievementsData,
    getStudentLearningStats,
    getCurrentUserData
} from '../app/(home)/student/ai-tutor/action';
import { saveStudentConversation } from '../app/(home)/student/history/action';

// Add these imports for fetching real student data
import { getStudentProgress, getProgressStats } from '../app/(home)/student/my-learning/action';
import { getStudentAchievements, getAchievementStats } from '../app/(home)/student/achievements/action';

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
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [voiceWebSocket, setVoiceWebSocket] = useState(null);
    const [audioContext, setAudioContext] = useState(null);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [transcription, setTranscription] = useState('');
    const audioPlayerRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const hasErrorRef = useRef(false);
    const nextStartTimeRef = useRef(0);
    const audioBufferRef = useRef([]);
    const isPlayingRef = useRef(false);

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

    // Create refs for cleanup
    const voiceWebSocketRef = useRef(null);
    const audioContextRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    
    // Update refs when state changes
    useEffect(() => {
        voiceWebSocketRef.current = voiceWebSocket;
    }, [voiceWebSocket]);
    
    useEffect(() => {
        audioContextRef.current = audioContext;
    }, [audioContext]);
    
    useEffect(() => {
        mediaRecorderRef.current = mediaRecorder;
    }, [mediaRecorder]);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Clean up voice session on unmount
            if (voiceWebSocketRef.current && voiceWebSocketRef.current.readyState === WebSocket.OPEN) {
                try {
                    voiceWebSocketRef.current.send(JSON.stringify({ type: 'stop_session' }));
                    voiceWebSocketRef.current.close();
                } catch (error) {
                    console.error('Error cleaning up WebSocket:', error);
                }
            }
            
            // Clean up media stream
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
            }
            
            // Clean up audio context
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().catch(e => console.error('Error closing AudioContext:', e));
            }
            
            // Clean up media recorder
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

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

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const currentQuery = inputValue.trim();
        setInputValue('');
        
        // Declare streamingMessage at function level so it's accessible in catch block
        let streamingMessage = null;

        try {
            setIsLoading(true);

            // Add user message to chat
            const userMessage = {
                id: Date.now(),
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
                learning_stats: studentData.stats || {},
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

            const response = await fetch('http://localhost:8000/chatbot_endpoint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Backend error response:', errorText);
                throw new Error(`Backend error: ${response.status} - ${errorText}`);
            }

            // Create AI response object but don't add to messages yet
            streamingMessage = {
                id: Date.now() + 1,
                type: 'ai',
                content: '',
                timestamp: new Date(),
                avatar: <Sparkle className="w-4 h-4 text-yellow-500" />,
                isImageResponse: false
            };

            // Handle streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            let buffer = ''; // Buffer for incomplete JSON lines
            let isFirstChunk = true;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                
                // Split by lines and process each complete line
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.slice(6);
                            
                            // Check if this is an image response
                            if (jsonStr.includes('__IMAGE_RESPONSE__')) {
                                // Handle image response differently
                                streamingMessage.isImageResponse = true;
                                
                                // Extract the image content after the marker
                                const imageContent = jsonStr.replace('__IMAGE_RESPONSE__', '');
                                
                                // Try to parse the JSON properly
                                try {
                                    const data = JSON.parse(imageContent);
                                    if (data.content) {
                                        streamingMessage.content = data.content;
                                    } else {
                                        streamingMessage.content = imageContent;
                                    }
                                } catch (parseError) {
                                    // If JSON parsing fails, use the raw content
                                    streamingMessage.content = imageContent;
                                }
                                
                                // Add the response immediately
                                if (isFirstChunk) {
                                    setMessages(prev => [...prev, streamingMessage]);
                                    isFirstChunk = false;
                                } else {
                                    setMessages(prev => prev.map(msg => 
                                        msg.id === streamingMessage.id 
                                            ? { ...streamingMessage }
                                            : msg
                                    ));
                                }
                                continue;
                            }
                            
                            // Handle regular text chunks
                            const data = JSON.parse(jsonStr);
                            
                            if (data.type === 'text_chunk') {
                                if (isFirstChunk) {
                                    setMessages(prev => [...prev, streamingMessage]);
                                    isFirstChunk = false;
                                }
                                
                                streamingMessage.content += data.content || "";
                                setMessages(prev => prev.map(msg => 
                                    msg.id === streamingMessage.id 
                                        ? { ...streamingMessage }
                                        : msg
                                ));
                            } else if (data.type === 'done') {
                                // Mark streaming as complete
                                setMessages(prev => prev.map(msg => 
                                    msg.id === streamingMessage.id 
                                        ? { ...msg, isStreaming: false }
                                        : msg
                                ));
                                
                                // Save conversation to history after AI response is complete
                                setTimeout(() => {
                                    const allMessages = [...messages, userMessage, streamingMessage];
                                    saveConversationToHistory(allMessages, isVoiceActive ? 'mixed' : 'text');
                                }, 500);
                                
                                break;
                            } else if (data.type === 'error') {
                                throw new Error(data.message || "Unknown error from AI Tutor");
                            }
                        } catch (parseError) {
                            console.error('Error parsing SSE data:', parseError);
                            console.error('Problematic line:', line);
                            continue;
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error in chatbot stream:', error);
            // Remove the streaming message and add error message
            if (streamingMessage && streamingMessage.id) {
                setMessages(prev => prev.filter(msg => msg.id !== streamingMessage.id));
            }
            const errorMessage = {
                id: Date.now() + 1,
                type: 'ai',
                content: "I'm sorry, I encountered an error while processing your request. Please try again.",
                timestamp: new Date(),
                avatar: <Sparkle className="w-4 h-4 text-red-500" />
            };
            setMessages(prev => [...prev, errorMessage]);
            
            // Save conversation even if there was an error
            setTimeout(() => {
                const allMessages = [...messages, userMessage, errorMessage];
                saveConversationToHistory(allMessages, isVoiceActive ? 'mixed' : 'text');
            }, 500);
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
                    
                    // Add success message to chat
                    const uploadMessage = {
                        id: Date.now(),
                        type: 'ai',
                        content: `✅ Successfully uploaded ${files.length} document(s)! I can now help you with questions about these files.`,
                        timestamp: new Date(),
                        avatar: <Sparkle className="w-4 h-4 text-yellow-500" />
                    };
                    setMessages(prev => [...prev, uploadMessage]);
                    
                    toast.success(`Uploaded ${files.length} document(s) successfully!`);
                } else {
                    throw new Error(uploadResult.error);
                }
            } catch (error) {
                console.error('Upload error:', error);
                toast.error('Failed to upload documents. Please try again.');
                
                // Add error message to chat
                const errorMessage = {
                    id: Date.now(),
                    type: 'ai',
                    content: "❌ Failed to upload your documents. Please try again or contact support if the problem persists.",
                    timestamp: new Date(),
                    avatar: <Sparkle className="w-4 h-4 text-yellow-500" />
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
        
        // Add info message to chat
        const clearMessage = {
            id: Date.now(),
            type: 'ai',
            content: "🗑️ Cleared all uploaded documents. You can upload new ones anytime!",
            timestamp: new Date(),
            avatar: <Sparkle className="w-4 h-4 text-yellow-500" />
        };
        setMessages(prev => [...prev, clearMessage]);
    };

    // Real-time voice functionality
    const startVoiceSessionHandler = async () => {
        if (!user || !sessionId) {
            toast.error('Please wait for session to initialize');
            return;
        }
        
        if (isVoiceActive) {
            console.log('Voice session already active');
            return;
        }
        
        hasErrorRef.current = false;
        nextStartTimeRef.current = 0;
        
        try {
            // Prepare student context using action
            const studentContextFormData = new FormData();
            studentContextFormData.append('studentData', JSON.stringify({
                id: user._id,
                email: user.email,
                name: user.name || user.email,
                grade: user.grade || '8',
                progress: studentData.progress,
                learningStats: studentData.learningStats,
                userProgress: studentData.userProgress,
                achievements: studentData.achievements || [],
                subjects: user.subjects || ['General Studies', 'Mathematics', 'Science'],
                lessons: studentData.lessons || [],
                resources: studentData.resources || [],
                learningStyle: 'visual',
                difficultyPreference: 'medium',
                topicInterests: []
            }));

            const voiceSessionResult = await startVoiceSession(studentContextFormData);
            
            if (!voiceSessionResult.success) {
                throw new Error(voiceSessionResult.error);
            }

            // Initialize audio context
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            setAudioContext(audioCtx);
            
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
                console.log('Audio context resumed');
            }
            
            // Connect to voice WebSocket using the prepared context
            const ws = await PythonApi.startVoiceSession(voiceSessionResult.studentContext);
            
            ws.onopen = async () => {
                console.log('Voice WebSocket connected');
                setVoiceWebSocket(ws);
                setIsVoiceActive(true);

                ws.send(JSON.stringify({
                    type: 'start_session',
                    student_data: voiceSessionResult.studentContext
                }));
                
                console.log('Sending enhanced student context:', voiceSessionResult.studentContext);
                
                await startMicrophoneCapture(ws);
                toast.success('Real-time voice session started');
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleVoiceMessage(data);
            };
            
            ws.onerror = (error) => {
                console.error('Voice WebSocket error:', error);
                
                if (!hasErrorRef.current) {
                    hasErrorRef.current = true;
                    toast.error('Voice connection failed. Please try again.');
                }
                
                setVoiceWebSocket(null);
                setIsVoiceActive(false);
                setIsListening(false);
                stopMicrophoneCapture();
                
                if (audioCtx && audioCtx.state !== 'closed') {
                    audioCtx.close().catch(e => console.error('Error closing AudioContext:', e));
                }
                setAudioContext(null);
            };
            
            ws.onclose = (event) => {
                console.log('Voice WebSocket closed', event.code, event.reason);
                
                if (event.code !== 1000 && !hasErrorRef.current) {
                    hasErrorRef.current = true;
                    if (event.code === 1006) {
                        toast.error('Voice connection lost. Check your internet connection.');
                    }
                }
                
                setVoiceWebSocket(null);
                setIsVoiceActive(false);
                setIsListening(false);
                stopMicrophoneCapture();
                
                if (audioCtx && audioCtx.state !== 'closed') {
                    audioCtx.close().catch(e => console.error('Error closing AudioContext:', e));
                }
                setAudioContext(null);
            };
            
        } catch (error) {
            console.error('Failed to start voice session:', error);
            
            if (!hasErrorRef.current) {
                hasErrorRef.current = true;
                toast.error('Failed to start voice session. Please check your microphone permissions.');
            }
            
            setIsVoiceActive(false);
            setIsListening(false);
        }
    };

    // Start microphone capture and streaming
    const startMicrophoneCapture = async (ws) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 24000,
                    channelCount: 1
                } 
            });
            
            mediaStreamRef.current = stream;
            
            const audioCtx = audioContext || new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            const source = audioCtx.createMediaStreamSource(stream);
            
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            
            const bufferLength = analyser.fftSize;
            const dataArray = new Float32Array(bufferLength);
            
            source.connect(analyser);
            
            const processAudio = setInterval(() => {
                if (ws.readyState !== WebSocket.OPEN) {
                    clearInterval(processAudio);
                    return;
                }
                
                analyser.getFloatTimeDomainData(dataArray);
                
                const pcm16 = new Int16Array(dataArray.length);
                for (let i = 0; i < dataArray.length; i++) {
                    const s = Math.max(-1, Math.min(1, dataArray[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                
                const uint8Array = new Uint8Array(pcm16.buffer);
                let binary = '';
                for (let i = 0; i < uint8Array.length; i++) {
                    binary += String.fromCharCode(uint8Array[i]);
                }
                const base64Audio = btoa(binary);
                
                ws.send(JSON.stringify({
                    type: 'audio_chunk',
                    audio: base64Audio
                }));
            }, 100);
            
            mediaStreamRef.current.analyser = analyser;
            mediaStreamRef.current.source = source;
            mediaStreamRef.current.processInterval = processAudio;
            
            setIsListening(true);
            
        } catch (error) {
            console.error('Failed to start microphone:', error);
            
            if (!hasErrorRef.current) {
                hasErrorRef.current = true;
                
                if (error.name === 'NotAllowedError') {
                    toast.error('Microphone access denied. Please allow microphone permissions.');
                } else if (error.name === 'NotFoundError') {
                    toast.error('No microphone found. Please connect a microphone.');
                } else {
                    toast.error('Failed to access microphone. Please check your settings.');
                }
            }
            
            stopVoiceSession();
        }
    };
    
    // Stop microphone capture
    const stopMicrophoneCapture = () => {
        if (mediaRecorder) {
            mediaRecorder.stop();
            setMediaRecorder(null);
        }
        
        if (mediaStreamRef.current) {
            if (mediaStreamRef.current.processInterval) {
                clearInterval(mediaStreamRef.current.processInterval);
                mediaStreamRef.current.processInterval = null;
            }
            
            if (mediaStreamRef.current.analyser) {
                mediaStreamRef.current.analyser.disconnect();
                mediaStreamRef.current.analyser = null;
            }
            
            if (mediaStreamRef.current.source) {
                mediaStreamRef.current.source.disconnect();
                mediaStreamRef.current.source = null;
            }
            
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        
        setIsListening(false);
    };

    const stopVoiceSession = () => {
        if (voiceWebSocket && voiceWebSocket.readyState === WebSocket.OPEN) {
            try {
                voiceWebSocket.send(JSON.stringify({ type: 'stop_session' }));
                voiceWebSocket.close();
            } catch (error) {
                console.error('Error closing WebSocket:', error);
            }
        }
        setVoiceWebSocket(null);
        setIsVoiceActive(false);
        setIsListening(false);
        
        stopMicrophoneCapture();
        
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.suspend().then(() => {
                console.log('Audio context suspended');
            }).catch(error => {
                console.error('Error suspending AudioContext:', error);
            });
        }
    };

    const handleVoiceMessage = async (data) => {
        switch (data.type) {
            case 'session_started':
                toast.success('Ready for real-time conversation');
                setIsListening(true);
                nextStartTimeRef.current = 0;
                audioBufferRef.current = [];
                isPlayingRef.current = false;
                console.log('Audio streaming state reset for new session');
                break;
            case 'session.created':
                console.log('OpenAI session created');
                break;
            case 'response.audio.delta':
                const audioData = data.audio || data.delta;
                if (audioData) {
                    setTimeout(() => playAudioFromBase64(audioData), 0);
                } else {
                    console.warn('No audio data in response.audio.delta event');
                }
                break;
            case 'input_audio_buffer.speech_started':
                console.log('Speech detected');
                break;
            case 'input_audio_buffer.speech_stopped':
                console.log('Speech ended');
                break;
            case 'conversation.item.input_audio_transcription.completed':
                if (data.transcript) {
                    setTranscription(data.transcript);
                }
                break;
            case 'response.done':
            case 'response.completed':
                console.log('OpenAI response completed');
                break;
            case 'error':
                console.error('Voice session error:', data);
                
                if (!hasErrorRef.current) {
                    hasErrorRef.current = true;
                    
                    let errorMessage = 'Voice session encountered an error';
                    if (data.error?.message) {
                        errorMessage = data.error.message;
                    } else if (data.message) {
                        errorMessage = data.message;
                    }
                    
                    toast.error(errorMessage);
                }
                
                if (data.error?.type === 'invalid_request_error' || data.error?.code === 'invalid_value') {
                    console.warn('Recoverable error, continuing session...');
                } else {
                    stopVoiceSession();
                }
                break;
        }
    };

    const playAudioFromBase64 = async (base64Audio) => {
        let currentAudioContext = audioContext;
        if (!currentAudioContext || currentAudioContext.state === 'closed') {
            console.log('Creating audio context for playback');
            currentAudioContext = new (window.AudioContext || window.webkitAudioContext)({ 
                sampleRate: 24000,
                latencyHint: 'interactive'
            });
            setAudioContext(currentAudioContext);
            nextStartTimeRef.current = currentAudioContext.currentTime;
        }
        
        if (currentAudioContext.state === 'suspended') {
            await currentAudioContext.resume();
        }
        
        if (currentAudioContext.state === 'closed') {
            console.error('AudioContext is closed, cannot play audio');
            return;
        }
        
        try {
            if (!base64Audio || typeof base64Audio !== 'string') {
                console.warn('Invalid base64 audio data received');
                return;
            }
            
            let binaryString, bytes;
            try {
                binaryString = atob(base64Audio);
                bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
            } catch (decodeError) {
                console.error('Failed to decode base64 audio:', decodeError);
                return;
            }
            
            if (bytes.length < 960) {
                console.log('Audio chunk too small, skipping:', bytes.length);
                return;
            }
            
            const pcm16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(pcm16.length);
            let maxAmplitude = 0;
            
            for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 32768.0;
                maxAmplitude = Math.max(maxAmplitude, Math.abs(float32[i]));
            }
            
            if (maxAmplitude > 0.95) {
                const compressionRatio = 0.9 / maxAmplitude;
                for (let i = 0; i < float32.length; i++) {
                    float32[i] *= compressionRatio;
                }
                console.log('Applied audio compression, ratio:', compressionRatio);
            }
            
            if (float32.length === 0) {
                console.warn('Empty audio data, skipping');
                return;
            }
            
            const audioBuffer = currentAudioContext.createBuffer(1, float32.length, 24000);
            audioBuffer.getChannelData(0).set(float32);
            
            audioBufferRef.current.push({
                buffer: audioBuffer,
                timestamp: currentAudioContext.currentTime,
                duration: audioBuffer.duration,
                chunkId: Date.now(),
                size: bytes.length
            });
            
            if (audioBufferRef.current.length > 50) {
                const removedChunks = audioBufferRef.current.length - 25;
                audioBufferRef.current = audioBufferRef.current.slice(-25);
                console.log(`Audio buffer trimmed: removed ${removedChunks} chunks, buffer size: ${audioBufferRef.current.length}`);
            }
            
            if (!isPlayingRef.current) {
                processAudioStream(currentAudioContext);
            }
            
        } catch (error) {
            console.error('Failed to prepare audio:', error);
        }
    };

    const processAudioStream = (currentAudioContext) => {
        if (audioBufferRef.current.length === 0) {
            isPlayingRef.current = false;
            return;
        }
        
        isPlayingRef.current = true;
        
        const audioChunk = audioBufferRef.current.shift();
        
        if (currentAudioContext.state === 'closed') {
            console.error('AudioContext closed during playback');
            isPlayingRef.current = false;
            return;
        }
        
        let source;
        try {
            source = currentAudioContext.createBufferSource();
            source.buffer = audioChunk.buffer;
            
            const gainNode = currentAudioContext.createGain();
            source.connect(gainNode);
            gainNode.connect(currentAudioContext.destination);
            
            const now = currentAudioContext.currentTime;
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(1, now + 0.003);
            
        } catch (error) {
            console.error('Failed to create audio source:', error);
            setTimeout(() => processAudioStream(currentAudioContext), 10);
            return;
        }
        
        const now = currentAudioContext.currentTime;
        
        if (nextStartTimeRef.current === 0 || nextStartTimeRef.current > now + 0.5) {
            nextStartTimeRef.current = now + 0.01;
        }
        
        const scheduledStartTime = Math.max(now + 0.005, nextStartTimeRef.current);
        
        try {
            source.start(scheduledStartTime);
            nextStartTimeRef.current = scheduledStartTime + audioChunk.duration;
            
        } catch (startError) {
            console.error('Failed to start audio source:', startError);
            setTimeout(() => processAudioStream(currentAudioContext), 10);
            return;
        }
        
        source.onended = () => {
            processAudioStream(currentAudioContext);
        };
        
        source.onerror = (error) => {
            console.error('Audio source error:', error);
            setTimeout(() => processAudioStream(currentAudioContext), 10);
        };
    };

    const toggleVoiceRecording = async () => {
        if (!isVoiceActive) {
            if (!audioContext) {
                const newAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
                setAudioContext(newAudioContext);
                
                if (newAudioContext.state === 'suspended') {
                    await newAudioContext.resume();
                    console.log('Audio context resumed after user interaction');
                }
            }
            
            startVoiceSessionHandler();
        } else {
            stopVoiceSession();
        }
    };

    const performWebSearch = async (query) => {
        try {
            const response = await PythonApi.runWebSearch({
                topic: query,
                gradeLevel: user.grade || '8',
                subject: 'General',
                contentType: 'articles',
                language: 'English',
                comprehension: 'intermediate',
                maxResults: 3
            });
            return response.content;
        } catch (error) {
            console.error('Web search failed:', error);
            return 'Web search failed';
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
            <ul className="list-disc list-inside mb-2 space-y-1" {...props} />
        ),
        ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />
        ),
        li: ({ node, ...props }) => <li {...props} />,
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
        img: ({ node, ...props }) => (
            <div className="my-4 flex justify-center">
                <img 
                    {...props} 
                    className="max-w-full h-auto rounded-lg shadow-lg border border-gray-200 dark:border-gray-600"
                    style={{ maxHeight: '400px' }}
                    onError={(e) => {
                        console.error('Image failed to load:', e.target.src);
                        e.target.style.display = 'none';
                    }}
                />
            </div>
        ),
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

    // Update the renderMessageContent function
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
            <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg text-gray-600 dark:text-gray-400">Loading your learning data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900">
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
                <div className="w-full">
                    {/* Main Chat Area */}
                    <div className="w-full">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
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
                                        {/* FIXED: Proper scroll target */}
                                        <div ref={messagesEndRef} className="h-4" />
                                    </ScrollArea>
                                </div>

                                {/* Input Area - FIXED AT BOTTOM */}
                                <div className="p-2 flex-shrink-0">
                                    <div className="flex items-end space-x-3 w-full border-gray-200 dark:border-gray-700">
                                        <div className="flex-1">
                                            <Input
                                                value={inputValue}
                                                onChange={(e) => setInputValue(e.target.value)}
                                                onKeyPress={handleKeyPress}
                                                placeholder="Ask me anything about your homework..."
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
                                        
                                        {/* NEW: Clear files button */}
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
                                        onClick={startVoiceSessionHandler}
                                        disabled={isLoading || isUploading}
                                        size="icon" 
                                        className={`rounded-2xl px-6 py-3 ${
                                            isVoiceActive 
                                                ? 'bg-red-500 hover:bg-red-600' 
                                                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                                        } text-white dark:text-white`}
                                        title={isVoiceActive ? 'Stop voice session' : 'Start real-time voice session'}
                                    >
                                        {isVoiceActive ? (
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
            {isVoiceActive && (
    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                <span className="text-sm text-blue-700 dark:text-blue-300">
                    Voice {isListening ? 'Listening' : 'Active'}
                </span>
            </div>
            <Button
                onClick={stopVoiceSession}
                size="sm"
                variant="outline"
                className="text-xs"
            >
                Stop Voice
            </Button>
        </div>
        {transcription && (
            <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded border">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>You said:</strong> {transcription}
                </p>
            </div>
        )}
    </div>
)}
        </div>
    );
};

export default AiTutor;