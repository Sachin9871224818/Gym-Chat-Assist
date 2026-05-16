import { useState, useRef, useEffect, useMemo } from "react";
import { useCreateChatSession, useSendChatMessage, useResetChatSession } from "@workspace/api-client-react";
import { Send, RefreshCw, MessageSquare, Bot } from "lucide-react";

interface ChatMsg {
  id: string;
  role: string;
  content: string;
  buttons?: { label: string; value: string }[];
  timestamp: string;
}

const SESSION_KEY = "fitpro_chat_session_id";

function getOrCreateSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export default function Chat() {
  const [sessionId] = useState(getOrCreateSessionId);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [started, setStarted] = useState(false);
  const [pendingButtonMsgId, setPendingButtonMsgId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const createSession = useCreateChatSession();
  const sendMessage = useSendChatMessage();
  const resetSession = useResetChatSession();

  useEffect(() => {
    if (!started) {
      setStarted(true);
      createSession.mutate({ data: { sessionId } }, {
        onSuccess: (sess) => {
          if (sess.isNew || !sess.botMode) {
            setTimeout(() => {
              const msg: ChatMsg = {
                id: `welcome-${Date.now()}`,
                role: "bot",
                content: "Hello! Welcome to FitPro Gym. I am your smart assistant. Please select the service you need:",
                buttons: [{ label: "Gym Management", value: "gym" }],
                timestamp: new Date().toISOString(),
              };
              setMessages([msg]);
              setPendingButtonMsgId(msg.id);
            }, 400);
          }
        },
      });
    }
  }, [started]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const lastActiveBtnMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "bot" && messages[i].buttons && messages[i].buttons!.length > 0) {
        return messages[i].id;
      }
    }
    return pendingButtonMsgId;
  }, [messages, pendingButtonMsgId]);

  function send(text: string) {
    if (!text.trim() || sendMessage.isPending || isTyping) return;
    setInput("");
    setPendingButtonMsgId(null);

    const userMsg: ChatMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      buttons: [],
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    sendMessage.mutate({ data: { sessionId, message: text } }, {
      onSuccess: (res) => {
        setIsTyping(false);
        const botMsgs = res.messages.filter((m: ChatMsg) => m.role === "bot");
        let delay = 0;
        botMsgs.forEach((msg: ChatMsg) => {
          delay += 400;
          setTimeout(() => {
            setMessages(prev => [...prev, msg as ChatMsg]);
            if (msg.buttons && msg.buttons.length > 0) {
              setPendingButtonMsgId(msg.id);
            }
          }, delay);
        });
      },
      onError: () => {
        setIsTyping(false);
        const errMsg: ChatMsg = {
          id: `err-${Date.now()}`,
          role: "bot",
          content: "Sorry, something went wrong. Please try again.",
          buttons: [],
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errMsg]);
      },
    });
  }

  function handleReset() {
    resetSession.mutate({ sessionId }, {
      onSuccess: () => {
        setMessages([]);
        setPendingButtonMsgId(null);
        setStarted(false);
      },
    });
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">FitPro Gym Assistant</p>
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Online — Ready to help
          </p>
        </div>
        <button
          onClick={handleReset}
          data-testid="button-reset-chat"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3 bg-muted/30">
        {messages.length === 0 && !isTyping && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Starting conversation...</p>
            <p className="text-xs text-muted-foreground">The bot will greet you shortly</p>
          </div>
        )}

        {messages.map(msg => {
          const isActive = msg.id === lastActiveBtnMsgId && !isTyping && !sendMessage.isPending;
          return (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              data-testid={`chat-message-${msg.id}`}
            >
              <div className={`max-w-xs lg:max-w-sm ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                {msg.role === "bot" && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 self-start">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                )}
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-card border border-border text-foreground rounded-tl-sm shadow-xs"
                  }`}
                >
                  {msg.content}
                </div>

                {msg.buttons && msg.buttons.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {msg.buttons.map(btn => (
                      isActive ? (
                        <button
                          key={btn.value}
                          onClick={() => send(btn.value)}
                          data-testid={`chat-button-${btn.value}`}
                          className="text-xs px-3 py-1.5 rounded-full border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors font-medium"
                        >
                          {btn.label}
                        </button>
                      ) : (
                        <span
                          key={btn.value}
                          className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground font-medium opacity-50 cursor-not-allowed"
                        >
                          {btn.label}
                        </span>
                      )
                    ))}
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground px-1">
                  {new Date(msg.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-xs">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send(input)}
            placeholder="Type a message..."
            data-testid="input-chat-message"
            className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || sendMessage.isPending || isTyping}
            data-testid="button-send-message"
            className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Session auto-resets after 30 minutes of inactivity
        </p>
      </div>
    </div>
  );
}
