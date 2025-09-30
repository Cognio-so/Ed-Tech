"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { User, Users } from 'lucide-react';

const VoiceCoachVideo = ({ 
    isSpeaking = false, 
    isConnected = false,
    onFirstLoad = false,
    isUserSpeaking = false
}) => {
    const [selectedGender, setSelectedGender] = useState('female');
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

    // Handle muted video playback based on connection and user speaking
    useEffect(() => {
        const mutedVideo = mutedVideoRef.current;
        if (!mutedVideo) return;

        if (isConnected && !isUserSpeaking) {
            // Play when connected and user is not speaking
            mutedVideo.play().catch(console.error);
        } else {
            // Pause when disconnected or user is speaking
            mutedVideo.pause();
        }
    }, [isConnected, isUserSpeaking]);

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

    const handleGenderChange = (gender) => {
        setSelectedGender(gender);
        setHasPlayedIntro(false);
        
        const mutedVideo = mutedVideoRef.current;
        const unmutedVideo = unmutedVideoRef.current;
        
        if (mutedVideo) {
            mutedVideo.src = videoSources[gender].muted;
            mutedVideo.load(); 
            console.log('Loading muted video:', videoSources[gender].muted);
        }
        
        if (unmutedVideo) {
            unmutedVideo.src = videoSources[gender].unmuted;
            unmutedVideo.load(); 
            unmutedVideo.currentTime = 0;
            unmutedVideo.style.display = 'block';
        }
        
        // Play intro video again when gender changes
        setTimeout(() => {
            if (unmutedVideo) {
                unmutedVideo.play().catch(console.error);
            }
        }, 200); 
    };

    
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
            {/* Gender Selection */}
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

            {/* Muted Video */}
            <video
                ref={mutedVideoRef}
                className="absolute inset-0 w-full h-full object-cover"
                loop
                muted
                playsInline
                preload="metadata"
                style={{
                    opacity: isConnected && !isUserSpeaking ? 1 : 0.7,
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