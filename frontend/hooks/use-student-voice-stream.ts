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

  useEffect(() => {
    // Initialize audio element once
    if (!remoteAudioRef.current) {
      const audio = new Audio();
      audio.autoplay = true;
      remoteAudioRef.current = audio;
    }

    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  }, []);

  const connect = useCallback(async (config: StudentVoiceStreamConfig) => {
    try {
      // 1. Clean up previous sessions
      cleanup();
      
      console.log("🎤 Starting optimized voice connection...", config);
      setStatus("connecting");
      setError(null);
      configRef.current = config;

      // 2. Get User Media immediately
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 16000, 
          channelCount: 1,
        },
      });
      localStreamRef.current = stream;

      // 3. Create Peer Connection with faster ICE config
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        iceCandidatePoolSize: 10, // Pre-fetch candidates
      });
      peerConnectionRef.current = pc;

      // 4. Add Tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 5. Setup Remote Audio Handling
      pc.ontrack = (event) => {
        if (event.track.kind === "audio" && remoteAudioRef.current) {
          const remoteStream = new MediaStream([event.track]);
          remoteAudioRef.current.srcObject = remoteStream;
          // Force play in case of browser autoplay policies
          remoteAudioRef.current.play().catch(e => console.log("Autoplay blocked:", e));
        }
      };

      // 6. Setup Data Channel
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;
      setupDataChannelListeners(dc, configRef);

      // 7. Create Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // --- KEY FIX: REMOVED "WAIT FOR ICE COMPLETE" ---
      // We send the offer immediately. This saves 2-4 seconds.

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

      // 8. Send Request
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const answer = await response.json();

      // 9. Set Remote Description
      await pc.setRemoteDescription(
        new RTCSessionDescription({
          sdp: answer.sdp,
          type: answer.type as RTCSdpType,
        })
      );

      setStatus("connected");
      setIsRecording(true);
      toast.success("Study Buddy connected!");

    } catch (err: any) {
      console.error("Connection failed:", err);
      setStatus("error");
      setError(err.message);
      toast.error("Connection failed. Please try again.");
      cleanup();
    }
  }, [cleanup]);

  const setupDataChannelListeners = (dc: RTCDataChannel, configRef: any) => {
    dc.onopen = () => console.log("✅ Data channel open");
    
    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle Assistant Transcript
        if (data.type === "response.audio_transcript.done" || data.type === "response.audio_transcript.chunk") {
           const text = data.transcript?.trim();
           if(text) configRef.current?.onTranscription?.(text, "assistant");
        } 
        // Handle User Transcript (Correction)
        else if (data.type === "input.audio_transcript.done") {
           const text = data.transcript?.trim();
           if(text) configRef.current?.onTranscription?.(text, "user");
        }
        // Handle RAG Status
        else if (data.type === "rag_status") {
           configRef.current?.onTranscription?.(data.message || "Searching...", "assistant");
        }
      } catch (e) {
        console.error("DC Message Parse Error", e);
      }
    };
  };

  const disconnect = useCallback(async () => {
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
        return audioTrack.enabled;
      }
    }
    return false;
  }, []);

  return { status, isRecording, error, connect, disconnect, toggleMute };
}