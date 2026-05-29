"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, User, Bot, AlertTriangle, ShieldAlert } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface CoPilotChatProps {
  journeyId: string;
  currentSpeed?: number;
  fuelPct?: number;
  elapsedTime?: string;
  currentSegment?: string;
  origin?: string;
  destination?: string;
}

export default function CoPilotChat({
  journeyId,
  currentSpeed = 0,
  fuelPct = 100,
  elapsedTime = "0h 0m",
  currentSegment = "Analyzing segment...",
  origin = "",
  destination = ""
}: CoPilotChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [riderName, setRiderName] = useState("Arjun");
  const [contactName, setContactName] = useState("Priya");

  useEffect(() => {
    async function loadSettings() {
      try {
        const uid = localStorage.getItem("firebase_uid");
        if (!uid) return;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const res = await fetch(`${apiUrl}/api/user/settings?firebase_uid=${uid}`);
        if (res.ok) {
          const data = await res.json();
          if (data.full_name) {
            const firstName = data.full_name.split(" ")[0];
            setRiderName(firstName);
          }
          if (data.emergency_contacts && data.emergency_contacts.length > 0) {
            const firstContact = data.emergency_contacts[0].name.split(" ")[0];
            setContactName(firstContact);
          }
        }
      } catch (err) {
        console.error("Error loading settings in copilot chat:", err);
      }
    }
    loadSettings();
  }, []);

  useEffect(() => {
    setMessages((prev) => {
      const routeText = origin && destination ? ` from ${origin} to ${destination}` : "";
      const dynamicGreeting = `Hello ${riderName}. I am RideGuardian AI, your co-pilot. I am monitoring your route${routeText}. Ask me anything, or tap a quick action below.`;
      
      if (prev.length <= 1) {
        return [
          {
            role: "assistant",
            content: dynamicGreeting
          }
        ];
      }
      return prev;
    });
  }, [riderName, origin, destination]);

  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isGenerating) return;
    
    // Add user message
    const updatedMessages = [...messages, { role: "user", content: text } as Message];
    setMessages(updatedMessages);
    setInput("");
    setIsGenerating(true);

    // Add empty placeholder assistant message for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "", isStreaming: true }]);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${apiUrl}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journey_id: journeyId, message: text })
      });

      if (!response.ok) {
        throw new Error("Server error");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          
          // SSE messages arrive formatted as "data: text\n\n"
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                break;
              }
              assistantText += data;
              
              // Update the last message in state
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && last.role === "assistant") {
                  last.content = assistantText;
                }
                return copy;
              });
            }
          }
        }
      }
      
      // Clear streaming flag
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          last.isStreaming = false;
        }
        return copy;
      });

    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          last.content = "Connection error. Please try again.";
          last.isStreaming = false;
        }
        return copy;
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuickAction = (actionText: string) => {
    sendMessage(actionText);
  };

  return (
    <div className="flex flex-col h-full bg-guardian-card border border-guardian-border rounded-xl overflow-hidden glass-panel">
      
      {/* Telemetry Context Bar */}
      <div className="grid grid-cols-4 border-b border-guardian-border bg-guardian-bg/40 p-2 text-center text-[10px] uppercase font-bold tracking-wider text-guardian-muted">
        <div className="border-r border-guardian-border/30">
          <span className="block text-[8px] text-guardian-muted">Speed</span>
          <span className="text-xs text-guardian-accent font-mono">{Math.round(currentSpeed)} km/h</span>
        </div>
        <div className="border-r border-guardian-border/30">
          <span className="block text-[8px] text-guardian-muted">Fuel</span>
          <span className={`text-xs font-mono ${fuelPct < 30 ? 'text-guardian-critical' : 'text-guardian-safe'}`}>
            {fuelPct}%
          </span>
        </div>
        <div className="border-r border-guardian-border/30">
          <span className="block text-[8px] text-guardian-muted">Duration</span>
          <span className="text-xs text-guardian-text font-mono">{elapsedTime}</span>
        </div>
        <div>
          <span className="block text-[8px] text-guardian-muted">Active Zone</span>
          <span className="text-[10px] text-orange-400 truncate block px-1" title={currentSegment}>
            {currentSegment}
          </span>
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 min-h-[300px]">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {/* Avatar */}
            <div className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${
              msg.role === "user" ? "bg-guardian-accent" : "bg-guardian-card border border-guardian-border"
            }`}>
              {msg.role === "user" ? (
                <User size={14} className="text-white" />
              ) : (
                <Bot size={14} className="text-guardian-safe" />
              )}
            </div>
            
            {/* Bubble */}
            <div className={`flex flex-col max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`rounded-xl px-3.5 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-guardian-accent text-white rounded-tr-none"
                  : "bg-guardian-bg text-guardian-text border border-guardian-border rounded-tl-none"
              }`}>
                <p className="leading-relaxed font-sans">{msg.content}</p>
                {msg.isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-1 bg-guardian-safe animate-pulse align-middle"></span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* Quick Action Chips */}
      <div className="px-4 py-2 bg-guardian-bg/20 border-t border-guardian-border/30 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
        <button
          onClick={() => handleQuickAction(`Should I stop before ${destination || "destination"}?`)}
          disabled={isGenerating}
          id="btn-quick-stop"
          className="text-xs bg-guardian-bg hover:bg-guardian-border border border-guardian-border hover:border-guardian-accent text-guardian-text px-3 py-1.5 rounded-full transition shrink-0"
        >
          🛑 Stop before {destination || "destination"}?
        </button>
        <button
          onClick={() => handleQuickAction(`What is the weather looking like near ${destination || "destination"}?`)}
          disabled={isGenerating}
          id="btn-quick-weather"
          className="text-xs bg-guardian-bg hover:bg-guardian-border border border-guardian-border hover:border-guardian-accent text-guardian-text px-3 py-1.5 rounded-full transition shrink-0"
        >
          🌧 Weather near {destination || "destination"}
        </button>
        <button
          onClick={() => handleQuickAction("How many km until the next fuel station?")}
          disabled={isGenerating}
          id="btn-quick-fuel"
          className="text-xs bg-guardian-bg hover:bg-guardian-border border border-guardian-border hover:border-guardian-accent text-guardian-text px-3 py-1.5 rounded-full transition shrink-0"
        >
          ⛽ Next fuel stop?
        </button>
        <button
          onClick={() => handleQuickAction(`Send my location to ${contactName}`)}
          disabled={isGenerating}
          id="btn-quick-location"
          className="text-xs bg-guardian-bg hover:bg-guardian-border border border-guardian-border hover:border-guardian-accent text-guardian-text px-3 py-1.5 rounded-full transition shrink-0"
        >
          📍 Share location with {contactName}
        </button>
      </div>

      {/* Bottom Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="p-3 border-t border-guardian-border bg-guardian-card/40 flex items-center gap-2"
      >
        <input
          type="text"
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isGenerating}
          placeholder={isGenerating ? "Co-Pilot is typing..." : "Talk to Co-Pilot (e.g. fuel, weather)..."}
          className="flex-1 bg-guardian-bg border border-guardian-border rounded-lg px-3.5 py-2 text-sm text-guardian-text placeholder:text-guardian-muted focus:outline-none focus:border-guardian-accent transition disabled:opacity-50"
        />
        <button
          type="submit"
          id="chat-submit"
          disabled={isGenerating || !input.trim()}
          className="p-2 rounded-lg bg-guardian-accent hover:bg-blue-600 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
