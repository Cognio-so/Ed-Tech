"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface StudentVoiceStreamConfig {
  sessionId: string;
  studentId?: string;
  studentName?: string;
  grade?: string;
  subject?: string;
  pendingAssignments?: Array<Record<string, any>>;
  completedAssignments?: Array<Record<string, any>>;
  voice?: "alloy" | "echo" | "shimmer";
  onTranscription?: (text: string, role: "user" | "assistant") => void;
}

export type VoiceStreamStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export function useStudentVoiceStream() {
  const [status, setStatus] = useState<VoiceStreamStatus>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const configRef = useRef<StudentVoiceStreamConfig | null>(null);
  const isConnectingRef = useRef<boolean>(false);
  const recognitionRef = useRef<any>(null); // For local speech to text

  const cleanup = useCallback(() => {
    isConnectingRef.current = false;
    
    // Stop Speech Recognition
    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (dataChannelRef.current) {
      try { dataChannelRef.current.close(); } catch {}
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      try { peerConnectionRef.current.close(); } catch {}
      peerConnectionRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!remoteAudioRef.current) {
      const audio = new Audio();
      audio.autoplay = true;
      // CRITICAL: Prevent audio from dropping frames
      audio.preload = "auto";
      // Ensure audio doesn't pause/buffer unnecessarily
      audio.addEventListener("ended", () => {
        console.log("🔚 Audio ended - this should not happen during active stream");
      });
      audio.addEventListener("pause", () => {
        console.warn("⏸️ Audio paused unexpectedly");
        // Try to resume if paused unexpectedly
        audio.play().catch(console.error);
      });
      remoteAudioRef.current = audio;
    }
    return () => cleanup();
  }, [cleanup]);

  const connect = useCallback(async (config: StudentVoiceStreamConfig) => {
    if (isConnectingRef.current) return;

    try {
      cleanup();
      isConnectingRef.current = true;
      console.log("🎤 Starting optimized voice connection...", config);
      setStatus("connecting");
      setError(null);
      configRef.current = config;

      // 1. Setup Local Speech Recognition (For instant User UI updates)
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigator.language || 'en-US'; 
        
        // We use this only for visual feedback if needed, 
        // or rely on the backend "input.audio_transcript.done" for the final log.
        recognitionRef.current = recognition;
      }

      // 2. Get User Media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, 
        },
      });
      localStreamRef.current = stream;

      // 3. Create Peer Connection (Supports TURN via env vars if provided)
      const iceServers: RTCIceServer[] = [
        { urls: "stun:stun.l.google.com:19302" },
      ];
      
      const turnUrl = process.env.NEXT_PUBLIC_TURN_SERVER_URL;
      const turnUsername = process.env.NEXT_PUBLIC_TURN_SERVER_USERNAME;
      const turnPassword = process.env.NEXT_PUBLIC_TURN_SERVER_PASSWORD;
      
      if (turnUrl && turnUsername && turnPassword) {
        iceServers.push({
          urls: turnUrl,
          username: turnUsername,
          credential: turnPassword,
        });
      }
      
      const pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 10 });
      peerConnectionRef.current = pc;
      
      pc.onconnectionstatechange = () => {
        console.log(`🕸️ Connection State: ${pc.connectionState}`);
        if (pc.connectionState === "failed") {
          setStatus("error");
          setError("Connection failed. Check network.");
        }
      };
      
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (event.track.kind === "audio" && remoteAudioRef.current) {
          console.log("📥 Received remote audio track, setting up playback...");
          const remoteStream = new MediaStream([event.track]);
          remoteAudioRef.current.srcObject = remoteStream;
          
          // CRITICAL: Ensure audio plays and doesn't drop frames
          remoteAudioRef.current.play().catch((e) => {
            console.error("❌ Audio play error:", e);
          });
          
          // Monitor audio element to ensure it's playing
          remoteAudioRef.current.onloadedmetadata = () => {
            console.log("✅ Audio metadata loaded");
          };
          
          remoteAudioRef.current.oncanplay = () => {
            console.log("✅ Audio can play");
          };
          
          // Log when audio starts/stops
          event.track.onended = () => {
            console.log("🔚 Remote audio track ended");
          };
          
          event.track.onmute = () => {
            console.warn("🔇 Remote audio track muted");
          };
          
          event.track.onunmute = () => {
            console.log("🔊 Remote audio track unmuted");
          };
        }
      };

      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;
      setupDataChannelListeners(dc, configRef);

      // 4. Create Offer & Optimize ICE Gathering
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // OPTIMIZATION: Wait max 1000ms for ICE candidates
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
          return;
        }
        
        const checkState = () => {
          if (pc.iceGatheringState === "complete") {
            pc.removeEventListener("icegatheringstatechange", checkState);
            resolve();
          }
        };
        
        pc.addEventListener("icegatheringstatechange", checkState);
        
        // Timeout after 1s to speed up connection
        setTimeout(() => {
            pc.removeEventListener("icegatheringstatechange", checkState);
            console.log("⚡ ICE Gathering timed out, sending candidates found so far...");
            resolve();
        }, 1000);
      });

      const payload = {
        sdp: pc.localDescription!.sdp,
        type: pc.localDescription!.type,
        student_name: config.studentName || "Student",
        grade: config.grade || "General",
        subject: config.subject || "",
        pending_assignments: config.pendingAssignments || [],
        completed_assignments: config.completedAssignments || [],
        voice: config.voice || "shimmer",
      };

      const endpoint = `${BACKEND_URL}/api/student/${config.studentId}/session/${config.sessionId}/voice_agent/connect`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const answer = await response.json();

      await pc.setRemoteDescription(new RTCSessionDescription({
            sdp: answer.sdp,
            type: answer.type as RTCSdpType,
      }));

      // Start local recognition once connected
      if (recognitionRef.current) {
          try { recognitionRef.current.start(); } catch {}
      }

      isConnectingRef.current = false;
      setStatus("connected");
      setIsRecording(true);
      toast.success("Study Buddy connected!");

    } catch (err: any) {
      isConnectingRef.current = false;
      console.error("❌ Connection failed:", err);
      setStatus("error");
      setError(err.message);
      toast.error("Connection failed");
      cleanup();
    }
  }, [cleanup]);

  const setupDataChannelListeners = (dc: RTCDataChannel, configRef: any) => {
    dc.onopen = () => console.log("✅ Data channel open");
    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Assistant Text - Only handle chunks for streaming, ignore done to prevent duplicates
        if (data.type === "response.audio_transcript.chunk") {
           const text = data.transcript?.trim();
           if(text) configRef.current?.onTranscription?.(text, "assistant");
        } 
        // User Text (Gemini Detected)
        else if (data.type === "input.audio_transcript.done") {
           const text = data.transcript?.trim();
           if(text) configRef.current?.onTranscription?.(text, "user");
        }
      } catch (e) {
        console.error("DC Message Parse Error", e);
      }
    };
  };

  const disconnect = useCallback(async () => {
    isConnectingRef.current = false;
    cleanup();
    setStatus("disconnected");
    setIsRecording(false);
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsRecording(audioTrack.enabled);
        
        // Toggle Speech Recognition too
        if (audioTrack.enabled && recognitionRef.current) {
             try { recognitionRef.current.start(); } catch {}
        } else if (!audioTrack.enabled && recognitionRef.current) {
             try { recognitionRef.current.stop(); } catch {}
        }
        return audioTrack.enabled;
      }
    }
    return false;
  }, []);

  return { status, isRecording, error, connect, disconnect, toggleMute };
}