import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Send, RefreshCw, MessageSquare, Bot, ExternalLink } from "lucide-react";
import {
  sendToWebhook,
  loadIdentity,
  saveIdentity,
  loadHistory,
  saveHistory,
  clearHistory,
  buttonsFromStrings,
  type ChatMessage,
  type UserIdentity,
} from "@/services/chatbotApi";

const ERROR_MSG = "Server temporarily unavailable. Please try again.";

function extractPhoneFromText(text: string): string | null {
  const match = text.match(/(?:\+91|0)?[6-9]\d{9}/);
  return match ? match[0] : null;
}

function containsUrl(text: string) {
  return /https?:\/\/\S+/.test(text);
}

function renderContent(content: string) {
  if (!containsUrl(content)) return <span>{content}</span>;
  const parts = content.split(/(https?:\/\/\S+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noreferrer"
            className="underline underline-offset-2 break-all flex items-center gap-1 mt-1">
            {part} <ExternalLink className="w-3 h-3 inline flex-shrink-0" />
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [identity, setIdentity] = useState<UserIdentity>(loadIdentity);
  const [started, setStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  const lastActiveBtnMsgId = useMemo(() => {
    if (isTyping) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "bot" && messages[i].buttons?.length) {
        return messages[i].id;
      }
    }
    return null;
  }, [messages, isTyping]);

  const addBotMessage = useCallback((reply: string, buttons?: string[], link?: string) => {
    const msg: ChatMessage = {
      id: `bot-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: "bot",
      content: reply,
      buttons: buttons ? buttonsFromStrings(buttons) : [],
      link,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
  }, []);

  useEffect(() => {
    if (started || messages.length > 0) return;
    setStarted(true);
    setIsTyping(true);
    sendToWebhook("start", loadIdentity())
      .then(res => {
        setIsTyping(false);
        addBotMessage(res.reply, res.buttons, res.link);
      })
      .catch(() => {
        setIsTyping(false);
        addBotMessage("Hello! Welcome to FitPro Gym 💪\nI am your smart assistant. How can I help you today?",
          ["Membership Plans", "Register", "Gym Timing", "Location"]);
      });
  }, [started]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;
    setInput("");
    inputRef.current?.focus();

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      buttons: [],
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    const possiblePhone = extractPhoneFromText(trimmed);
    let updatedIdentity = identity;
    if (possiblePhone && !identity.phone) {
      updatedIdentity = { ...identity, phone: possiblePhone };
      setIdentity(updatedIdentity);
      saveIdentity(updatedIdentity);
    }

    if (!identity.name && trimmed.length >= 2 && trimmed.length <= 40 && !/\d{6,}/.test(trimmed) && !possiblePhone) {
      const words = trimmed.split(/\s+/);
      const looksLikeName = words.every(w => /^[a-zA-Z]+$/.test(w));
      if (looksLikeName && words.length <= 4) {
        updatedIdentity = { ...updatedIdentity, name: trimmed };
        setIdentity(updatedIdentity);
        saveIdentity(updatedIdentity);
      }
    }

    try {
      const res = await sendToWebhook(trimmed, updatedIdentity);
      setIsTyping(false);
      addBotMessage(res.reply, res.buttons, res.link);
    } catch {
      setIsTyping(false);
      addBotMessage(ERROR_MSG);
    }
  }

  function handleReset() {
    clearHistory();
    setMessages([]);
    setStarted(false);
  }

  const timeStr = (ts: string) =>
    new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card flex items-center gap-3 flex-shrink-0">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">FitPro Gym Assistant</p>
          <p className="text-xs text-emerald-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            {isTyping ? "Typing..." : "Online — powered by n8n"}
          </p>
        </div>
        {identity.name && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px]">
              {identity.name[0].toUpperCase()}
            </span>
            {identity.name}
          </div>
        )}
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
          title="Start new conversation"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Chat</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[hsl(var(--muted)/0.3)]"
        style={{ backgroundImage: "radial-gradient(hsl(var(--primary)/0.04) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>

        {messages.length === 0 && !isTyping && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">FitPro Gym Assistant</p>
              <p className="text-xs text-muted-foreground mt-1">Connecting to n8n...</p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          const isActive = msg.id === lastActiveBtnMsgId;
          const showAvatar = !isUser && (idx === 0 || messages[idx - 1].role === "user");

          return (
            <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"} gap-2`}>
              {!isUser && (
                <div className={`flex-shrink-0 ${showAvatar ? "opacity-100" : "opacity-0"}`}>
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
              )}

              <div className={`flex flex-col gap-1.5 max-w-[72%] sm:max-w-xs lg:max-w-sm ${isUser ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line break-words shadow-sm ${
                  isUser
                    ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                    : "bg-card border border-border text-foreground rounded-2xl rounded-tl-sm"
                }`}>
                  {renderContent(msg.content)}
                  {msg.link && (
                    <a href={msg.link} target="_blank" rel="noreferrer"
                      className="mt-2 flex items-center gap-1.5 text-xs text-primary underline hover:opacity-80">
                      <ExternalLink className="w-3 h-3" /> Open Link
                    </a>
                  )}
                </div>

                {msg.buttons && msg.buttons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {msg.buttons.map(btn => (
                      isActive ? (
                        <button
                          key={btn.value}
                          onClick={() => send(btn.value)}
                          className="text-xs px-3.5 py-1.5 rounded-full border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all font-medium shadow-sm"
                        >
                          {btn.label}
                        </button>
                      ) : (
                        <span
                          key={btn.value}
                          className="text-xs px-3.5 py-1.5 rounded-full border border-border text-muted-foreground font-medium opacity-40 cursor-not-allowed select-none"
                        >
                          {btn.label}
                        </span>
                      )
                    ))}
                  </div>
                )}

                <p className={`text-[10px] text-muted-foreground px-1 ${isUser ? "self-end" : "self-start"}`}>
                  {timeStr(msg.timestamp)}
                  {isUser && <span className="ml-1 text-primary/60">✓✓</span>}
                </p>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start gap-2">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 160}ms`, animationDuration: "0.9s" }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="p-3 border-t border-border bg-card flex-shrink-0">
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Type a message..."
            disabled={isTyping}
            data-testid="input-chat-message"
            className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow disabled:opacity-50"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || isTyping}
            data-testid="button-send-message"
            className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-40 active:scale-95 transition-all flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Connected to n8n · Messages processed by AI automation
        </p>
      </div>
    </div>
  );
}
