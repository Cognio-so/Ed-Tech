"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

export interface VoiceStreamConfig {
  sessionId: string;
  teacherId?: string;
  teacherName?: string;
  grade?: string;
  subject?: string;
  instructions?: string;
  voice?: "alloy" | "echo" | "shimmer";
  onTranscription?: (text: string, role: "user" | "assistant") => void;
}

export type VoiceStreamStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export function useVoiceStream() {
  const [status, setStatus] = useState<VoiceStreamStatus>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const configRef = useRef<VoiceStreamConfig | null>(null);

  // Initialize remote audio element
  useEffect(() => {
    if (!remoteAudioRef.current) {
      const audio = new Audio();
      audio.autoplay = true;
      remoteAudioRef.current = audio;
    }

    return () => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      }
    };
  }, []);

  const connect = useCallback(async (config: VoiceStreamConfig) => {
    try {
      console.log("🎤 Starting voice connection...", config);
      setStatus("connecting");
      setError(null);
      configRef.current = config;

      // Get user microphone
      console.log("🎙️ Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      console.log("✅ Microphone access granted");

      localStreamRef.current = stream;

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      peerConnectionRef.current = pc;

      // Add local audio track
      console.log("➕ Adding local audio tracks to peer connection...");
      stream.getTracks().forEach((track) => {
        console.log("🎵 Adding track:", track.kind, track.label);
        pc.addTrack(track, stream);
      });

      // Handle remote audio tracks
      pc.ontrack = (event) => {
        console.log(
          "📥 Received remote track:",
          event.track.kind,
          event.streams
        );
        if (event.track.kind === "audio" && remoteAudioRef.current) {
          const remoteStream = new MediaStream([event.track]);
          remoteAudioRef.current.srcObject = remoteStream;
          console.log("🔊 Remote audio connected to audio element");
        }
      };

      // Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log("ICE Connection State:", pc.iceConnectionState);
        if (
          pc.iceConnectionState === "disconnected" ||
          pc.iceConnectionState === "failed"
        ) {
          setStatus("disconnected");
          toast.error("Voice connection lost");
        }
      };

      // Create data channel for events
      console.log("📡 Creating data channel...");
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log("✅ Data channel opened - Connection ready!");
        setStatus("connected");
        setIsRecording(true);
        toast.success("Voice agent connected");
      };

      dc.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📩 Received event:", data.type);

          // Handle transcriptions if needed
          if (
            data.type ===
            "conversation.item.input_audio_transcription.completed"
          ) {
            const transcript = data.transcript?.trim();
            if (transcript) {
              console.log("🗣️ Teacher:", transcript);
              // Call transcription callback
              if (configRef.current?.onTranscription) {
                configRef.current.onTranscription(transcript, "user");
              }
            }
          } else if (data.type === "response.audio_transcript.done") {
            const transcript = data.transcript?.trim();
            if (transcript) {
              console.log("🤖 AI Agent:", transcript);
              // Call transcription callback
              if (configRef.current?.onTranscription) {
                configRef.current.onTranscription(transcript, "assistant");
              }
            }
          } else if (data.type === "error") {
            console.error("❌ Received error event:", data);
          }
        } catch (err) {
          console.error("Error parsing data channel message:", err);
        }
      };

      dc.onerror = (err) => {
        console.error("❌ Data channel error:", err);
        setError("Communication error occurred");
      };

      dc.onclose = () => {
        console.log("📪 Data channel closed");
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", checkState);
              resolve();
            }
          };
          pc.addEventListener("icegatheringstatechange", checkState);
        }
      });

      // Send offer to backend
      const payload = {
        sdp: pc.localDescription!.sdp,
        type: pc.localDescription!.type,
        teacher_name: config.teacherName || "Teacher",
        grade: config.grade || "General",
        instructions: config.instructions || "",
        voice: config.voice || "shimmer",
      };

      const endpoint = `/api/teacher/${config.teacherId}/session/${config.sessionId}/voice_agent/connect`;

      console.log("🔊 Sending voice connection request to:", endpoint);
      console.log("📦 Payload:", payload);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("📡 Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Error response:", errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText };
        }
        throw new Error(
          errorData.detail || `Failed to connect: ${response.status}`
        );
      }

      const answer = await response.json();
      console.log("✅ Received answer from backend:", answer);

      // Set remote description
      await pc.setRemoteDescription(
        new RTCSessionDescription({
          sdp: answer.sdp,
          type: answer.type as RTCSdpType,
        })
      );

      console.log("🎉 Voice connection established successfully");
    } catch (err: any) {
      console.error("💥 Voice connection error:", err);
      setStatus("error");
      setError(err.message || "Failed to connect voice agent");
      toast.error(err.message || "Failed to connect voice agent");

      // Cleanup on error
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      // Stop recording
      setIsRecording(false);

      // Close data channel
      if (dataChannelRef.current) {
        dataChannelRef.current.close();
        dataChannelRef.current = null;
      }

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Stop remote audio
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      }

      // Notify backend
      if (configRef.current) {
        const endpoint = `/api/teacher/${configRef.current.teacherId}/session/${configRef.current.sessionId}/voice_agent/disconnect`;
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }).catch(() => {
          // Ignore disconnect errors
        });
      }

      setStatus("disconnected");
      toast.info("Voice agent disconnected");
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  }, []);

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

  return {
    status,
    isRecording,
    error,
    connect,
    disconnect,
    toggleMute,
  };
}
