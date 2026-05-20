import { useState, useEffect, useCallback, useMemo } from "react";
import { Megaphone, Send, Users, UserCheck, UserX, AlertTriangle, CheckCircle2, RefreshCw, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const PRICES: Record<string, number> = {
  "Monthly": 2000, "Quarterly": 5000, "Half Yearly": 9000, "Yearly": 17000,
};

interface N8nMember {
  member_id: string;
  name: string;
  phone: number | string;
  membership_plan: string;
  membership_expiry: string;
  fee_status: string;
  status: string;
  [key: string]: unknown;
}

interface SentBroadcast {
  id: string;
  title: string;
  message: string;
  type: string;
  audience: string;
  recipientCount: number;
  sentAt: string;
  status: "success" | "partial" | "failed";
}

const TYPES = [
  { value: "announcement", label: "Announcement", color: "bg-blue-100 text-blue-700" },
  { value: "offer", label: "Offer", color: "bg-amber-100 text-amber-700" },
  { value: "festival", label: "Festival", color: "bg-purple-100 text-purple-700" },
  { value: "reminder", label: "Renewal Reminder", color: "bg-red-100 text-red-700" },
  { value: "promotion", label: "Promotion", color: "bg-emerald-100 text-emerald-700" },
];

const AUDIENCES = [
  { value: "all", label: "All Members", icon: Users, color: "text-blue-600" },
  { value: "active", label: "Active Members", icon: UserCheck, color: "text-emerald-600" },
  { value: "expired", label: "Expired Members", icon: UserX, color: "text-red-500" },
  { value: "expiring", label: "Expiring Soon (30 days)", icon: AlertTriangle, color: "text-amber-600" },
  { value: "pending", label: "Fee Pending", icon: AlertTriangle, color: "text-orange-600" },
];

function cleanPhone(raw: number | string): string {
  return String(raw).replace(/^91/, "").trim();
}

export default function Broadcasts() {
  const [members, setMembers] = useState<N8nMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentBroadcasts, setSentBroadcasts] = useState<SentBroadcast[]>(() => {
    try { return JSON.parse(localStorage.getItem("gym_broadcasts") ?? "[]"); } catch { return []; }
  });
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("announcement");
  const [audience, setAudience] = useState("all");
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const res = await fetch(`${base}/api/webhook-proxy/gymbot_members`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : data ? [data] : []);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const today = new Date();
  const in30Days = new Date(today); in30Days.setDate(today.getDate() + 30);

  const getAudienceMembers = useCallback((aud: string) => {
    switch (aud) {
      case "active":   return members.filter(m => m.status?.toLowerCase() === "active");
      case "expired":  return members.filter(m => m.status?.toLowerCase() === "expired");
      case "expiring": return members.filter(m => {
        if (!m.membership_expiry) return false;
        const exp = new Date(m.membership_expiry);
        return m.status?.toLowerCase() === "active" && exp >= today && exp <= in30Days;
      });
      case "pending":  return members.filter(m => m.fee_status?.toLowerCase() !== "paid");
      default:         return members;
    }
  }, [members, today, in30Days]);

  const targetMembers = useMemo(() => getAudienceMembers(audience), [audience, getAudienceMembers]);

  function resetForm() {
    setTitle(""); setMessage(""); setType("announcement"); setAudience("all");
  }

  async function handleSend() {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Title aur message required hain", variant: "destructive" }); return;
    }
    if (targetMembers.length === 0) {
      toast({ title: "Is audience mein koi member nahi hai", variant: "destructive" }); return;
    }

    setSending(true);
    try {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const contacts = targetMembers.map(m => ({
        name: m.name,
        phone: cleanPhone(m.phone),
        membership_plan: m.membership_plan,
        membership_expiry: m.membership_expiry,
        fee_status: m.fee_status,
        status: m.status,
      }));

      const payload = {
        title,
        message,
        type,
        audience,
        contacts,
        total: contacts.length,
        sent_at: new Date().toISOString(),
      };

      const res = await fetch(`${base}/api/webhook-proxy/gymbot_bulk_broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const broadcastStatus = res.ok ? "success" : "failed";
      const newBroadcast: SentBroadcast = {
        id: Date.now().toString(),
        title,
        message,
        type,
        audience,
        recipientCount: contacts.length,
        sentAt: new Date().toISOString(),
        status: broadcastStatus,
      };

      const updated = [newBroadcast, ...sentBroadcasts];
      setSentBroadcasts(updated);
      localStorage.setItem("gym_broadcasts", JSON.stringify(updated));

      if (res.ok) {
        toast({ title: `✅ Broadcast sent to ${contacts.length} members` });
      } else {
        toast({ title: `Broadcast queued — ${contacts.length} recipients`, description: "n8n se response nahi aaya, phir try karo" });
      }

      setOpen(false);
      resetForm();
    } catch {
      toast({ title: "Broadcast failed", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  const typeInfo = (t: string) => TYPES.find(x => x.value === t) ?? TYPES[0];
  const audienceInfo = (a: string) => AUDIENCES.find(x => x.value === a) ?? AUDIENCES[0];

  const TEMPLATES: Record<string, string> = {
    reminder: `Namaste {name} ji! 🏋️\n\nAapki FitPro membership {expiry} ko expire ho rahi hai.\n\nRenewal ke liye humse milein ya call karein.\n\n💪 FitPro Gym`,
    offer: `Namaste {name} ji! 🎉\n\nHumara special offer sirf aapke liye!\n\n[Offer details yahan likhein]\n\n💪 FitPro Gym`,
    announcement: `Namaste {name} ji! 📢\n\n[Announcement yahan likhein]\n\nShukriya!\n💪 FitPro Gym`,
    festival: `Namaste {name} ji! 🎊\n\n[Festival wishes yahan likhein]\n\nShubhkamnayein!\n💪 FitPro Gym`,
    promotion: `Namaste {name} ji! 🌟\n\n[Promotion details yahan likhein]\n\n💪 FitPro Gym`,
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {sentBroadcasts.length} broadcasts sent
          </p>
          {membersLoading && <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
        >
          <Send className="w-4 h-4" /> New Broadcast
        </button>
      </div>

      {/* Audience Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {AUDIENCES.map(({ value, label, icon: Icon, color }) => {
          const count = getAudienceMembers(value).length;
          return (
            <div key={value} className="bg-card border border-card-border rounded-xl p-3.5 shadow-sm">
              <div className={`flex items-center gap-1.5 mb-1 ${color}`}>
                <Icon className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{label}</span>
              </div>
              {membersLoading
                ? <div className="h-6 w-8 bg-muted rounded animate-pulse" />
                : <p className="text-xl font-bold text-foreground">{count}</p>}
            </div>
          );
        })}
      </div>

      {/* Broadcast history */}
      {sentBroadcasts.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl py-16 text-center">
          <Megaphone className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Koi broadcast nahi bheja abhi tak</p>
          <button onClick={() => setOpen(true)} className="mt-3 text-sm text-primary hover:underline">
            Pehla broadcast bhejo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sentBroadcasts.map(b => (
            <div key={b.id} className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="font-semibold text-foreground">{b.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${typeInfo(b.type).color}`}>
                      {typeInfo(b.type).label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-auto ${
                      b.status === "success" ? "bg-emerald-100 text-emerald-700" : b.status === "partial" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"
                    }`}>
                      {b.status === "success" ? "✅ Sent" : b.status === "partial" ? "⚠️ Partial" : "❌ Failed"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-2">{b.message}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-1 text-sm font-semibold text-foreground justify-end">
                    <Send className="w-3.5 h-3.5 text-primary" />
                    {b.recipientCount}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">recipients</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                <span>Audience: <strong className="text-foreground capitalize">{audienceInfo(b.audience).label}</strong></span>
                <span>·</span>
                <span>{new Date(b.sentAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compose Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              WhatsApp Bulk Broadcast
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Audience selector */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target Audience</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                {AUDIENCES.map(({ value, label, icon: Icon, color }) => {
                  const count = getAudienceMembers(value).length;
                  return (
                    <button key={value} type="button"
                      onClick={() => setAudience(value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all text-sm ${
                        audience === value
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-input hover:bg-muted"
                      }`}>
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${color}`} />
                      <span className="flex-1 text-foreground truncate">{label}</span>
                      <span className={`text-xs font-bold ${color}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected audience preview */}
            {targetMembers.length > 0 && (
              <div className="bg-muted/40 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground">{targetMembers.length} members will receive this</p>
                  <button type="button" onClick={() => setPreviewOpen(!previewOpen)}
                    className="text-xs text-primary hover:underline">
                    {previewOpen ? "Hide" : "Preview list"}
                  </button>
                </div>
                {previewOpen && (
                  <div className="max-h-32 overflow-y-auto space-y-1.5 mt-2">
                    {targetMembers.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-bold text-primary">{m.name?.[0]}</span>
                        </div>
                        <span className="text-foreground font-medium">{m.name}</span>
                        <span className="text-muted-foreground">· {cleanPhone(m.phone)}</span>
                        <span className="text-muted-foreground ml-auto">{m.membership_plan}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Type */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message Type</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {TYPES.map(t => (
                  <button key={t.value} type="button"
                    onClick={() => { setType(t.value); if (!message) setMessage(TEMPLATES[t.value] ?? ""); }}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                      type === t.value ? t.color + " ring-2 ring-offset-1 ring-current" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Broadcast Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Monsoon Membership Offer"
                className="mt-1.5 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            {/* Message */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message *</label>
                <span className="text-xs text-muted-foreground">
                  Variables: <code className="bg-muted px-1 rounded">{"{name}"}</code> <code className="bg-muted px-1 rounded">{"{expiry}"}</code> <code className="bg-muted px-1 rounded">{"{plan}"}</code>
                </span>
              </div>
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                rows={6} placeholder="Apna message likhein..."
                className="w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none font-mono" />
              <p className="text-xs text-muted-foreground mt-1">{message.length} characters</p>
            </div>

            {/* Quick templates */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Templates</label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {Object.entries(TEMPLATES).map(([key, tmpl]) => (
                  <button key={key} type="button"
                    onClick={() => setMessage(tmpl)}
                    className="text-xs px-2.5 py-1.5 border border-input rounded-md hover:bg-muted transition-colors capitalize">
                    {key}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex gap-3 pt-2 border-t border-border">
              <button type="button" onClick={() => { setOpen(false); resetForm(); }}
                className="flex-1 py-2.5 text-sm border border-input rounded-lg hover:bg-muted transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleSend} disabled={sending || targetMembers.length === 0}
                className="flex-1 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 font-medium">
                {sending ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="w-4 h-4" /> Send to {targetMembers.length} Members</>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
