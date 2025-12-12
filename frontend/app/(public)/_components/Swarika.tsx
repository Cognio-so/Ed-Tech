"use client";

import React, { useState, useRef, FormEvent } from "react";
import Image from "next/image";
import { Check, Mic, Languages, Target, Clock, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
};

const INITIAL_ASSISTANT: Msg = {
  id: "m-0",
  role: "assistant",
  text: "Namaste! I am Swarika. I'm here to help you learn anything, in any language you like. What shall we explore today?",
};

const CARDS = [
  {
    title: "Voice-First Learning",
    desc: "Natural conversations, not robotic text",
    icon: <Mic className="w-5 h-5 text-primary" />,
  },
  {
    title: "12+ Languages",
    desc: "Hindi, Tamil, Telugu, Marathi & more",
    icon: <Languages className="w-5 h-5 text-primary" />,
  },
  {
    title: "Adaptive Teaching",
    desc: "Identifies weak areas automatically",
    icon: <Target className="w-5 h-5 text-primary" />,
  },
  {
    title: "Always Available",
    desc: "24/7, infinite patience, zero judgment",
    icon: <Clock className="w-5 h-5 text-primary" />,
  },
];

export default function SwarikaSection() {
  const [messages, setMessages] = useState<Msg[]>([INITIAL_ASSISTANT]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  function pushUserMessage(text: string) {
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((m) => [...m, userMsg]);
    return userMsg;
  }

  function pushAssistantMessage(text: string) {
    const asst: Msg = { id: `a-${Date.now()}`, role: "assistant", text };
    setMessages((m) => [...m, asst]);
    return asst;
  }

  function getHardcodedReply(userText: string) {
    const t = userText.trim().toLowerCase();

    if (!t) return "Please type something — I'm listening!";
    if (t.includes("fraction")) return "Fractions are parts of a whole...";
    if (t.includes("photosynthesis"))
      return "Photosynthesis is how plants convert sunlight...";
    if (t.includes("hello") || t.includes("hi"))
      return "Hello! How can I help you today?";
    if (t.includes("translate"))
      return "Tell me the sentence and target language.";

    return "Great question! Here's a short explanation...";
  }

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const value = input.trim();
    if (!value) return;

    pushUserMessage(value);
    setInput("");

    setTimeout(() => {
      pushAssistantMessage(getHardcodedReply(value));
      inputRef.current?.focus();
    }, 500);
  }

  return (
    <section className="bg-[#FFF6F0] py-16">
      <div
        className="
        max-w-7xl mx-auto px-6 
        grid grid-cols-1 lg:grid-cols-2 
        gap-20 xl:gap-28 
        items-start
      "
      >
        {/* LEFT TEXT SIDE */}
        <div className="pr-4">
          <Badge className="bg-[#FFE7D6] text-[#ff5b29] text-sm font-medium border-0">
            Meet Swarika
          </Badge>

          <h2 className="mt-6 text-4xl sm:text-5xl font-extrabold leading-tight">
            <span className="text-gray-800">The AI Tutor Who</span>
            <br />
            <span className="text-[#ff5b29]">Never Gives Up</span>
          </h2>

          <p className="mt-6 text-lg text-gray-700 max-w-xl">
            Every child deserves someone who&apos;s always there, always
            patient, and speaks in a way they understand. Swarika explains
            complex concepts through natural conversation—in their native
            language.
          </p>

          <div className="mt-8 space-y-4">
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <p className="text-gray-700">
                <span className="font-semibold">Multilingual:</span> Hindi,
                Marathi, Telugu & more
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <p className="text-gray-700">
                <span className="font-semibold">Patient:</span> Never loses
                temper or judges
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <p className="text-gray-700">
                <span className="font-semibold">Available 24/7:</span> Before
                school or late at night
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT CHAT UI */}
        <div className="pl-4">
          <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-100">
            {/* HEADER */}
            <div className="flex items-center gap-4 px-4 py-3 bg-[#FF6B2C] text-white">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-semibold">
                S
              </div>
              <div>
                <div className="font-semibold">Swarika</div>
                <div className="text-xs">
                  AI Tutor{" "}
                  <span className="text-green-500 animate-pulse">•</span> Online
                </div>
              </div>
            </div>

            {/* MESSAGES */}
            <div className="h-[420px] md:h-[480px] px-4 py-4 overflow-y-auto bg-white">
              <div className="space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.role === "assistant" ? "flex" : "flex justify-end"
                    }
                  >
                    {m.role === "assistant" ? (
                      <div className="max-w-[85%]">
                        <div className="bg-[#FFF4E8] text-sm text-[#07312CF2] p-3 rounded-lg">
                          {m.text.split("\n").map((line, i) => (
                            <p key={i} className="leading-relaxed">
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-[85%]">
                        <div className="bg-[#07312CF2] text-white text-sm p-3 rounded-lg">
                          {m.text}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* INPUT */}
            <form
              onSubmit={handleSubmit}
              className="px-4 py-4 border-t border-gray-100 bg-white flex items-center gap-3"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Swarika a question..."
                className="flex-1 rounded-full border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30"
                suppressHydrationWarning
              />

              <button
                type="submit"
                className="w-10 h-10 rounded-full bg-[#FF6B2C] text-white flex items-center justify-center shadow"
                suppressHydrationWarning
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          <p className="mt-3 text-center text-xs text-gray-400">
            Try asking about “Fractions” or “Photosynthesis”.
          </p>
        </div>
      </div>
    </section>
  );
}
