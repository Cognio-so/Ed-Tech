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
    MicOff,
    GraduationCap,
    BookOpen,
    Users,
    TrendingUp
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

    // Send message handler - FIXED to handle missing performance data
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
                const aiMessage = {
                    id: Date.now() + 1,
                    type: 'ai',
                    content: response.response,
                    timestamp: new Date(),
                    avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
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

    // Real-time voice functionality - FIXED
    const startVoiceSessionHandler = async () => {
        if (!user || !sessionId) {
            toast.error('Please wait for session to initialize');
            return;
        }
        
        if (isVoiceActive) {
            console.log('Voice session already active');
            return;
        }
        
        try {
            hasErrorRef.current = false;
            
            // Prepare comprehensive teacher context with REAL student data
            const teacherContextFormData = new FormData();
            teacherContextFormData.append('teacherData', JSON.stringify({
                // Teacher basic info
                teacher_name: user.name,
                teacher_id: user._id,
                teacherName: user.name,
                teacherId: user._id,
                
                // Real student data with performance reports
                students: students.map(student => ({
                    student_name: student.name,
                    student_id: student._id,
                    email: student.email,
                    grades: student.grades,
                    subjects: student.subjects,
                    performance: student.performance,
                    lastActive: student.lastActive,
                    group: student.group,
                    notes: student.notes,
                    reports: [
                        {
                            subject: "Overall Performance",
                            score: student.performance.overall,
                            comments: `Performance: ${student.performance.overall}%`
                        },
                        {
                            subject: "Assignments",
                            score: student.performance.assignments,
                            comments: `Assignment completion: ${student.performance.assignments}%`
                        },
                        {
                            subject: "Quizzes",
                            score: student.performance.quizzes,
                            comments: `Quiz performance: ${student.performance.quizzes}%`
                        },
                        {
                            subject: "Participation",
                            score: student.performance.participation,
                            comments: `Class participation: ${student.performance.participation}%`
                        }
                    ]
                })),
                
                // Student performance overview
                studentPerformance: {
                    totalStudents: students.length,
                    averagePerformance: students.length > 0 ? 
                        students.reduce((sum, s) => sum + s.performance.overall, 0) / students.length : 0,
                    topPerformers: students
                        .sort((a, b) => b.performance.overall - a.performance.overall)
                        .slice(0, 3)
                        .map(s => ({ name: s.name, score: s.performance.overall })),
                    strugglingStudents: students
                        .filter(s => s.performance.overall < 70)
                        .map(s => ({ name: s.name, score: s.performance.overall, subjects: s.subjects }))
                },
                
                // Student overview
                studentOverview: {
                    totalStudents: students.length,
                    gradeDistribution: students.reduce((acc, s) => {
                        s.grades.forEach(grade => {
                            acc[grade] = (acc[grade] || 0) + 1;
                        });
                        return acc;
                    }, {}),
                    subjectDistribution: students.reduce((acc, s) => {
                        s.subjects.forEach(subject => {
                            acc[subject] = (acc[subject] || 0) + 1;
                        });
                        return acc;
                    }, {})
                },
                
                // Top performers
                topPerformers: students
                    .sort((a, b) => b.performance.overall - a.performance.overall)
                    .slice(0, 5)
                    .map(s => ({
                        name: s.name,
                        performance: s.performance.overall,
                        strengths: s.subjects,
                        group: s.group
                    })),
                
                // Subject performance
                subjectPerformance: students.reduce((acc, s) => {
                    s.subjects.forEach(subject => {
                        if (!acc[subject]) {
                            acc[subject] = { total: 0, count: 0, students: [] };
                        }
                        acc[subject].total += s.performance.overall;
                        acc[subject].count += 1;
                        acc[subject].students.push({
                            name: s.name,
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

            const voiceSessionResult = await startVoiceCoachSession(teacherContextFormData);
            
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
            
            // FIXED: Connect to TEACHER voice WebSocket using the prepared context
            const ws = await PythonApi.startTeacherVoiceSession(voiceSessionResult.teacherContext);
            
            ws.onopen = async () => {
                console.log('Teacher Voice WebSocket connected');
                setVoiceWebSocket(ws);
                setIsVoiceActive(true);

                ws.send(JSON.stringify({
                    type: 'start_session',
                    teacher_data: voiceSessionResult.teacherContext
                }));
                
                console.log('Sending enhanced teacher context with real student data:', voiceSessionResult.teacherContext);
                
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
                    sampleRate: 24000
                }
            });
            
            mediaStreamRef.current = stream;
            
            const audioCtx = audioContext || new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            const source = audioCtx.createMediaStreamSource(stream);
            
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            
            const bufferLength = analyser.fftSize;
            const dataArray = new Uint8Array(bufferLength);
            
            source.connect(analyser);
            
            const processAudio = setInterval(() => {
                if (ws.readyState !== WebSocket.OPEN) {
                    clearInterval(processAudio);
                    return;
                }
                
                analyser.getByteTimeDomainData(dataArray);
                
                // Convert to base64
                let binary = '';
                const uint8Array = new Uint8Array(dataArray);
                for (let i = 0; i < uint8Array.length; i++) {
                    binary += String.fromCharCode(uint8Array[i]);
                }
                const base64Audio = btoa(binary);
                
                ws.send(JSON.stringify({
                    type: 'audio_chunk',
                    audio: base64Audio
                }));
            }, 100);

            setIsListening(true);
            console.log('Microphone capture started');
            
        } catch (error) {
            console.error('Failed to start microphone capture:', error);
            toast.error('Failed to access microphone. Please check permissions.');
            throw error;
        }
    };

    // Stop microphone capture
    const stopMicrophoneCapture = () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        setIsListening(false);
        console.log('Microphone capture stopped');
    };

    // Handle voice messages
    const handleVoiceMessage = (data) => {
        console.log('Received voice message:', data);
        
        switch (data.type) {
            case 'transcription':
                setTranscription(data.text);
                break;
                
            case 'ai_response':
                // Add AI response to chat
                const aiMessage = {
                    id: Date.now(),
                    type: 'ai',
                    content: data.text,
                    timestamp: new Date(),
                    avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
                };
                setMessages(prev => [...prev, aiMessage]);
                break;
                
            case 'audio_response':
                // Play AI audio response
                if (data.audio) {
                    playAudioResponse(data.audio);
                }
                break;
                
            case 'error':
                console.error('Voice session error:', data.message);
                toast.error(data.message || 'Voice session error');
                break;
        }
    };

    // Play audio response
    const playAudioResponse = (base64Audio) => {
        try {
            const audioData = atob(base64Audio);
            const audioBuffer = new ArrayBuffer(audioData.length);
            const view = new Uint8Array(audioBuffer);
            
            for (let i = 0; i < audioData.length; i++) {
                view[i] = audioData.charCodeAt(i);
            }
            
            const blob = new Blob([audioBuffer], { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(blob);
            
            if (audioPlayerRef.current) {
                audioPlayerRef.current.src = audioUrl;
                audioPlayerRef.current.play().catch(e => console.error('Error playing audio:', e));
            }
        } catch (error) {
            console.error('Error playing audio response:', error);
        }
    };

    // Stop voice session
    const stopVoiceSessionHandler = async () => {
        try {
            if (voiceWebSocket && voiceWebSocket.readyState === WebSocket.OPEN) {
                voiceWebSocket.send(JSON.stringify({ type: 'stop_session' }));
                voiceWebSocket.close();
            }
            
            stopMicrophoneCapture();
            
            if (audioContext && audioContext.state !== 'closed') {
                await audioContext.close();
            }
            
            setVoiceWebSocket(null);
            setAudioContext(null);
            setIsVoiceActive(false);
            setIsListening(false);
            setTranscription('');
            
            toast.success('Voice session stopped');
        } catch (error) {
            console.error('Error stopping voice session:', error);
            toast.error('Error stopping voice session');
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
    };

    // Update the renderMessageContent function
    const renderMessageContent = (message) => {
        return (
            <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownStyles}>
                    {message.content}
                </ReactMarkdown>
            </div>
        );
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