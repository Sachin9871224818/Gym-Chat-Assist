import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Megaphone, Send, Users, UserCheck, UserX, AlertTriangle,
  RefreshCw, Search, ChevronDown, MessageSquare, X, CheckCircle2,
  Globe, Tag, Eye
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

/* ─── Types ──────────────────────────────────────────────────── */
interface N8nMember {
  member_id: string; name: string; phone: number | string;
  membership_plan: string; membership_expiry: string;
  fee_status: string; status: string; [k: string]: unknown;
}

interface WaButton { text: string; type?: string; phone_number?: string; url?: string; }

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
  variable_count?: number;
  components?: Array<{ type: string; text?: string; format?: string; buttons?: WaButton[] }>;
}

interface SentBroadcast {
  id: string; title: string; type: string; audience: string;
  recipientCount: number; sentAt: string; status: "success" | "failed";
}

/* ─── Constants ───────────────────────────────────────────────── */
const AUDIENCES = [
  { value: "all",      label: "All Members",          icon: Users,         color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  { value: "active",   label: "Active Members",        icon: UserCheck,     color: "text-emerald-600",bg: "bg-emerald-50 border-emerald-200" },
  { value: "expired",  label: "Expired Members",       icon: UserX,         color: "text-red-500",    bg: "bg-red-50 border-red-200" },
  { value: "expiring", label: "Expiring (30 days)",    icon: AlertTriangle, color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  { value: "pending",  label: "Fee Pending",           icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
];

const CAT_COLORS: Record<string, string> = {
  MARKETING:      "bg-purple-100 text-purple-700",
  UTILITY:        "bg-blue-100 text-blue-700",
  AUTHENTICATION: "bg-amber-100 text-amber-700",
  SERVICE:        "bg-emerald-100 text-emerald-700",
};

function cleanPhone(p: number | string) { return String(p).replace(/^91/, "").trim(); }

function extractVariableCount(tpl: WaTemplate): number {
  if (typeof tpl.variable_count === "number") return tpl.variable_count;
  const body = getBody(tpl);
  const matches = body.match(/\{\{(\d+)\}\}/g) ?? [];
  const nums = matches.map(m => parseInt(m.replace(/\D/g, "")));
  return nums.length ? Math.max(...nums) : 0;
}

function getBody(tpl: WaTemplate): string {
  if (tpl.body) return tpl.body;
  const bodyComp = tpl.components?.find(c => c.type?.toUpperCase() === "BODY");
  return bodyComp?.text ?? "";
}

function getHeader(tpl: WaTemplate): string {
  if (tpl.header) return tpl.header;
  const h = tpl.components?.find(c => c.type?.toUpperCase() === "HEADER");
  return h?.text ?? "";
}

function getFooter(tpl: WaTemplate): string {
  if (tpl.footer) return tpl.footer;
  const f = tpl.components?.find(c => c.type?.toUpperCase() === "FOOTER");
  return f?.text ?? "";
}

function getButtons(tpl: WaTemplate): string[] {
  if (tpl.buttons) {
    return (tpl.buttons as (WaButton | string)[]).map(b =>
      typeof b === "string" ? b : b.text
    );
  }
  const btnComp = tpl.components?.find(c => c.type?.toUpperCase() === "BUTTONS");
  return btnComp?.buttons?.map(b => b.text) ?? [];
}

function applyVars(text: string, vars: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_, n) => {
    const val = vars[parseInt(n) - 1];
    return val?.trim() ? `*${val.trim()}*` : `{{${n}}}`;
  });
}

/* ─── Template Dropdown ───────────────────────────────────────── */
function TemplateDropdown({
  templates, selected, onSelect,
}: { templates: WaTemplate[]; selected: WaTemplate | null; onSelect: (t: WaTemplate) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() =>
    templates.filter(t =>
      t.name?.toLowerCase().includes(q.toLowerCase()) ||
      t.category?.toLowerCase().includes(q.toLowerCase())
    ), [templates, q]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
          open ? "border-primary ring-2 ring-primary/20" : "border-input hover:border-primary/40"
        } bg-background`}>
        {selected ? (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{selected.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${CAT_COLORS[selected.category?.toUpperCase() ?? ""] ?? "bg-muted text-muted-foreground"}`}>
                  {selected.category ?? "—"}
                </span>
                <span className="text-[10px] text-muted-foreground">{selected.language ?? "—"}</span>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </>
        ) : (
          <>
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground flex-1">Select a WhatsApp template...</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-2 w-full bg-background border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-muted rounded-lg">
              <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <input
                autoFocus
                value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search templates..."
                className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No templates found</div>
            ) : (
              filtered.map(t => (
                <button key={t.id} type="button"
                  onClick={() => { onSelect(t); setOpen(false); setQ(""); }}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors border-b border-border/50 last:border-0 ${
                    selected?.id === t.id ? "bg-primary/5" : ""
                  }`}>
                  <MessageSquare className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${CAT_COLORS[t.category?.toUpperCase() ?? ""] ?? "bg-muted text-muted-foreground"}`}>
                        {t.category ?? "—"}
                      </span>
                      {t.language && <span className="text-[10px] text-muted-foreground">{t.language}</span>}
                      {t.status && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${t.status?.toUpperCase() === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                          {t.status}
                        </span>
                      )}
                    </div>
                  </div>
                  {selected?.id === t.id && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── WhatsApp Preview Bubble ─────────────────────────────────── */
function WaBubble({ header, body, footer, buttons }: {
  header?: string; body: string; footer?: string; buttons: string[];
}) {
  return (
    <div className="bg-[#e7fdd8] dark:bg-[#1e3a1e] rounded-xl rounded-tl-sm p-3 max-w-xs shadow-sm">
      {header && <p className="text-[13px] font-bold text-[#111b21] dark:text-[#e9edef] mb-1">{header}</p>}
      <p className="text-[13px] text-[#111b21] dark:text-[#e9edef] leading-relaxed whitespace-pre-wrap"
        dangerouslySetInnerHTML={{ __html: body.replace(/\*(.*?)\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>") }} />
      {footer && <p className="text-[11px] text-[#667781] dark:text-[#8696a0] mt-1.5">{footer}</p>}
      {buttons.length > 0 && (
        <div className="mt-2.5 space-y-1.5 border-t border-[#d1f4cc] dark:border-[#2a4a2a] pt-2">
          {buttons.map((btn, i) => (
            <div key={i} className="text-[#008069] dark:text-[#00a884] text-[12px] font-semibold text-center py-0.5">
              {btn}
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-[#667781] dark:text-[#8696a0] text-right mt-1">
        {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────── */
export default function Broadcasts() {
  /* members */
  const [members, setMembers]           = useState<N8nMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  /* templates */
  const [templates, setTemplates]       = useState<WaTemplate[]>([]);
  const [tplLoading, setTplLoading]     = useState(false);
  const [tplError, setTplError]         = useState(false);

  /* modal state */
  const [open, setOpen]                 = useState(false);
  const [audience, setAudience]         = useState("all");
  const [showPreviewList, setShowPreviewList] = useState(false);
  const [selectedTpl, setSelectedTpl]   = useState<WaTemplate | null>(null);
  const [variables, setVariables]       = useState<string[]>([]);
  const [sending, setSending]           = useState(false);

  /* history */
  const [history, setHistory]           = useState<SentBroadcast[]>(() => {
    try { return JSON.parse(localStorage.getItem("gym_broadcasts_v2") ?? "[]"); } catch { return []; }
  });

  const { toast } = useToast();

  /* ── Load members ── */
  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const res = await fetch(`${base}/api/webhook-proxy/gymbot_members`);
      if (!res.ok) throw new Error();
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
      /* Handle various shapes */
      let arr: WaTemplate[] = [];
      if (Array.isArray(raw)) arr = raw;
      else if (raw?.templates && Array.isArray(raw.templates)) arr = raw.templates;
      else if (raw?.data && Array.isArray(raw.data)) arr = raw.data;
      /* If n8n returns code:0 error → no templates yet */
      if (raw?.code === 0 || arr.length === 0) { setTplError(false); setTemplates([]); }
      else setTemplates(arr);
    } catch { setTplError(true); }
    finally { setTplLoading(false); }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);
  useEffect(() => { if (open) loadTemplates(); }, [open, loadTemplates]);

  /* ── When template changes ── */
  useEffect(() => {
    if (!selectedTpl) { setVariables([]); return; }
    const n = extractVariableCount(selectedTpl);
    setVariables(prev => {
      const next = Array(n).fill("");
      prev.slice(0, n).forEach((v, i) => { next[i] = v; });
      return next;
    });
  }, [selectedTpl]);

  /* ── Audience helpers ── */
  const today = new Date();
  const in30 = new Date(today); in30.setDate(today.getDate() + 30);

  const getAudience = useCallback((aud: string) => {
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
  }, [members]);

  const targetMembers = useMemo(() => getAudience(audience), [audience, getAudience]);

  /* ── Live preview text ── */
  const previewBody   = selectedTpl ? applyVars(getBody(selectedTpl), variables) : "";
  const previewHeader = selectedTpl ? applyVars(getHeader(selectedTpl), variables) : "";
  const previewFooter = selectedTpl ? getFooter(selectedTpl) : "";
  const previewBtns   = selectedTpl ? getButtons(selectedTpl) : [];

  /* ── Send ── */
  async function handleSend() {
    if (!selectedTpl) { toast({ title: "Pehle ek template select karo", variant: "destructive" }); return; }
    if (targetMembers.length === 0) { toast({ title: "Is audience mein koi member nahi", variant: "destructive" }); return; }

    setSending(true);
    try {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const payload = {
        template_name: selectedTpl.name,
        template_id:   selectedTpl.id,
        variables:     variables,
        audience_type: audience,
        contacts: targetMembers.map(m => ({
          name:              m.name,
          phone:             cleanPhone(m.phone),
          membership_plan:   m.membership_plan,
          membership_expiry: m.membership_expiry,
          fee_status:        m.fee_status,
          status:            m.status,
        })),
        total: targetMembers.length,
        sent_at: new Date().toISOString(),
      };

      const res = await fetch(`${base}/api/webhook-proxy/gymbot_bulk_broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const entry: SentBroadcast = {
        id: Date.now().toString(),
        title: selectedTpl.name,
        type: selectedTpl.category ?? "—",
        audience,
        recipientCount: targetMembers.length,
        sentAt: new Date().toISOString(),
        status: res.ok ? "success" : "failed",
      };
      const updated = [entry, ...history];
      setHistory(updated);
      localStorage.setItem("gym_broadcasts_v2", JSON.stringify(updated));

      toast({ title: res.ok ? `✅ Broadcast sent to ${targetMembers.length} members` : `Queued — ${targetMembers.length} recipients` });
      setOpen(false);
      setSelectedTpl(null); setVariables([]); setAudience("all");
    } catch {
      toast({ title: "Broadcast failed", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div className="p-5 space-y-5">

      {/* Top bar */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{history.length} broadcasts sent</p>
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity font-semibold shadow-sm">
          <Send className="w-4 h-4" /> New Broadcast
        </button>
      </div>

      {/* Audience quick-stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {AUDIENCES.map(({ value, label, icon: Icon, color }) => (
          <div key={value} className="bg-card border border-card-border rounded-xl p-3.5 shadow-sm">
            <div className={`flex items-center gap-1.5 mb-1 ${color}`}>
              <Icon className="w-3.5 h-3.5" /><span className="text-xs font-medium">{label}</span>
            </div>
            {membersLoading
              ? <div className="h-6 w-8 bg-muted rounded animate-pulse" />
              : <p className="text-xl font-bold text-foreground">{getAudience(value).length}</p>}
          </div>
        ))}
      </div>

      {/* History list */}
      {history.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl py-16 text-center">
          <Megaphone className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Koi broadcast nahi bheja abhi tak</p>
          <button onClick={() => setOpen(true)} className="mt-3 text-sm text-primary hover:underline">Pehla broadcast bhejo</button>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map(b => (
            <div key={b.id} className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground text-sm">{b.title}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${CAT_COLORS[b.type?.toUpperCase()] ?? "bg-muted text-muted-foreground"}`}>{b.type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-auto ${b.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                      {b.status === "success" ? "✅ Sent" : "❌ Failed"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground capitalize">
                    Audience: {AUDIENCES.find(a => a.value === b.audience)?.label ?? b.audience}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-foreground">{b.recipientCount}</p>
                  <p className="text-xs text-muted-foreground">recipients</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                {new Date(b.sentAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Compose Modal ═══════════════════════════════════════ */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setSelectedTpl(null); setVariables([]); setAudience("all"); setShowPreviewList(false); } }}>
        <DialogContent className="max-w-xl w-full p-0 gap-0 overflow-hidden rounded-2xl flex flex-col max-h-[92vh]">

          {/* Header */}
          <DialogHeader className="px-5 py-4 border-b border-border flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-8 h-8 rounded-xl bg-[#25D366]/15 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-[#25D366]" />
              </div>
              WhatsApp Bulk Broadcast
            </DialogTitle>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* ── Audience ── */}
            <section>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Target Audience</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {AUDIENCES.map(({ value, label, icon: Icon, color, bg }) => {
                  const cnt = getAudience(value).length;
                  const active = audience === value;
                  return (
                    <button key={value} type="button" onClick={() => setAudience(value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        active ? `${bg} border-current ring-1 ring-current/30` : "border-input hover:bg-muted/60"
                      }`}>
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${active ? color : "text-muted-foreground"}`} />
                      <span className={`flex-1 text-xs font-medium truncate ${active ? color : "text-foreground"}`}>{label}</span>
                      <span className={`text-xs font-bold ${active ? color : "text-muted-foreground"}`}>{cnt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Preview list toggle */}
              {targetMembers.length > 0 && (
                <div className="mt-2.5 bg-muted/40 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">
                      {targetMembers.length} member{targetMembers.length !== 1 ? "s" : ""} will receive this
                    </p>
                    <button type="button" onClick={() => setShowPreviewList(v => !v)}
                      className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Eye className="w-3 h-3" /> {showPreviewList ? "Hide" : "Preview"}
                    </button>
                  </div>
                  {showPreviewList && (
                    <div className="mt-3 max-h-28 overflow-y-auto space-y-1.5">
                      {targetMembers.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[9px] font-bold text-primary">{m.name?.[0]}</span>
                          </div>
                          <span className="font-medium text-foreground">{m.name}</span>
                          <span className="text-muted-foreground">· {cleanPhone(m.phone)}</span>
                          <span className="text-muted-foreground ml-auto">{m.membership_plan}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── Template Selector ── */}
            <section>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Select WhatsApp Template</p>

              {tplLoading ? (
                <div className="flex items-center gap-3 px-4 py-3 bg-muted/40 rounded-xl">
                  <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading WhatsApp templates...</p>
                </div>
              ) : tplError ? (
                <div className="flex items-center justify-between px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-600">Unable to fetch templates</p>
                  <button onClick={loadTemplates} className="text-xs text-red-600 underline">Retry</button>
                </div>
              ) : templates.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-3 bg-muted/30 rounded-xl border-2 border-dashed border-border">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/50" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground">No templates found</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">n8n se templates fetch nahi hue</p>
                  </div>
                  <button onClick={loadTemplates} className="text-xs text-primary underline flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              ) : (
                <TemplateDropdown templates={templates} selected={selectedTpl} onSelect={setSelectedTpl} />
              )}

              {/* Template detail card */}
              {selectedTpl && (
                <div className="mt-3 bg-muted/30 rounded-xl border border-border p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[11px] px-2 py-1 rounded-lg font-bold uppercase tracking-wide ${CAT_COLORS[selectedTpl.category?.toUpperCase() ?? ""] ?? "bg-muted text-muted-foreground"}`}>
                      <Tag className="w-2.5 h-2.5 inline mr-1" />{selectedTpl.category ?? "—"}
                    </span>
                    {selectedTpl.language && (
                      <span className="text-[11px] px-2 py-1 rounded-lg bg-muted text-muted-foreground flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" />{selectedTpl.language}
                      </span>
                    )}
                    {selectedTpl.status && (
                      <span className={`text-[11px] px-2 py-1 rounded-lg font-medium ${selectedTpl.status?.toUpperCase() === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {selectedTpl.status}
                      </span>
                    )}
                    {variables.length > 0 && (
                      <span className="text-[11px] px-2 py-1 rounded-lg bg-blue-100 text-blue-700 ml-auto">
                        {variables.length} variable{variables.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Buttons preview */}
                  {getButtons(selectedTpl).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {getButtons(selectedTpl).map((btn, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-[#25D366]/10 text-[#128C7E] font-medium border border-[#25D366]/20">
                          {btn}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── Variable Inputs ── */}
            {variables.length > 0 && (
              <section>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  Fill Variables
                </p>
                <div className="space-y-2.5">
                  {variables.map((v, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{i + 1}</span>
                      </div>
                      <input
                        value={v}
                        onChange={e => setVariables(prev => {
                          const next = [...prev]; next[i] = e.target.value; return next;
                        })}
                        placeholder={`Variable ${i + 1}`}
                        className="flex-1 text-sm px-3 py-2 border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Live Preview ── */}
            {selectedTpl && (
              <section>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  Template Preview
                </p>
                <div className="bg-[#efeae2] dark:bg-[#0b141a] rounded-xl p-4 flex justify-start">
                  <WaBubble
                    header={previewHeader || undefined}
                    body={previewBody || getBody(selectedTpl) || "(No body)"}
                    footer={previewFooter || undefined}
                    buttons={previewBtns}
                  />
                </div>
              </section>
            )}
          </div>

          {/* ── Sticky Send Button ── */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-border bg-background">
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !selectedTpl || targetMembers.length === 0}
              className="w-full py-3 bg-[#25D366] hover:bg-[#20b859] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {sending ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4" />
                  Send to {targetMembers.length} Member{targetMembers.length !== 1 ? "s" : ""}
                  {selectedTpl && <span className="opacity-75 text-xs font-normal">via {selectedTpl.name}</span>}
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
