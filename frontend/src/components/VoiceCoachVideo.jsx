"use client";

import React, { useState, useRef, useEffect } from 'react';

const VoiceCoachVideo = ({ 
    isSpeaking = false, 
    isConnected = false,
    selectedGender = 'female', // NEW: Receive gender from parent
    isUserSpeaking = false // NEW: Add missing prop (kept for compatibility but not used)
}) => {
    const [hasPlayedIntro, setHasPlayedIntro] = useState(false);
    
    const mutedVideoRef = useRef(null);
    const unmutedVideoRef = useRef(null);
    
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

    // SIMPLIFIED: Handle muted video playback based ONLY on connection
    useEffect(() => {
        const mutedVideo = mutedVideoRef.current;
        if (!mutedVideo) return;

        if (isConnected) {
            // Play when connected
            mutedVideo.play().catch(console.error);
        } else {
            // Pause when disconnected
            mutedVideo.pause();
        }
    }, [isConnected]);

    // REMOVED: The unmuted video useEffect that was playing during connection
    // The unmuted video should only play during intro, not during connection

    useEffect(() => {
        const unmutedVideo = unmutedVideoRef.current;
        if (!unmutedVideo || hasPlayedIntro) return;

        const playIntro = () => {
            unmutedVideo.play()
                .then(() => {
                    console.log('Intro video started playing');
                })
                .catch((error) => {
                    console.log('Intro video autoplay blocked:', error);
                    setHasPlayedIntro(true);
                });
        };

        const timer = setTimeout(playIntro, 500);
        return () => clearTimeout(timer);
    }, []); 

    // REMOVED: The isSpeaking useEffect - no longer needed

    // NEW: Update video sources when gender changes
    useEffect(() => {
        const mutedVideo = mutedVideoRef.current;
        const unmutedVideo = unmutedVideoRef.current;
        
        if (mutedVideo) {
            mutedVideo.src = videoSources[selectedGender].muted;
            mutedVideo.load();
        }
        
        if (unmutedVideo) {
            unmutedVideo.src = videoSources[selectedGender].unmuted;
            unmutedVideo.load();
        }
    }, [selectedGender]);

    const handleUnmutedVideoEnd = () => {
        console.log('Intro video ended');
        setHasPlayedIntro(true);
        if (unmutedVideoRef.current) {
            unmutedVideoRef.current.style.display = 'none';
        }
        
        if (mutedVideoRef.current) {
            mutedVideoRef.current.style.display = 'block';
        }
    };

    return (
        <div className="relative w-[400px] h-[550px] overflow-hidden bg-transparent rounded-md">
            {/* Muted Video */}
            <video
                ref={mutedVideoRef}
                className="absolute inset-0 w-full h-full object-cover"
                loop
                muted
                playsInline
                preload="metadata"
                style={{
                    opacity: isConnected ? 1 : 0.7,
                    transition: 'opacity 0.3s ease',
                    zIndex: hasPlayedIntro ? 1 : 0,
                    display: hasPlayedIntro ? 'block' : 'none'
                }}
            >
                <source src={videoSources[selectedGender].muted} type="video/mp4" />
                Your browser does not support the video tag.
            </video>

            {/* Unmuted Video - ONLY for intro, not during connection */}
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
        </div>
    );
};

export default VoiceCoachVideo;