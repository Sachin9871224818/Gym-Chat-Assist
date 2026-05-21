import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Megaphone, Send, Users, UserCheck, UserX, AlertTriangle,
  RefreshCw, Search, ChevronDown, MessageSquare, CheckCircle2,
  Globe, Tag, Eye,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

/* ─── Types ──────────────────────────────────────────────────── */
interface N8nMember {
  member_id: string | number;
  name: string;
  phone: number | string;
  membership_plan: string;
  membership_expiry: string;
  fee_status: string;
  status: string;
  [k: string]: unknown;
}

interface WaButton { type?: string; text: string; url?: string; phone_number?: string; }

interface WaTemplate {
  id: string;
  name: string;
  category?: string;
  language?: string;
  status?: string;
  body?: string;
  header?: string;
  footer?: string;
  buttons?: WaButton[] | string[];
  components?: Array<{ type: string; text?: string; format?: string; buttons?: WaButton[] }>;
}

interface SentBroadcast {
  id: string; templateName: string; category: string;
  audience: string; recipientCount: number;
  sentAt: string; status: "success" | "failed";
}

/* ─── Constants ───────────────────────────────────────────────── */
const AUDIENCES = [
  { value: "all",      label: "All Members",       icon: Users,         color: "text-blue-600",   bg: "bg-blue-50 border-blue-200",    webhook: "gymbot_all_members_bc" },
  { value: "active",   label: "Active Members",     icon: UserCheck,     color: "text-emerald-600",bg: "bg-emerald-50 border-emerald-200", webhook: "gymbot_active_members_bc" },
  { value: "expired",  label: "Expired Members",    icon: UserX,         color: "text-red-500",    bg: "bg-red-50 border-red-200",       webhook: "gymbot_expired_members_bc" },
  { value: "expiring", label: "Expiring (30 days)", icon: AlertTriangle, color: "text-amber-600",  bg: "bg-amber-50 border-amber-200",   webhook: "gymbot_expiring_30days_members_bc" },
  { value: "pending",  label: "Fee Pending",        icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50 border-orange-200", webhook: "gymbot_fee_pending_bc" },
] as const;

type AudienceValue = typeof AUDIENCES[number]["value"];

const CAT_COLORS: Record<string, string> = {
  MARKETING:      "bg-purple-100 text-purple-700",
  UTILITY:        "bg-blue-100 text-blue-700",
  AUTHENTICATION: "bg-amber-100 text-amber-700",
  SERVICE:        "bg-emerald-100 text-emerald-700",
};

const PRICES: Record<string, number> = {
  Monthly: 2000, Quarterly: 5000, "Half Yearly": 9000, Yearly: 17000,
};

/* ─── Helpers ─────────────────────────────────────────────────── */
function getBody(t: WaTemplate): string {
  if (t.body) return t.body;
  return t.components?.find(c => c.type?.toUpperCase() === "BODY")?.text ?? "";
}
function getHeader(t: WaTemplate): string {
  if (t.header) return t.header;
  return t.components?.find(c => c.type?.toUpperCase() === "HEADER")?.text ?? "";
}
function getFooter(t: WaTemplate): string {
  if (t.footer) return t.footer;
  return t.components?.find(c => c.type?.toUpperCase() === "FOOTER")?.text ?? "";
}
function getButtons(t: WaTemplate): WaButton[] {
  if (t.buttons) return (t.buttons as (WaButton | string)[]).map(b => typeof b === "string" ? { text: b } : b);
  return t.components?.find(c => c.type?.toUpperCase() === "BUTTONS")?.buttons ?? [];
}

function fmtExpiry(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/** Replace {{1}}, {{2}} … with sample values from first member */
function autoPreview(body: string, member: N8nMember | undefined, audience: AudienceValue): string {
  if (!member) return body;
  const slots: Record<string, string> = {
    "1": member.name,
    "2": audience === "expiring"
      ? fmtExpiry(member.membership_expiry)
      : audience === "pending"
        ? `₹${PRICES[member.membership_plan] ?? 0}`
        : member.membership_plan ?? "",
    "3": member.membership_plan ?? "",
  };
  return body.replace(/\{\{(\d+)\}\}/g, (_, n) => slots[n] ?? `{{${n}}}`);
}

/* ─── Member payload builders ─────────────────────────────────── */
function buildMembers(audience: AudienceValue, members: N8nMember[]) {
  return members.map(m => {
    const base = {
      member_id: m.member_id,
      name: m.name,
      phone: String(m.phone).startsWith("91") ? String(m.phone) : `91${String(m.phone)}`,
    };
    if (audience === "expiring") {
      return { ...base, expiry_date: fmtExpiry(m.membership_expiry), membership_plan: m.membership_plan };
    }
    if (audience === "pending") {
      return { ...base, pending_amount: String(PRICES[m.membership_plan] ?? 0), membership_plan: m.membership_plan };
    }
    return base;
  });
}

const AUDIENCE_TYPE_MAP: Record<AudienceValue, string> = {
  all: "all_members", active: "active_members", expired: "expired_members",
  expiring: "expiring_members", pending: "fee_pending",
};

/* ─── Template Dropdown ───────────────────────────────────────── */
function TemplateDropdown({ templates, selected, onSelect }: {
  templates: WaTemplate[]; selected: WaTemplate | null; onSelect: (t: WaTemplate) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = useMemo(() =>
    templates.filter(t =>
      t.name?.toLowerCase().includes(q.toLowerCase()) ||
      t.category?.toLowerCase().includes(q.toLowerCase())
    ), [templates, q]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${open ? "border-primary ring-2 ring-primary/20" : "border-input hover:border-primary/50"} bg-background`}>
        {selected ? (
          <>
            <MessageSquare className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{selected.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${CAT_COLORS[selected.category?.toUpperCase() ?? ""] ?? "bg-muted text-muted-foreground"}`}>{selected.category ?? "—"}</span>
                {selected.language && <span className="text-[10px] text-muted-foreground">{selected.language}</span>}
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
          </>
        ) : (
          <>
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground flex-1">Search and select a template...</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 w-full bg-background border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border bg-muted/40">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-background rounded-lg border border-input">
              <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search templates..."
                className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground" />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No templates found</div>
            ) : filtered.map(t => (
              <button key={t.id} type="button"
                onClick={() => { onSelect(t); setOpen(false); setQ(""); }}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-border/40 last:border-0 ${selected?.id === t.id ? "bg-primary/5" : "hover:bg-muted/60"}`}>
                <MessageSquare className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${CAT_COLORS[t.category?.toUpperCase() ?? ""] ?? "bg-muted text-muted-foreground"}`}>{t.category ?? "—"}</span>
                    {t.language && <span className="text-[10px] text-muted-foreground">{t.language}</span>}
                    {t.status && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${t.status?.toUpperCase() === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{t.status}</span>}
                  </div>
                </div>
                {selected?.id === t.id && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── WhatsApp Preview Bubble ─────────────────────────────────── */
function WaBubble({ header, body, footer, buttons }: {
  header?: string; body: string; footer?: string; buttons: WaButton[];
}) {
  const html = body
    .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
  return (
    <div className="bg-[#e7fdd8] dark:bg-[#1e3a1e] rounded-xl rounded-tl-sm shadow p-3 max-w-[280px]">
      {header && <p className="text-[13px] font-bold text-[#111b21] dark:text-[#e9edef] mb-1.5 leading-snug">{header}</p>}
      <p className="text-[13px] text-[#111b21] dark:text-[#e9edef] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }} />
      {footer && <p className="text-[11px] text-[#667781] mt-1.5">{footer}</p>}
      <p className="text-[10px] text-[#667781] text-right mt-1">
        {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
      </p>
      {buttons.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#c8f0b8] space-y-1.5">
          {buttons.map((b, i) => (
            <div key={i} className="text-[#008069] text-[12px] font-semibold text-center">{b.text}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main ────────────────────────────────────────────────────── */
export default function Broadcasts() {
  const [members, setMembers]             = useState<N8nMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [templates, setTemplates]         = useState<WaTemplate[]>([]);
  const [tplLoading, setTplLoading]       = useState(false);
  const [tplError, setTplError]           = useState(false);
  const [open, setOpen]                   = useState(false);
  const [audience, setAudience]           = useState<AudienceValue>("all");
  const [showList, setShowList]           = useState(false);
  const [selectedTpl, setSelectedTpl]     = useState<WaTemplate | null>(null);
  const [sending, setSending]             = useState(false);
  const [history, setHistory]             = useState<SentBroadcast[]>(() => {
    try { return JSON.parse(localStorage.getItem("gym_bc_v3") ?? "[]"); } catch { return []; }
  });
  const { toast } = useToast();

  /* ── Load members ── */
  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const res = await fetch(`${base}/api/webhook-proxy/gymbot_members`);
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : data ? [data] : []);
    } catch { setMembers([]); }
    finally { setMembersLoading(false); }
  }, []);

  /* ── Load templates ── */
  const loadTemplates = useCallback(async () => {
    setTplLoading(true); setTplError(false);
    try {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const res = await fetch(`${base}/api/webhook-proxy/gymbot_templates`);
      const raw = await res.json();
      let arr: WaTemplate[] = [];
      if (Array.isArray(raw))                              arr = raw;
      else if (Array.isArray(raw?.templates))              arr = raw.templates;
      else if (Array.isArray(raw?.data))                   arr = raw.data;
      setTemplates(arr);
      if (!arr.length && raw?.code !== undefined) setTplError(false); // n8n misconfigured, not a network error
    } catch { setTplError(true); }
    finally { setTplLoading(false); }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);
  useEffect(() => { if (open) { loadTemplates(); setSelectedTpl(null); setShowList(false); } }, [open]);

  /* ── Audience filtering ── */
  const today = useMemo(() => new Date(), []);
  const in30   = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + 30); return d; }, [today]);

  const filterMembers = useCallback((aud: AudienceValue) => {
    switch (aud) {
      case "active":   return members.filter(m => m.status?.toLowerCase() === "active");
      case "expired":  return members.filter(m => m.status?.toLowerCase() === "expired");
      case "expiring": return members.filter(m => {
        if (!m.membership_expiry) return false;
        const d = new Date(m.membership_expiry);
        return m.status?.toLowerCase() === "active" && d >= today && d <= in30;
      });
      case "pending":  return members.filter(m => m.fee_status?.toLowerCase() !== "paid");
      default:         return members;
    }
  }, [members, today, in30]);

  const targetMembers = useMemo(() => filterMembers(audience), [audience, filterMembers]);
  const firstMember   = targetMembers[0];

  /* ── Preview using first member ── */
  const previewBody   = selectedTpl ? autoPreview(getBody(selectedTpl), firstMember, audience) : "";
  const previewHeader = selectedTpl ? getHeader(selectedTpl) : "";
  const previewFooter = selectedTpl ? getFooter(selectedTpl) : "";
  const previewBtns   = selectedTpl ? getButtons(selectedTpl) : [];

  /* ── Send ── */
  async function handleSend() {
    if (!selectedTpl) { toast({ title: "Pehle ek template select karo", variant: "destructive" }); return; }
    if (targetMembers.length === 0) { toast({ title: "Is audience mein koi member nahi", variant: "destructive" }); return; }

    setSending(true);
    try {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const aud = AUDIENCES.find(a => a.value === audience)!;

      const payload = {
        audience_type: AUDIENCE_TYPE_MAP[audience],
        template: {
          id:       selectedTpl.id,
          name:     selectedTpl.name,
          body:     getBody(selectedTpl),
          category: selectedTpl.category ?? "",
          language: selectedTpl.language ?? "en",
          buttons:  getButtons(selectedTpl),
        },
        members: buildMembers(audience, targetMembers),
      };

      const res = await fetch(`${base}/api/webhook-proxy/${aud.webhook}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const entry: SentBroadcast = {
        id: Date.now().toString(),
        templateName: selectedTpl.name,
        category:     selectedTpl.category ?? "—",
        audience,
        recipientCount: targetMembers.length,
        sentAt: new Date().toISOString(),
        status: res.ok ? "success" : "failed",
      };
      const updated = [entry, ...history];
      setHistory(updated);
      localStorage.setItem("gym_bc_v3", JSON.stringify(updated));

      if (res.ok) toast({ title: "Broadcast started successfully" });
      else        toast({ title: "Unable to start broadcast", variant: "destructive" });

      setOpen(false);
    } catch {
      toast({ title: "Unable to start broadcast", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  const resetModal = () => { setAudience("all"); setSelectedTpl(null); setShowList(false); };

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div className="p-5 space-y-5">

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{history.length} broadcast{history.length !== 1 ? "s" : ""} sent</p>
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
          <Send className="w-4 h-4" /> New Broadcast
        </button>
      </div>

      {/* Audience quick-stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {AUDIENCES.map(({ value, label, icon: Icon, color }) => (
          <div key={value} className="bg-card border border-card-border rounded-xl p-3.5 shadow-sm">
            <div className={`flex items-center gap-1.5 mb-1.5 ${color}`}>
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-xs font-medium leading-tight">{label}</span>
            </div>
            {membersLoading
              ? <div className="h-6 w-8 bg-muted rounded animate-pulse" />
              : <p className="text-xl font-bold text-foreground">{filterMembers(value).length}</p>}
          </div>
        ))}
      </div>

      {/* History */}
      {history.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl py-16 text-center">
          <Megaphone className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No broadcasts sent yet</p>
          <button onClick={() => setOpen(true)} className="mt-2 text-sm text-primary hover:underline">
            Send your first broadcast
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map(b => (
            <div key={b.id} className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-foreground truncate">{b.templateName}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${CAT_COLORS[b.category?.toUpperCase()] ?? "bg-muted text-muted-foreground"}`}>{b.category}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {AUDIENCES.find(a => a.value === b.audience)?.label ?? b.audience}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 space-y-1">
                  <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${b.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                    {b.status === "success" ? "✅ Sent" : "❌ Failed"}
                  </div>
                  <p className="text-xs text-muted-foreground">{b.recipientCount} recipients</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border">
                {new Date(b.sentAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Modal ═══════════════════════════════════════════════ */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetModal(); }}>
        <DialogContent className="max-w-lg w-full p-0 gap-0 overflow-hidden rounded-2xl flex flex-col max-h-[92vh]">

          {/* Header */}
          <DialogHeader className="px-5 py-4 border-b border-border flex-shrink-0">
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <div className="w-8 h-8 rounded-xl bg-[#25D366]/15 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-[#25D366]" />
              </div>
              WhatsApp Bulk Broadcast
            </DialogTitle>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

            {/* ── 1. Audience ── */}
            <section className="space-y-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                1 · Target Audience
              </p>
              <div className="grid grid-cols-2 gap-2">
                {AUDIENCES.map(({ value, label, icon: Icon, color, bg }) => {
                  const cnt = filterMembers(value).length;
                  const active = audience === value;
                  return (
                    <button key={value} type="button" onClick={() => setAudience(value)}
                      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all ${active ? `${bg} ring-1 ring-current/30` : "border-input hover:bg-muted/50"}`}>
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${active ? color : "text-muted-foreground"}`} />
                      <span className={`flex-1 text-xs font-medium truncate ${active ? color : "text-foreground"}`}>{label}</span>
                      <span className={`text-xs font-bold tabular-nums ${active ? color : "text-muted-foreground"}`}>{cnt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Preview list */}
              {targetMembers.length > 0 && (
                <div className="bg-muted/40 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">
                      {targetMembers.length} member{targetMembers.length !== 1 ? "s" : ""} will receive this
                    </p>
                    <button type="button" onClick={() => setShowList(v => !v)}
                      className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Eye className="w-3 h-3" /> {showList ? "Hide" : "Preview list"}
                    </button>
                  </div>
                  {showList && (
                    <div className="mt-3 max-h-28 overflow-y-auto space-y-1.5">
                      {targetMembers.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[9px] font-bold text-primary">{String(m.name)[0]}</span>
                          </div>
                          <span className="font-medium text-foreground">{m.name}</span>
                          <span className="text-muted-foreground ml-auto">{m.membership_plan}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── 2. Template ── */}
            <section className="space-y-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                2 · Select WhatsApp Template
              </p>

              {tplLoading ? (
                <div className="flex items-center gap-3 px-4 py-3.5 bg-muted/40 rounded-xl border border-dashed border-border">
                  <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Loading WhatsApp templates...</p>
                </div>
              ) : tplError ? (
                <div className="flex items-center justify-between px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-600">Unable to fetch templates</p>
                  <button onClick={loadTemplates} className="text-xs text-red-600 font-medium underline flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              ) : templates.length === 0 ? (
                <div className="flex flex-col items-center py-7 gap-2 bg-muted/30 rounded-xl border-2 border-dashed border-border">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">No templates available</p>
                  <p className="text-xs text-muted-foreground/60">Configure gymbot_templates in n8n</p>
                  <button onClick={loadTemplates} className="text-xs text-primary underline flex items-center gap-1 mt-1">
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              ) : (
                <TemplateDropdown templates={templates} selected={selectedTpl} onSelect={setSelectedTpl} />
              )}

              {/* Template meta badge row */}
              {selectedTpl && (
                <div className="flex flex-wrap gap-2">
                  {selectedTpl.category && (
                    <span className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg font-bold uppercase ${CAT_COLORS[selectedTpl.category.toUpperCase()] ?? "bg-muted text-muted-foreground"}`}>
                      <Tag className="w-2.5 h-2.5" />{selectedTpl.category}
                    </span>
                  )}
                  {selectedTpl.language && (
                    <span className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-muted text-muted-foreground font-medium">
                      <Globe className="w-2.5 h-2.5" />{selectedTpl.language}
                    </span>
                  )}
                  {selectedTpl.status && (
                    <span className={`text-[11px] px-2 py-1 rounded-lg font-medium ${selectedTpl.status.toUpperCase() === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {selectedTpl.status}
                    </span>
                  )}
                  {getButtons(selectedTpl).length > 0 && (
                    <span className="text-[11px] px-2 py-1 rounded-lg bg-[#25D366]/10 text-[#128C7E] font-medium">
                      {getButtons(selectedTpl).length} button{getButtons(selectedTpl).length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              )}
            </section>

            {/* ── 3. Preview ── */}
            {selectedTpl && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                    3 · Template Preview
                  </p>
                  {firstMember && (
                    <p className="text-[10px] text-muted-foreground">
                      Sample: <span className="font-medium text-foreground">{firstMember.name}</span>
                    </p>
                  )}
                </div>
                <div className="bg-[#efeae2] dark:bg-[#0b141a] rounded-xl p-4 flex justify-start">
                  <WaBubble
                    header={previewHeader || undefined}
                    body={previewBody || getBody(selectedTpl) || "(No body text)"}
                    footer={previewFooter || undefined}
                    buttons={previewBtns}
                  />
                </div>
                {firstMember && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    Variables auto-filled with first member data · n8n handles all replacements
                  </p>
                )}
              </section>
            )}
          </div>

          {/* ── Sticky Send Button ── */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-border bg-background">
            <button type="button" onClick={handleSend}
              disabled={sending || !selectedTpl || targetMembers.length === 0}
              className="w-full py-3 bg-[#25D366] hover:bg-[#1ebe5d] active:bg-[#18a851] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow">
              {sending ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Sending broadcast...</>
              ) : (
                <><Send className="w-4 h-4" />
                  Send to {targetMembers.length} Member{targetMembers.length !== 1 ? "s" : ""}
                  {selectedTpl && <span className="font-normal opacity-75 text-xs">· {selectedTpl.name}</span>}
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
