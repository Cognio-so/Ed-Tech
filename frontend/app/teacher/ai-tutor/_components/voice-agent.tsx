"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceStream } from "@/hooks/use-voice-stream";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface VoiceAgentProps {
  sessionId: string;
  teacherId: string;
  teacherName?: string;
}

export default function VoiceAgent({
  sessionId,
  teacherId,
  teacherName,
}: VoiceAgentProps) {
  const { status, isRecording, error, connect, disconnect, toggleMute } =
    useVoiceStream();

  const [grade, setGrade] = useState("General");
  const [subject, setSubject] = useState("");
  const [instructions, setInstructions] = useState("");
  const [voice, setVoice] = useState<"alloy" | "echo" | "shimmer">("shimmer");

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const isDisconnected = status === "disconnected" || status === "idle";

  const handleConnect = async () => {
    await connect({
      sessionId,
      teacherId,
      teacherName: teacherName || "Teacher",
      grade,
      subject,
      instructions,
      voice,
    });
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  const handleToggleMute = () => {
    const isMuted = toggleMute();
    console.log(isMuted ? "Unmuted" : "Muted");
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div
              className={cn(
                "size-3 rounded-full",
                isConnected && "bg-green-500 animate-pulse",
                isConnecting && "bg-yellow-500 animate-pulse",
                isDisconnected && "bg-gray-400"
              )}
            />
            AI Voice Assistant
          </CardTitle>
          <CardDescription>
            Have a voice conversation with your AI teaching assistant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isConnected && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-600">
                Connected - You can now speak with the AI assistant
              </AlertDescription>
            </Alert>
          )}

          {/* Configuration Form */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="grade">Grade Level</Label>
                <Input
                  id="grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g., Grade 5"
                  disabled={isConnected || isConnecting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject (Optional)</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Mathematics"
                  disabled={isConnected || isConnecting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="voice">Voice</Label>
              <Select
                value={voice}
                onValueChange={(v: any) => setVoice(v)}
                disabled={isConnected || isConnecting}
              >
                <SelectTrigger id="voice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shimmer">Shimmer (Friendly)</SelectItem>
                  <SelectItem value="alloy">Alloy (Professional)</SelectItem>
                  <SelectItem value="echo">Echo (Clear)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">
                Special Instructions (Optional)
              </Label>
              <Textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Any specific focus or context for this session..."
                rows={3}
                disabled={isConnected || isConnecting}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 pt-4">
            {isDisconnected && (
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                size="lg"
                className="gap-2"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Phone className="h-5 w-5" />
                    Start Voice Chat
                  </>
                )}
              </Button>
            )}

            {isConnected && (
              <>
                <Button
                  onClick={handleToggleMute}
                  variant={isRecording ? "default" : "secondary"}
                  size="lg"
                  className="gap-2"
                >
                  {isRecording ? (
                    <>
                      <Mic className="h-5 w-5" />
                      Mute
                    </>
                  ) : (
                    <>
                      <MicOff className="h-5 w-5" />
                      Unmute
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleDisconnect}
                  variant="destructive"
                  size="lg"
                  className="gap-2"
                >
                  <PhoneOff className="h-5 w-5" />
                  End Call
                </Button>
              </>
            )}
          </div>

          {/* Status Text */}
          <div className="text-center text-sm text-muted-foreground">
            {isDisconnected && "Configure settings and click Start Voice Chat"}
            {isConnecting && "Establishing connection..."}
            {isConnected && isRecording && "🎤 Listening... Speak now"}
            {isConnected && !isRecording && "🔇 Microphone muted"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
