"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface LiveWaveformProps {
  active?: boolean;
  processing?: boolean;
  height?: number;
  barWidth?: number;
  barGap?: number;
  mode?: "static" | "scrolling";
  fadeEdges?: boolean;
  barColor?: "gray" | "blue" | "green" | "purple" | "primary";
  historySize?: number;
  className?: string;
}

export function LiveWaveform({
  active = false,
  processing = false,
  height = 80,
  barWidth = 3,
  barGap = 2,
  mode = "static",
  fadeEdges = true,
  barColor = "primary",
  historySize = 120,
  className,
}: LiveWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const historyRef = useRef<number[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Color mappings with vibrant, modern colors
  const colorMap = {
    gray: "rgb(156, 163, 175)",
    blue: "rgb(59, 130, 246)",
    green: "rgb(34, 197, 94)",
    purple: "rgb(168, 85, 247)",
    primary: "hsla(35, 83%, 53%, 0.96)", // Modern vibrant blue
  };

  useEffect(() => {
    if (active && !isInitialized) {
      initializeAudio();
    } else if (!active && isInitialized) {
      cleanup();
    }

    return () => {
      cleanup();
    };
  }, [active, isInitialized]);

  const initializeAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;

      setIsInitialized(true);
      draw();
    } catch (error) {
      console.error("Error initializing audio:", error);
    }
  };

  const cleanup = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    dataArrayRef.current = null;
    historyRef.current = [];
    setIsInitialized(false);
  };

  const draw = () => {
    if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // @ts-expect-error - Web Audio API typing limitation
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);

    // Calculate average amplitude
    const average =
      dataArrayRef.current.reduce((sum, value) => sum + value, 0) /
      dataArrayRef.current.length;

    // Normalize to 0-1 range
    const normalizedValue = average / 255;

    // Update history
    if (mode === "scrolling") {
      historyRef.current.push(normalizedValue);
      if (historyRef.current.length > historySize) {
        historyRef.current.shift();
      }
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barCount = Math.floor(canvas.width / (barWidth + barGap));

    if (processing) {
      drawProcessing(ctx, canvas, barCount);
    } else if (mode === "scrolling") {
      drawScrolling(ctx, canvas, barCount);
    } else {
      drawStatic(ctx, canvas, barCount, normalizedValue);
    }

    animationRef.current = requestAnimationFrame(draw);
  };

  const drawProcessing = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    barCount: number
  ) => {
    const time = Date.now() / 1000;
    const centerX = canvas.width / 2;

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + barGap);
      const distanceFromCenter = Math.abs(x - centerX);
      const maxDistance = canvas.width / 2;
      const normalizedDistance = distanceFromCenter / maxDistance;

      const wave = Math.sin(time * 2 + i * 0.3) * 0.5 + 0.5;
      const barHeight = Math.max(
        10,
        canvas.height * wave * (1 - normalizedDistance * 0.5)
      );

      const y = (canvas.height - barHeight) / 2;

      let opacity = 1;
      if (fadeEdges) {
        opacity = 1 - normalizedDistance * 0.7;
      }

      ctx.fillStyle = `${colorMap[barColor]}`;
      ctx.globalAlpha = opacity;
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    ctx.globalAlpha = 1;
  };

  const drawScrolling = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    barCount: number
  ) => {
    const history = historyRef.current;
    const startIndex = Math.max(0, history.length - barCount);

    for (let i = 0; i < Math.min(barCount, history.length); i++) {
      const value = history[startIndex + i] || 0;
      const barHeight = Math.max(8, value * canvas.height * 0.8);
      const x = i * (barWidth + barGap);
      const y = (canvas.height - barHeight) / 2;

      let opacity = 1;
      if (fadeEdges) {
        const age = history.length - (startIndex + i);
        opacity = Math.max(0.3, 1 - age / barCount);
      }

      ctx.fillStyle = `${colorMap[barColor]}`;
      ctx.globalAlpha = opacity;
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    ctx.globalAlpha = 1;
  };

  const drawStatic = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    barCount: number,
    intensity: number
  ) => {
    const centerX = canvas.width / 2;

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + barGap);
      const distanceFromCenter = Math.abs(x - centerX);
      const maxDistance = canvas.width / 2;
      const normalizedDistance = distanceFromCenter / maxDistance;

      const randomFactor = Math.random() * 0.5 + 0.5;
      const audioFactor = intensity * 0.8 + 0.2;
      const heightFactor =
        randomFactor * audioFactor * (1 - normalizedDistance * 0.3);

      const barHeight = Math.max(8, canvas.height * heightFactor);
      const y = (canvas.height - barHeight) / 2;

      let opacity = 1;
      if (fadeEdges) {
        opacity = 1 - normalizedDistance * 0.5;
      }

      ctx.fillStyle = `${colorMap[barColor]}`;
      ctx.globalAlpha = opacity;
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    ctx.globalAlpha = 1;
  };

  return (
    <div className={cn("relative w-full", className)}>
      <canvas
        ref={canvasRef}
        width={800}
        height={height}
        className="w-full h-full"
        style={{ height: `${height}px` }}
      />
      {!active && (
        <div
          className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm"
          style={{ height: `${height}px` }}
        >
          {processing ? "" : ""}
        </div>
      )}
    </div>
  );
}
