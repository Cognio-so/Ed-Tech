"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Image from 'next/image'; // Add Next.js Image component
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
import rehypeRaw from 'rehype-raw'; // Add rehype-raw for HTML support
import rehypeSanitize from 'rehype-sanitize'; // Add rehype-sanitize for security
import { MarkdownStyles } from '@/components/Markdown'; // Import the existing MarkdownStyles
import PythonApi from '@/lib/PythonApi';
import { toast } from 'sonner';
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
    getStudentsForTeacher // Add this import
} from '../app/(home)/teacher/voice-coach/action';

// Add import for real student data
import { getStudents } from '../app/(home)/teacher/class-grouping/action';

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

    // FIXED: Use the same audio management system as AI Tutor
    const audioSourcesRef = useRef([]);
    const isStreamingRef = useRef(false);
    const streamStartTimeRef = useRef(0);
    const audioQualityMetrics = useRef({
        chunksProcessed: 0,
        averageLatency: 0,
        dropouts: 0,
        bufferUnderruns: 0
    });

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

    // Improved autoscrolling with proper timing
    const scrollToBottom = () => {
        setTimeout(() => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
            }
        }, 100);
    };

    // Scroll to bottom when messages change or loading state changes
    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    // Fetch teacher data and real student data
    useEffect(() => {
        const fetchTeacherData = async () => {
            setDataLoading(true);
            try {
                // Fetch all teacher data and real student data in parallel
                const [userResult, progressResult, achievementsResult, statsResult, studentsResult] = await Promise.all([
                    getCurrentTeacherData(),
                    getTeacherProgressData(),
                    getTeacherAchievementsData(),
                    getTeacherLearningStats(),
                    getStudentsForTeacher() // Use the new function
                ]);

                // Set user data from the API response
                if (userResult.success) {
                    setUser({
                        _id: userResult.data._id,
                        email: userResult.data.email,
                        name: userResult.data.name || userResult.data.email,
                        grades: userResult.data.grades || ['Grade 8', 'Grade 9', 'Grade 10'],
                        subjects: userResult.data.subjects || ['Mathematics', 'Science', 'English']
                    });
                } else {
                    // Fallback user data
                    setUser({
                        _id: 'fallback_teacher_id',
                        email: 'teacher@example.com',
                        name: 'Teacher',
                        grades: ['Grade 8', 'Grade 9', 'Grade 10'],
                        subjects: ['Mathematics', 'Science', 'English']
                    });
                }

                // Set real student data
                if (studentsResult.success) {
                    setStudents(studentsResult.data);
                }

                // Set teacher data from API responses
                setTeacherData({
                    lessons: progressResult.success ? progressResult.data.filter(item => item.contentType === 'lesson') : [],
                    resources: progressResult.success ? progressResult.data : [],
                    progress: progressResult.success ? progressResult.data : [],
                    achievements: achievementsResult.success ? achievementsResult.data : [],
                    learningStats: statsResult.success ? statsResult.data : {},
                    userProgress: progressResult.success ? progressResult.data : []
                });

                console.log('Teacher data loaded:', {
                    user: userResult.success ? userResult.data.name : 'fallback',
                    students: studentsResult.success ? studentsResult.data.length : 0,
                    progress: progressResult.success ? progressResult.data.length : 0,
                    achievements: achievementsResult.success ? achievementsResult.data.length : 0,
                    stats: statsResult.success ? statsResult.data : {}
                });

            } catch (error) {
                console.error('Failed to fetch teacher data:', error);
                toast.error('Failed to load your teaching data');
                
                // Set fallback data
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
                    // Create session using action
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
                        console.log('Voice Coach session initialized:', sessionResult.sessionId);
                    } else {
                        console.error('Failed to create session:', sessionResult.error);
                        toast.error('Failed to initialize session');
                    }
                } catch (error) {
                    console.error('Error initializing session:', error);
                    toast.error('Failed to initialize session');
                }
            };

            initializeSession();
        }
    }, [user, dataLoading, teacherData]);

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

    // Save conversation to history - FIXED to handle circular references
    const saveConversationToHistory = async (allMessages, sessionType) => {
        try {
            // FIXED: Create a clean copy of messages without React components
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

    // Send message handler - FIXED to handle image responses properly
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
            
            // FIXED: Create safe student data with fallback performance values
            const safeStudents = students.map(student => {
                // Create fallback performance data if it doesn't exist
                const performance = student.performance || {
                    overall: 75, // Default performance score
                    assignments: 80,
                    quizzes: 70,
                    participation: 85
                };

                return {
                    student_name: student.name,
                    student_id: student._id,
                    email: student.email,
                    grades: student.grades || [],
                    subjects: student.subjects || [],
                    performance: performance,
                    lastActive: student.lastActive || new Date().toISOString(),
                    group: student.group || 'Default',
                    notes: student.notes || '',
                    reports: [
                        {
                            subject: "Overall Performance",
                            score: performance.overall,
                            comments: `Performance: ${performance.overall}%`
                        },
                        {
                            subject: "Assignments",
                            score: performance.assignments,
                            comments: `Assignment completion: ${performance.assignments}%`
                        },
                        {
                            subject: "Quizzes",
                            score: performance.quizzes,
                            comments: `Quiz performance: ${performance.quizzes}%`
                        },
                        {
                            subject: "Participation",
                            score: performance.participation,
                            comments: `Class participation: ${performance.participation}%`
                        }
                    ]
                };
            });

            // FIXED: Calculate safe performance metrics
            const totalStudents = safeStudents.length;
            const averagePerformance = totalStudents > 0 ? 
                safeStudents.reduce((sum, s) => sum + s.performance.overall, 0) / totalStudents : 0;
            
            const topPerformers = safeStudents
                .sort((a, b) => b.performance.overall - a.performance.overall)
                .slice(0, 3)
                .map(s => ({ name: s.student_name, score: s.performance.overall }));
            
            const strugglingStudents = safeStudents
                .filter(s => s.performance.overall < 70)
                .map(s => ({ name: s.student_name, score: s.performance.overall, subjects: s.subjects }));

            formData.append('studentData', JSON.stringify({
                // Teacher basic info
                teacher_name: user.name,
                teacher_id: user._id,
                teacherName: user.name,
                teacherId: user._id,
                
                // Real student data with safe performance reports
                students: safeStudents,
                
                // Student performance overview with safe calculations
                studentPerformance: {
                    totalStudents: totalStudents,
                    averagePerformance: averagePerformance,
                    topPerformers: topPerformers,
                    strugglingStudents: strugglingStudents
                },
                
                // Student overview with safe calculations
                studentOverview: {
                    totalStudents: totalStudents,
                    gradeDistribution: safeStudents.reduce((acc, s) => {
                        s.grades.forEach(grade => {
                            acc[grade] = (acc[grade] || 0) + 1;
                        });
                        return acc;
                    }, {}),
                    subjectDistribution: safeStudents.reduce((acc, s) => {
                        s.subjects.forEach(subject => {
                            acc[subject] = (acc[subject] || 0) + 1;
                        });
                        return acc;
                    }, {})
                },
                
                // Top performers with safe data
                topPerformers: safeStudents
                    .sort((a, b) => b.performance.overall - a.performance.overall)
                    .slice(0, 5)
                    .map(s => ({
                        name: s.student_name,
                        performance: s.performance.overall,
                        strengths: s.subjects,
                        group: s.group
                    })),
                
                // Subject performance with safe calculations
                subjectPerformance: safeStudents.reduce((acc, s) => {
                    s.subjects.forEach(subject => {
                        if (!acc[subject]) {
                            acc[subject] = { total: 0, count: 0, students: [] };
                        }
                        acc[subject].total += s.performance.overall;
                        acc[subject].count += 1;
                        acc[subject].students.push({
                            name: s.student_name,
                            score: s.performance.overall
                        });
                    });
                    return acc;
                }, {}),
                
                // Teacher context
                role: 'teacher',
                recentActivities: teacherData.progress.slice(0, 5),
                teachingExperience: 'intermediate',
                topicInterests: user.subjects || []
            }));

            const response = await sendVoiceCoachMessage(formData);

            if (response.success) {
                // FIXED: Handle both text and image responses properly
                let messageContent = response.response;
                let isImageResponse = false;

                // Check if response contains image data
                if (response.response && response.response.includes('__IMAGE_RESPONSE__')) {
                    isImageResponse = true;
                    // Extract the image content after the marker
                    messageContent = response.response.replace('__IMAGE_RESPONSE__', '');
                } else if (response.response && response.response.includes('![image](')) {
                    isImageResponse = true;
                } else if (response.response && response.response.includes('data:image/')) {
                    isImageResponse = true;
                }

                const aiMessage = {
                    id: Date.now() + 1,
                    type: 'ai',
                    content: messageContent,
                    timestamp: new Date(),
                    avatar: <GraduationCap className="w-4 h-4 text-blue-500" />,
                    isImageResponse: isImageResponse
                };

                setMessages(prev => [...prev, aiMessage]);

                // Save conversation to history after AI response is complete
                setTimeout(() => {
                    const allMessages = [...messages, userMessage, aiMessage];
                    saveConversationToHistory(allMessages, isVoiceActive ? 'mixed' : 'text');
                }, 500);
            } else {
                throw new Error(response.error || 'Failed to get response');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Failed to send message. Please try again.');

            const errorMessage = {
                id: Date.now() + 1,
                type: 'ai',
                content: "I'm sorry, I encountered an error. Please try again or check your connection.",
                timestamp: new Date(),
                avatar: <GraduationCap className="w-4 h-4 text-red-500" />
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

    // FIXED: Complete voice session handler with proper toggle logic (same as AI Tutor)
    const startVoiceSessionHandler = async () => {
        if (!user || !sessionId) {
            toast.error('Please wait for session to initialize');
            return;
        }
        
        // FIXED: Check if voice is already active and stop it instead
        if (isVoiceActive) {
            console.log('Stopping voice session...');
            await stopVoiceSessionHandler();
            return;
        }
        
        // Reset error flag and audio scheduling for new session
        hasErrorRef.current = false;
        nextStartTimeRef.current = 0;
        
        try {
            // Initialize audio context
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            setAudioContext(audioCtx);
            
            // Resume audio context if suspended (for Chrome autoplay policy)
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
                console.log('Audio context resumed');
            }
            
            // Prepare comprehensive teacher context with REAL student data
            const teacherContext = {
                // Teacher basic info
                teacher_name: user.name,
                teacher_id: user._id,
                teacherName: user.name,
                teacherId: user._id,
                
                // Real student data with performance reports
                students: students.map(student => {
                    // Create performance object with fallback values
                    const performance = student.performance || {
                        overall: 75,
                        assignments: 80,
                        quizzes: 70,
                        participation: 85
                    };

                    return {
                        student_name: student.name,
                        student_id: student._id,
                        email: student.email,
                        grades: student.grades,
                        subjects: student.subjects,
                        performance: performance,
                        lastActive: student.lastActive || new Date().toISOString(),
                        group: student.group || 'Default Group',
                        notes: student.notes || '',
                        reports: [
                            {
                                subject: "Overall Performance",
                                score: performance.overall,
                                comments: `Performance: ${performance.overall}%`
                            },
                            {
                                subject: "Assignments",
                                score: performance.assignments,
                                comments: `Assignment completion: ${performance.assignments}%`
                            },
                            {
                                subject: "Quizzes",
                                score: performance.quizzes,
                                comments: `Quiz performance: ${performance.quizzes}%`
                            },
                            {
                                subject: "Participation",
                                score: performance.participation,
                                comments: `Class participation: ${performance.participation}%`
                            }
                        ]
                    };
                }),
                
                // Student performance overview
                studentPerformance: {
                    totalStudents: students.length,
                    averagePerformance: students.length > 0 ? 
                        students.reduce((sum, s) => sum + (s.performance?.overall || 75), 0) / students.length : 0,
                    topPerformers: students
                        .sort((a, b) => (b.performance?.overall || 75) - (a.performance?.overall || 75))
                        .slice(0, 3)
                        .map(s => ({ name: s.name, score: s.performance?.overall || 75 })),
                    strugglingStudents: students
                        .filter(s => (s.performance?.overall || 75) < 70)
                        .map(s => ({ name: s.name, score: s.performance?.overall || 75, subjects: s.subjects }))
                },
                
                // Teacher context
                role: 'teacher',
                recentActivities: teacherData.progress.slice(0, 5),
                teachingExperience: 'intermediate',
                topicInterests: user.subjects || []
            };

            // FIXED: Start voice session using PythonApi (same as AI Tutor)
            const ws = await PythonApi.startVoiceSession({
                id: user._id,
                email: user.email,
                name: user.name || user.email,
                grade: user.grade || '8',
                progress: teacherData.progress,
                achievements: teacherData.achievements,
                learningStats: teacherData.learningStats,
                assessments: teacherData.resources.filter(r => r.resourceType === 'assessment'),
                lessons: teacherData.lessons,
                resources: teacherData.resources,
                analytics: teacherData.userProgress
            });
            
            ws.onopen = async () => {
                console.log('Voice WebSocket connected');
                setVoiceWebSocket(ws);
                setIsVoiceActive(true);
                
                // Start the real-time voice session with enhanced context
                ws.send(JSON.stringify({
                    type: 'start_session',
                    teacher_data: teacherContext
                }));
                
                console.log('Sending teacher context:', teacherContext);
                
                // Start capturing microphone audio
                await startMicrophoneCapture(ws);
                
                toast.success('Real-time voice session started');
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleVoiceMessage(data);
            };
            
            ws.onerror = (error) => {
                console.error('Voice WebSocket error:', error);
                
                // Only show error if we haven't already
                if (!hasErrorRef.current) {
                    hasErrorRef.current = true;
                    toast.error('Voice connection failed. Please try again.');
                }
                
                // Clean up without trying to send to closed WebSocket
                setVoiceWebSocket(null);
                setIsVoiceActive(false);
                setIsListening(false);
                stopMicrophoneCapture();
                
                // Clean up audio context
                if (audioCtx && audioCtx.state !== 'closed') {
                    audioCtx.close().catch(e => console.error('Error closing AudioContext:', e));
                }
                setAudioContext(null);
            };
            
            ws.onclose = (event) => {
                console.log('Voice WebSocket closed', event.code, event.reason);
                
                // Only show error if it was unexpected (not a normal close)
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
                
                // Clean up audio context
                if (audioCtx && audioCtx.state !== 'closed') {
                    audioCtx.close().catch(e => console.error('Error closing AudioContext:', e));
                }
                setAudioContext(null);
            };
            
        } catch (error) {
            console.error('Failed to start voice session:', error);
            
            // Only show error if we haven't already shown one
            if (!hasErrorRef.current) {
                hasErrorRef.current = true;
                toast.error('Failed to start voice session. Please check your microphone permissions.');
            }
            
            // Clean up
            setIsVoiceActive(false);
            setIsListening(false);
            if (audioContext && audioContext.state !== 'closed') {
                audioContext.close().catch(e => console.error('Error closing AudioContext:', e));
            }
            setAudioContext(null);
        }
    };

    // FIXED: Use the same microphone capture system as AI Tutor
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
            
            // Use AudioContext for PCM processing
            const audioCtx = audioContext || new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            const source = audioCtx.createMediaStreamSource(stream);
            
            // Create an analyser node as a modern alternative
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            
            // Create a buffer to capture audio
            const bufferLength = analyser.fftSize;
            const dataArray = new Float32Array(bufferLength);
            
            source.connect(analyser);
            
            // Process audio in chunks using setInterval instead of deprecated ScriptProcessor
            const processAudio = setInterval(() => {
                if (ws.readyState !== WebSocket.OPEN) {
                    clearInterval(processAudio);
                    return;
                }
                
                // Get time domain data
                analyser.getFloatTimeDomainData(dataArray);
                
                // Convert Float32Array to Int16Array (PCM16)
                const pcm16 = new Int16Array(dataArray.length);
                for (let i = 0; i < dataArray.length; i++) {
                    const s = Math.max(-1, Math.min(1, dataArray[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                
                // Convert to base64
                const uint8Array = new Uint8Array(pcm16.buffer);
                let binary = '';
                for (let i = 0; i < uint8Array.length; i++) {
                    binary += String.fromCharCode(uint8Array[i]);
                }
                const base64Audio = btoa(binary);
                
                // Send to backend
                ws.send(JSON.stringify({
                    type: 'audio_chunk',
                    audio: base64Audio
                }));
            }, 100); // Send every 100ms
            
            // Store for cleanup
            mediaStreamRef.current.analyser = analyser;
            mediaStreamRef.current.source = source;
            mediaStreamRef.current.processInterval = processAudio;
            
            setIsListening(true);
            
        } catch (error) {
            console.error('Failed to start microphone:', error);
            
            // Only show error if we haven't already
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
            
            // Stop the voice session since we can't capture audio
            stopVoiceSessionHandler();
        }
    };
    
    // FIXED: Use the same stop microphone capture system as AI Tutor
    const stopMicrophoneCapture = () => {
        if (mediaRecorder) {
            mediaRecorder.stop();
            setMediaRecorder(null);
        }
        
        if (mediaStreamRef.current) {
            // Clear interval if it exists
            if (mediaStreamRef.current.processInterval) {
                clearInterval(mediaStreamRef.current.processInterval);
                mediaStreamRef.current.processInterval = null;
            }
            
            // Disconnect audio nodes if they exist
            if (mediaStreamRef.current.analyser) {
                mediaStreamRef.current.analyser.disconnect();
                mediaStreamRef.current.analyser = null;
            }
            
            if (mediaStreamRef.current.source) {
                mediaStreamRef.current.source.disconnect();
                mediaStreamRef.current.source = null;
            }
            
            // Stop all tracks
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        
        setIsListening(false);
    };

    // FIXED: Use the same advanced audio streaming system as AI Tutor
    const playAudioFromBase64 = async (base64Audio) => {
        // Ensure we have an audio context - reuse existing one
        let currentAudioContext = audioContext;
        if (!currentAudioContext || currentAudioContext.state === 'closed') {
            console.log('Creating audio context for playback');
            currentAudioContext = new (window.AudioContext || window.webkitAudioContext)({ 
                sampleRate: 24000,
                latencyHint: 'interactive' // Optimize for low latency
            });
            setAudioContext(currentAudioContext);
            
            // Reset timing when creating new context
            nextStartTimeRef.current = currentAudioContext.currentTime;
        }
        
        // Resume if suspended
        if (currentAudioContext.state === 'suspended') {
            await currentAudioContext.resume();
        }
        
        // Validate audio context state
        if (currentAudioContext.state === 'closed') {
            console.error('AudioContext is closed, cannot play audio');
            return;
        }
        
        try {
            // Validate base64 input
            if (!base64Audio || typeof base64Audio !== 'string') {
                console.warn('Invalid base64 audio data received');
                return;
            }
            
            // Convert base64 to ArrayBuffer with error handling
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
            
            // Validate minimum audio chunk size (prevent micro-chunks)
            if (bytes.length < 960) { // 20ms at 24kHz, 16-bit = 960 bytes
                console.log('Audio chunk too small, skipping:', bytes.length);
                return;
            }
            
            // Create Int16Array from bytes (little-endian format)
            const pcm16 = new Int16Array(bytes.buffer);
            
            // Apply audio enhancement and normalization
            const float32 = new Float32Array(pcm16.length);
            let maxAmplitude = 0;
            
            // Convert PCM16 to Float32 and find max amplitude
            for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 32768.0;
                maxAmplitude = Math.max(maxAmplitude, Math.abs(float32[i]));
            }
            
            // Apply soft limiting and normalization if needed
            if (maxAmplitude > 0.95) {
                const compressionRatio = 0.9 / maxAmplitude;
                for (let i = 0; i < float32.length; i++) {
                    float32[i] *= compressionRatio;
                }
                console.log('Applied audio compression, ratio:', compressionRatio);
            }
            
            // Create audio buffer with validation
            if (float32.length === 0) {
                console.warn('Empty audio data, skipping');
                return;
            }
            
            const audioBuffer = currentAudioContext.createBuffer(1, float32.length, 24000);
            audioBuffer.getChannelData(0).set(float32);
            
            // Quality metrics tracking
            audioQualityMetrics.current.chunksProcessed++;
            const receiveTime = currentAudioContext.currentTime;
            
            // Add to audio buffer queue with enhanced metadata
            audioBufferRef.current.push({
                buffer: audioBuffer,
                timestamp: receiveTime,
                duration: audioBuffer.duration,
                chunkId: audioQualityMetrics.current.chunksProcessed,
                size: bytes.length
            });
            
            // Better buffer management - trim when buffer gets too large
            if (audioBufferRef.current.length > 50) {
                const removedChunks = audioBufferRef.current.length - 25;
                audioBufferRef.current = audioBufferRef.current.slice(-25);
                audioQualityMetrics.current.dropouts += removedChunks;
                console.log(`Audio buffer trimmed: removed ${removedChunks} chunks, buffer size: ${audioBufferRef.current.length}`);
            }
            
            // Start processing queue if not already streaming
            if (!isStreamingRef.current) {
                processAudioStream(currentAudioContext);
            }
            
        } catch (error) {
            console.error('Failed to prepare audio:', error);
            audioQualityMetrics.current.dropouts++;
        }
    };

    // FIXED: Use the same enhanced audio stream processing as AI Tutor
    const processAudioStream = (currentAudioContext) => {
        if (audioBufferRef.current.length === 0) {
            isStreamingRef.current = false;
            // Log quality metrics when stream ends
            if (audioQualityMetrics.current.chunksProcessed > 0) {
                console.log('Audio stream ended. Quality metrics:', audioQualityMetrics.current);
            }
            return;
        }
        
        isStreamingRef.current = true;
        
        // Get the next audio chunk
        const audioChunk = audioBufferRef.current.shift();
        
        // Validate audio context is still usable
        if (currentAudioContext.state === 'closed') {
            console.error('AudioContext closed during playback');
            isStreamingRef.current = false;
            return;
        }
        
        // Create audio source with error handling
        let source;
        try {
            source = currentAudioContext.createBufferSource();
            source.buffer = audioChunk.buffer;
            
            // Create gain node for volume control and fade effects
            const gainNode = currentAudioContext.createGain();
            source.connect(gainNode);
            gainNode.connect(currentAudioContext.destination);
            
            // Apply subtle fade-in to prevent clicks
            const now = currentAudioContext.currentTime;
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(1, now + 0.003); // 3ms fade-in
            
        } catch (error) {
            console.error('Failed to create audio source:', error);
            audioQualityMetrics.current.dropouts++;
            // Continue with next chunk
            setTimeout(() => processAudioStream(currentAudioContext), 10);
            return;
        }
        
        // Better timing calculation
        const now = currentAudioContext.currentTime;
        
        // Reset timing if drift is too large or if this is the first chunk
        if (nextStartTimeRef.current === 0 || nextStartTimeRef.current > now + 0.5) {
            nextStartTimeRef.current = now + 0.01;
        }
        
        // Ensure smooth playback with minimal gaps
        const scheduledStartTime = Math.max(now + 0.005, nextStartTimeRef.current);
        
        // Start playing with error handling
        try {
            source.start(scheduledStartTime);
            
            // Update timing for next chunk - no gaps needed for continuous audio
            nextStartTimeRef.current = scheduledStartTime + audioChunk.duration;
            
        } catch (startError) {
            console.error('Failed to start audio source:', startError);
            audioQualityMetrics.current.dropouts++;
            // Continue with next chunk
            setTimeout(() => processAudioStream(currentAudioContext), 10);
            return;
        }
        
        // Enhanced source management
        audioSourcesRef.current.push({
            source: source,
            startTime: scheduledStartTime,
            endTime: scheduledStartTime + audioChunk.duration,
            chunkId: audioChunk.chunkId
        });
        
        // Cleanup old sources more aggressively
        const currentTime = currentAudioContext.currentTime;
        audioSourcesRef.current = audioSourcesRef.current.filter((sourceInfo, index) => {
            if (sourceInfo.endTime < currentTime - 0.5) {
                // Source has finished playing and is old enough to clean up
                try {
                    sourceInfo.source.disconnect();
                } catch (e) {
                    // Already disconnected
                }
                return false;
            }
            return true;
        });
        
        // Keep maximum of 10 active sources (reduced from 15)
        if (audioSourcesRef.current.length > 10) {
            const excess = audioSourcesRef.current.splice(0, audioSourcesRef.current.length - 10);
            excess.forEach(sourceInfo => {
                try {
                    sourceInfo.source.stop();
                    sourceInfo.source.disconnect();
                } catch (e) {
                    // Already stopped/disconnected
                }
            });
        }
        
        // Schedule next chunk processing immediately for continuous playback
        source.onended = () => {
            // Process next chunk immediately for seamless audio
            processAudioStream(currentAudioContext);
        };
        
        // Enhanced error handling
        source.onerror = (error) => {
            console.error('Audio source error:', error);
            audioQualityMetrics.current.dropouts++;
            // Continue with next chunk
            setTimeout(() => processAudioStream(currentAudioContext), 10);
        };
        
        // Detailed logging for debugging (only log every 20th chunk to reduce spam)
        if (audioChunk.chunkId % 20 === 0) {
            console.log('Audio stream status:', {
                chunkId: audioChunk.chunkId,
                duration: audioChunk.duration,
                startTime: scheduledStartTime,
                nextStartTime: nextStartTimeRef.current,
                queueLength: audioBufferRef.current.length,
                contextTime: currentAudioContext.currentTime,
                timingGap: scheduledStartTime - currentAudioContext.currentTime,
                activeSources: audioSourcesRef.current.length,
                qualityMetrics: audioQualityMetrics.current
            });
        }
    };

    // FIXED: Use the same voice message handler as AI Tutor
    const handleVoiceMessage = async (data) => {
        switch (data.type) {
            case 'session_started':
                toast.success('Ready for real-time conversation');
                setIsListening(true);
                // Reset all audio streaming state for new session
                nextStartTimeRef.current = 0;
                audioBufferRef.current = [];
                isPlayingRef.current = false;
                isStreamingRef.current = false;
                audioSourcesRef.current = [];
                streamStartTimeRef.current = 0;
                // Reset quality metrics for new session
                audioQualityMetrics.current = {
                    chunksProcessed: 0,
                    averageLatency: 0,
                    dropouts: 0,
                    bufferUnderruns: 0
                };
                console.log('Audio streaming state and quality metrics reset for new session');
                break;
            case 'session.created':
                console.log('OpenAI session created');
                break;
            case 'response.audio.delta':
                // Play audio response from OpenAI with enhanced processing
                const audioData = data.audio || data.delta;
                if (audioData) {
                    // Use non-blocking audio processing to prevent WebSocket delays
                    setTimeout(() => playAudioFromBase64(audioData), 0);
                } else {
                    console.warn('No audio data in response.audio.delta event');
                    audioQualityMetrics.current.dropouts++;
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
            case 'conversation.item.create':
                // Handle tool calls if needed
                if (data.item?.tool_calls) {
                    for (const toolCall of data.item.tool_calls) {
                        if (toolCall.function?.name === 'web_search') {
                            try {
                                const args = JSON.parse(toolCall.function.arguments);
                                const searchResults = await performWebSearch(args.query);
                                
                                // Check WebSocket state before sending
                                if (voiceWebSocket && voiceWebSocket.readyState === WebSocket.OPEN) {
                                    voiceWebSocket.send(JSON.stringify({
                                        type: 'conversation.item.create',
                                        item: {
                                            type: 'function_call_output',
                                            call_id: toolCall.id,
                                            output: searchResults
                                        }
                                    }));
                                }
                            } catch (error) {
                                console.error('Web search failed:', error);
                            }
                        }
                    }
                }
                break;
            case 'response.done':
            case 'response.completed':
                console.log('OpenAI response completed');
                break;
            case 'function_call_request':
                // Handle function call request from backend
                if (data.function?.name === 'web_search') {
                    try {
                        const args = JSON.parse(data.function.arguments || '{}');
                        const searchResults = await performWebSearch(args.query);
                        
                        // Check WebSocket state before sending
                        if (voiceWebSocket && voiceWebSocket.readyState === WebSocket.OPEN) {
                            voiceWebSocket.send(JSON.stringify({
                                type: 'function_call_output',
                                call_id: data.function.call_id || data.function.id,
                                output: searchResults
                            }));
                        }
                    } catch (error) {
                        console.error('Function call failed:', error);
                    }
                }
                break;
            case 'error':
                console.error('Voice session error:', data);
                
                // Log the specific error details
                if (data.error) {
                    console.error('OpenAI Error Details:', {
                        type: data.error.type,
                        code: data.error.code,
                        message: data.error.message,
                        param: data.error.param,
                        event_id: data.event_id
                    });
                }
                
                // Only show error if we haven't already
                if (!hasErrorRef.current) {
                    hasErrorRef.current = true;
                    
                    // Extract error message from OpenAI error structure
                    let errorMessage = 'Voice session encountered an error';
                    if (data.error?.message) {
                        errorMessage = data.error.message;
                    } else if (data.message) {
                        errorMessage = data.message;
                    }
                    
                    toast.error(errorMessage);
                }
                
                // Don't stop session for recoverable errors
                if (data.error?.type === 'invalid_request_error' || data.error?.code === 'invalid_value') {
                    console.warn('Recoverable error, continuing session...');
                } else {
                    stopVoiceSessionHandler();
                }
                break;
        }
    };

    // FIXED: Use the same stop voice session system as AI Tutor
    const stopVoiceSessionHandler = async () => {
        try {
            console.log('Stopping voice session...');
            
            // Check WebSocket state before sending
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
            
            // Clean up audio streaming
            isStreamingRef.current = false;
            audioBufferRef.current = [];
            nextStartTimeRef.current = 0;
            
            // Stop all audio sources
            audioSourcesRef.current.forEach(source => {
                try {
                    source.source.stop();
                    source.source.disconnect();
                } catch (e) {
                    // Source may already be stopped
                }
            });
            audioSourcesRef.current = [];
            
            // Clean up microphone
            stopMicrophoneCapture();
            
            // Don't close audio context - just suspend it for reuse
            if (audioContext && audioContext.state !== 'closed') {
                audioContext.suspend().then(() => {
                    console.log('Audio context suspended');
                }).catch(error => {
                    console.error('Error suspending AudioContext:', error);
                });
            }
            
            setTranscription('');
            
            toast.success('Voice session stopped');
        } catch (error) {
            console.error('Error stopping voice session:', error);
            toast.error('Error stopping voice session');
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
                
                // Add system message about upload
                const uploadMessage = {
                    id: Date.now(),
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
            console.error('Error uploading files:', error);
            toast.error('Failed to upload files. Please try again.');
        } finally {
            setIsUploading(false);
        }
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
                // Use action to upload files
                const formData = new FormData();
                formData.append('sessionId', sessionId);
                files.forEach(file => {
                    formData.append('files', file);
                });

                const uploadResult = await uploadDocumentsToVoiceCoach(formData);
                
                if (uploadResult.success) {
                    // Add files to local state
                    setUploadedFiles(prev => [...prev, ...files]);
                    
                    // Add success message to chat
                    const uploadMessage = {
                        id: Date.now(),
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
                console.error('Upload error:', error);
                toast.error('Failed to upload documents. Please try again.');
                
                // Add error message to chat
                const errorMessage = {
                    id: Date.now(),
                    type: 'ai',
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

    // Enhanced image rendering component (same as AI Tutor)
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

    // FIXED: Enhanced markdown styles with proper image handling
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
        // FIXED: Proper image handling that doesn't break HTML structure
        img: ({ node, src, alt, ...props }) => {
            // Don't render if src is empty or invalid
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

    // FIXED: Update the renderMessageContent function to handle images properly
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
                    <p className="text-lg text-gray-600 dark:text-gray-400">Loading your teaching data...</p>
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
                                        onClick={startVoiceSessionHandler} // FIXED: Use the same handler for both start/stop
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
                onClick={stopVoiceSessionHandler}
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

export default VoiceCoach;