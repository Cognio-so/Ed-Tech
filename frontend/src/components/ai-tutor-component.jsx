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
    const [audioStream, setAudioStream] = useState(null);
    const mediaStreamRef = useRef(null);
    const hasErrorRef = useRef(false);
    const nextStartTimeRef = useRef(0);
    const audioBufferRef = useRef([]);
    const isPlayingRef = useRef(false);
    const audioSourcesRef = useRef([]);
    const isStreamingRef = useRef(false);
    const streamStartTimeRef = useRef(0);
    const isRecordingRef = useRef(false);
    const audioQualityMetrics = useRef({
        chunksProcessed: 0,
        averageLatency: 0,
        dropouts: 0,
        bufferUnderruns: 0
    });

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
                setAudioContext(audioCtx);
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

    // Send message handler - FIXED to properly handle uploaded files
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

            // Create AI message for streaming
            streamingMessage = {
                id: Date.now() + 1,
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

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.type === 'text_chunk' && data.content) {
                                // Check for image response markers - EXACTLY like voice coach
                                let isImageResponse = false;
                                let messageContent = data.content;
                                
                                if (data.content && data.content.includes('__IMAGE_RESPONSE__')) {
                                    isImageResponse = true;
                                    messageContent = data.content.replace('__IMAGE_RESPONSE__', '');
                                } else if (data.content && data.content.includes('![image](')) {
                                    isImageResponse = true;
                                } else if (data.content && data.content.includes('data:image/')) {
                                    isImageResponse = true;
                                }

                                setMessages(prev => prev.map(msg => 
                                    msg.id === streamingMessage.id 
                                        ? { 
                                            ...msg, 
                                            content: msg.content + messageContent,
                                            isImageResponse: isImageResponse || msg.isImageResponse
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
                // Add error message if no streaming message was created
                const errorMessage = {
                    id: Date.now(),
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
                
                // Add error message to chat
                const errorMessage = {
                    id: Date.now(),
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
        
        // Add info message to chat
        const clearMessage = {
            id: Date.now(),
            type: 'ai',
            content: "🗑️ Cleared all uploaded documents. You can upload new ones anytime!",
            timestamp: new Date(),
            avatar: <Sparkle className="w-4 h-4 text-blue-500" />
        };
        setMessages(prev => [...prev, clearMessage]);
    };

    // Start voice session handler - WebSocket based with audio input
    const startVoiceSessionHandler = async () => {
        if (isVoiceActive) {
            // Stop voice session
            try {
                stopMicrophoneRecording();
                if (voiceWebSocket && voiceWebSocket.readyState === WebSocket.OPEN) {
                    voiceWebSocket.close();
                }
            } catch (error) {
                console.error('Error closing WebSocket:', error);
            }
            setVoiceWebSocket(null);
            setIsVoiceActive(false);
            setIsListening(false);
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

            // Prepare student context for voice session - EXACTLY like voice-coach
            const studentContext = {
                id: user._id,
                email: user.email,
                name: user.name || user.email,
                grade: user.grade || '8',
                subjects: user.subjects || [],
                role: 'student',
                recentActivities: studentData.progress.slice(0, 5),
                learningExperience: 'intermediate',
                topicInterests: user.subjects || [],
                studentName: user.name || user.email,
                pending_tasks: studentData.progress.filter(p => p.status === 'pending').slice(0, 5),
                performance: studentData.learningStats || {},
                achievements: studentData.achievements || [],
                learningAnalytics: statsResult.success ? statsResult.data : {}
            };

            // FIXED: Use direct WebSocket connection like voice-coach instead of PythonApi
            const ws = new WebSocket(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/ws/student-voice`);
            
            ws.onopen = () => {
                console.log('Student voice WebSocket connected');
                setVoiceWebSocket(ws);
                setIsVoiceActive(true);
                setIsListening(true);
                
                // Send student data to WebSocket
                ws.send(JSON.stringify(studentContext));
                
                // FIXED: Start microphone recording like voice-coach
                startMicrophoneRecording();
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                switch (data.type) {
                    case 'session_created':
                        console.log('Voice session created');
                        break;
                    case 'audio_delta':
                        // Handle audio output - play the audio from WebSocket
                        if (data.audio) {
                            playAudioFromBase64(data.audio);
                        }
                        break;
                    case 'response_completed':
                        console.log('Response completed');
                        break;
                    case 'session_terminated':
                        console.log('Session terminated');
                        setIsVoiceActive(false);
                        setIsListening(false);
                        setVoiceWebSocket(null);
                        stopMicrophoneRecording();
                        break;
                    case 'error':
                        console.error('Voice session error:', data.message);
                        break;
                }
            };
            
            ws.onerror = (error) => {
                console.error('Voice WebSocket error:', error);
            };
            
            ws.onclose = (event) => {
                console.log('Voice WebSocket closed', event.code, event.reason);
                setIsVoiceActive(false);
                setIsListening(false);
                setVoiceWebSocket(null);
                stopMicrophoneRecording();
            };
            
        } catch (error) {
            console.error('Error starting voice session:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // FIXED: Use the exact same microphone recording approach as voice-coach
    const startMicrophoneRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 24000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                } 
            });
            
            setAudioStream(stream);
            
            // Create MediaRecorder for audio capture
            const recorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            setMediaRecorder(recorder);
            
            // Handle audio data chunks
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0 && voiceWebSocket && voiceWebSocket.readyState === WebSocket.OPEN) {
                    // Convert blob to base64 and send to WebSocket
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64Audio = reader.result.split(',')[1];
                        voiceWebSocket.send(JSON.stringify({
                            type: 'audio_input',
                            audio: base64Audio
                        }));
                    };
                    reader.readAsDataURL(event.data);
                }
            };
            
            // Start recording with small chunks
            recorder.start(100); // Record in 100ms chunks
            isRecordingRef.current = true;
            
            console.log('Microphone recording started');
        } catch (error) {
            console.error('Error starting microphone recording:', error);
            toast.error('Failed to access microphone');
        }
    };

    // FIXED: Use the exact same stop microphone recording approach as voice-coach
    const stopMicrophoneRecording = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            setAudioStream(null);
        }
        
        setMediaRecorder(null);
        isRecordingRef.current = false;
        console.log('Microphone recording stopped');
    };

    // FIXED: Use the exact same audio playback approach as voice-coach
    const playAudioFromBase64 = async (base64Audio) => {
        if (!audioContext || isPlayingRef.current) return;

        try {
            isPlayingRef.current = true;
            
            // FIXED: The audio data from OpenAI is already in the correct format
            // We don't need to decode it as base64, it's already PCM data
            const audioData = atob(base64Audio);
            const audioBuffer = new ArrayBuffer(audioData.length);
            const view = new Uint8Array(audioBuffer);
            
            for (let i = 0; i < audioData.length; i++) {
                view[i] = audioData.charCodeAt(i);
            }

            // FIXED: Create audio buffer directly from PCM data
            const decodedBuffer = await audioContext.decodeAudioData(audioBuffer);
            const source = audioContext.createBufferSource();
            source.buffer = decodedBuffer;
            source.connect(audioContext.destination);
            
            source.onended = () => {
                isPlayingRef.current = false;
            };
            
            source.start();
        } catch (error) {
            console.error('Error playing audio:', error);
            isPlayingRef.current = false;
            
            // FIXED: Try alternative audio playback method
            try {
                // Create a simple audio element for fallback
                const audio = new Audio();
                audio.src = `data:audio/wav;base64,${base64Audio}`;
                audio.play().catch(e => console.error('Fallback audio play failed:', e));
                isPlayingRef.current = false;
            } catch (fallbackError) {
                console.error('Fallback audio playback failed:', fallbackError);
                isPlayingRef.current = false;
            }
        }
    };

    // Web search function for voice session
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
        // Extract image URL from markdown
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
            <div className="h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900 flex items-center justify-center overflow-hidden">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg text-gray-600 dark:text-gray-400">Loading your learning data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden px-2 py-1 h-[679px]">
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="flex-1 flex flex-col overflow-hidden"
                    >
                        <Card className="bg-white/90 dark:bg-purple-800/90 backdrop-blur-sm border-0 shadow-lg flex-1 flex flex-col overflow-hidden">
                            {/* Messages Area */}
                            <div className="flex-1 overflow-hidden">
                                <ScrollArea ref={scrollAreaRef} className="h-full w-full">
                                    <div className="p-4 space-y-2">
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

                                        {isLoading && !messages.some(msg => msg.isStreaming) && (
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
                            <div className="flex-shrink-0 p-2">
                                <div className="flex items-end space-x-3 w-full border-gray-200 dark:border-gray-700">
                                    <div className="flex-1">
                                        <Input
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyPress={handleKeyPress}
                                            placeholder="Ask me anything about your homework..."
                                            className="border bg-gray-50 dark:bg-purple-900 border-purple-500 dark:border-gray-500 rounded-2xl px-6 py-6 w-full text-black dark:text-white"
                                            disabled={isLoading || isUploading}
                                        />
                                    </div>
                                   <div className="flex items-center space-x-2 mb-2">
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
    );
};

export default AiTutor;