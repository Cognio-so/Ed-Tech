"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { User, Users } from 'lucide-react';

const VoiceCoachVideo = ({ 
    isSpeaking = false, 
    isConnected = false,
    onFirstLoad = false, // This will be true when voice coach opens for the first time
    onVoiceChange = null // Callback to notify parent of voice change
}) => {
    const [selectedGender, setSelectedGender] = useState('female');
    const [hasPlayedIntro, setHasPlayedIntro] = useState(false);
    
    const mutedVideoRef = useRef(null);
    const unmutedVideoRef = useRef(null);
    
    // Video sources based on gender - FIXED PATHS
    const videoSources = {
        male: {
            muted: '/video/muted_video_male.mp4',
            unmuted: '/video/unmuted_video_male.mp4'
        },
        female: {
            muted: '/video/video_muted_female.mp4',
            unmuted: '/video/unmuted_video_female.mp4'
        }
    };

    // FIXED: Voice mapping with valid OpenAI voices
    const voiceMapping = {
        female: 'alloy', // Female-sounding voice
        male: 'echo'     // Male-sounding voice (valid OpenAI voice)
    };

    // Play intro video ONCE when component first loads
    useEffect(() => {
        const unmutedVideo = unmutedVideoRef.current;
        if (!unmutedVideo || hasPlayedIntro) return;

        // Try to play intro video immediately on load
        const playIntro = () => {
            unmutedVideo.play()
                .then(() => {
                    console.log('Intro video started playing');
                })
                .catch((error) => {
                    console.log('Intro video autoplay blocked:', error);
                    // If autoplay fails, just mark as played and show muted video
                    setHasPlayedIntro(true);
                });
        };

        // Small delay to ensure video is ready
        const timer = setTimeout(playIntro, 500);
        return () => clearTimeout(timer);
    }, []); // Empty dependency - runs only once on mount

    // Handle muted video play/pause based on AI speaking
    useEffect(() => {
        const mutedVideo = mutedVideoRef.current;
        if (!mutedVideo) return;

        if (isSpeaking && isConnected) {
            mutedVideo.play().catch(console.error);
        } else {
            mutedVideo.pause();
        }
    }, [isSpeaking, isConnected]);

    // Handle gender change - reset intro played state and reload videos
    const handleGenderChange = (gender) => {
        console.log('Switching to gender:', gender); // Debug log
        setSelectedGender(gender);
        setHasPlayedIntro(false);
        
        // Notify parent component of voice change
        if (onVoiceChange) {
            const selectedVoice = voiceMapping[gender];
            console.log('Changing voice to:', selectedVoice);
            onVoiceChange(selectedVoice);
        }
        
        // Force reload both videos with new sources
        const mutedVideo = mutedVideoRef.current;
        const unmutedVideo = unmutedVideoRef.current;
        
        if (mutedVideo) {
            mutedVideo.src = videoSources[gender].muted;
            mutedVideo.load(); // Force reload
            console.log('Loading muted video:', videoSources[gender].muted);
        }
        
        if (unmutedVideo) {
            unmutedVideo.src = videoSources[gender].unmuted;
            unmutedVideo.load(); // Force reload
            unmutedVideo.currentTime = 0;
            unmutedVideo.style.display = 'block';
            console.log('Loading unmuted video:', videoSources[gender].unmuted);
        }
        
        // Play intro video again when gender changes
        setTimeout(() => {
            if (unmutedVideo) {
                unmutedVideo.play().catch(console.error);
            }
        }, 200); // Increased delay to ensure video is loaded
    };

    // Handle unmuted video end - ensure immediate transition to muted video
    const handleUnmutedVideoEnd = () => {
        console.log('Intro video ended');
        setHasPlayedIntro(true);
        if (unmutedVideoRef.current) {
            unmutedVideoRef.current.style.display = 'none';
        }
        // Ensure muted video is ready to play immediately
        if (mutedVideoRef.current) {
            mutedVideoRef.current.style.display = 'block';
        }
    };

    return (
        <div className="relative w-[400px] h-[550px] overflow-hidden bg-transparent rounded-md">
            {/* Gender Selection - Enhanced visibility */}
            <div className="absolute top-2 right-2 z-20 flex space-x-1 bg-black/20 backdrop-blur-sm rounded-lg p-1">
                <Button
                    size="sm"
                    variant={selectedGender === 'female' ? 'default' : 'outline'}
                    onClick={() => handleGenderChange('female')}
                    className={`w-10 h-10 p-0 rounded-full ${
                        selectedGender === 'female' 
                            ? 'bg-purple-500 hover:bg-purple-600 text-white' 
                            : 'bg-white/80 hover:bg-white text-gray-700 border-2 border-white'
                    }`}
                    title="Female Teacher"
                >
                    <User className="w-4 h-4" />
                </Button>
                <Button
                    size="sm"
                    variant={selectedGender === 'male' ? 'default' : 'outline'}
                    onClick={() => handleGenderChange('male')}
                    className={`w-10 h-10 p-0 rounded-full ${
                        selectedGender === 'male' 
                            ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                            : 'bg-white/80 hover:bg-white text-gray-700 border-2 border-white'
                    }`}
                    title="Male Teacher"
                >
                    <Users className="w-4 h-4" />
                </Button>
            </div>

            {/* Muted Video - Plays/Pauses with AI Speaking */}
            <video
                ref={mutedVideoRef}
                className="absolute inset-0 w-full h-full object-cover"
                loop
                muted
                playsInline
                preload="metadata"
                style={{
                    opacity: isSpeaking && isConnected ? 1 : 0.7,
                    transition: 'opacity 0.3s ease',
                    zIndex: hasPlayedIntro ? 1 : 0,
                    display: hasPlayedIntro ? 'block' : 'none'
                }}
            >
                <source src={videoSources[selectedGender].muted} type="video/mp4" />
                Your browser does not support the video tag.
            </video>

            {/* Unmuted Video - Plays Once on First Load */}
            <video
                ref={unmutedVideoRef}
                className="absolute inset-0 w-full h-full object-cover"
                muted={false}
                playsInline
                preload="metadata"
                onEnded={handleUnmutedVideoEnd}
                style={{
                    zIndex: 2,
                    display: hasPlayedIntro ? 'none' : 'block'
                }}
            >
                <source src={videoSources[selectedGender].unmuted} type="video/mp4" />
                Your browser does not support the video tag.
            </video>

            {/* Connection Status Indicator */}
            <div className="absolute bottom-2 left-2 z-10">
                <div className={`w-3 h-3 rounded-full ${
                    isConnected 
                        ? 'bg-green-500 animate-pulse' 
                        : 'bg-gray-400'
                }`} />
            </div>

            {/* Speaking Indicator */}
            {isSpeaking && isConnected && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute bottom-2 right-2 z-10"
                >
                    <div className="flex space-x-1">
                        <div className="w-1 h-4 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                        <div className="w-1 h-4 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                        <div className="w-1 h-4 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default VoiceCoachVideo;