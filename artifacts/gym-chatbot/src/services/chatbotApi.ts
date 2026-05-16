const WEBHOOK_URL = "https://n8n.grindoverdreams.in/webhook/converso";

const IDENTITY_KEY = "fitpro_user_identity";
const HISTORY_KEY = "fitpro_chat_history";

export interface UserIdentity {
  phone: string;
  name: string;
}

export interface N8nResponse {
  reply: string;
  buttons?: string[];
  link?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  content: string;
  buttons?: { label: string; value: string }[];
  link?: string;
  timestamp: string;
}

export function loadIdentity(): UserIdentity {
  try {
    return JSON.parse(localStorage.getItem(IDENTITY_KEY) ?? "{}");
  } catch {
    return { phone: "", name: "" };
  }
}

export function saveIdentity(identity: Partial<UserIdentity>) {
  const current = loadIdentity();
  localStorage.setItem(IDENTITY_KEY, JSON.stringify({ ...current, ...identity }));
}

export function loadHistory(): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveHistory(messages: ChatMessage[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-60)));
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export function parseN8nResponse(raw: unknown): N8nResponse {
  if (typeof raw !== "object" || raw === null) {
    return { reply: String(raw ?? "Something went wrong.") };
  }
  const obj = raw as Record<string, unknown>;
  return {
    reply: String(obj.reply ?? obj.message ?? obj.text ?? ""),
    buttons: Array.isArray(obj.buttons) ? obj.buttons.map(String) : undefined,
    link: typeof obj.link === "string" ? obj.link : undefined,
  };
}

export function buttonsFromStrings(strs: string[]): { label: string; value: string }[] {
  return strs.map(s => ({ label: s, value: s }));
}

export async function sendToWebhook(
  message: string,
  identity: UserIdentity
): Promise<N8nResponse> {
  const payload = {
    message,
    phone: identity.phone || "",
    name: identity.name || "",
    source: "gym_chatbot",
  };

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Webhook error: HTTP ${res.status}`);
  }

  const data = await res.json();
  return parseN8nResponse(Array.isArray(data) ? data[0] : data);
}
