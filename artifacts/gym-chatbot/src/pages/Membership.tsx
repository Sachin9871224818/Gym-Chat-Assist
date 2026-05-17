import { useState, useMemo, useEffect } from "react";
import { useListMembers, useRenewMembership, getListMembersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  CreditCard, Users, AlertTriangle, CheckCircle, XCircle,
  ChevronRight, RefreshCw, IndianRupee, TrendingUp, Clock,
  Search, Filter, Phone, MessageSquare, X, Bell, Loader2, Send
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const WA_CONFIG_KEY = "fitpro_wa_config";
const WA_API_KEY = "skgym2026";
const DEFAULT_WA_WEBHOOK = "https://n8n.grindoverdreams.in/webhook/gymbot_marketing";

function getWAWebhook(integrationId: string): string {
  try {
    const cfg = JSON.parse(localStorage.getItem(WA_CONFIG_KEY) ?? "{}");
    return cfg[integrationId]?.webhookUrl || DEFAULT_WA_WEBHOOK;
  } catch { return DEFAULT_WA_WEBHOOK; }
}

const PLANS = ["1 Month", "3 Months", "6 Months", "1 Year"];
const PRICES: Record<string, number> = {
  "1 Month": 2000,
  "3 Months": 5000,
  "6 Months": 9000,
  "1 Year": 17000,
};
const PLAN_COLORS: Record<string, string> = {
  "1 Month": "#f97316",
  "3 Months": "#3b82f6",
  "6 Months": "#8b5cf6",
  "1 Year": "#10b981",
};

type TileFilter = "all" | "active" | "expired" | "expiring" | "pending";

interface ContactEntry {
  date: string;
  note: string;
  type: "call" | "message" | "visit";
}

const CONTACT_LOG_KEY = "fitpro_contact_log";

function loadContactLog(): Record<number, ContactEntry[]> {
  try {
    return JSON.parse(localStorage.getItem(CONTACT_LOG_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveContactLog(log: Record<number, ContactEntry[]>) {
  localStorage.setItem(CONTACT_LOG_KEY, JSON.stringify(log));
}

export default function Membership() {
  const [tileFilter, setTileFilter] = useState<TileFilter>("all");
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [renewId, setRenewId] = useState<number | null>(null);
  const [renewPlan, setRenewPlan] = useState("1 Month");
  const [renewPayment, setRenewPayment] = useState("paid");
  const [contactId, setContactId] = useState<number | null>(null);
  const [contactNote, setContactNote] = useState("");
  const [contactType, setContactType] = useState<ContactEntry["type"]>("call");
  const [contactLog, setContactLog] = useState<Record<number, ContactEntry[]>>(loadContactLog);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ sent: number; failed: number } | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: members = [], isLoading } = useListMembers({}, { query: { queryKey: getListMembersQueryKey({}) } });
  const renewMembership = useRenewMembership();
  const now = new Date();

  useEffect(() => { saveContactLog(contactLog); }, [contactLog]);

  function getDaysLeft(expiryDate: string) {
    return Math.ceil((new Date(expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter(m => m.status === "active").length;
    const expired = members.filter(m => m.status === "expired").length;
    const expiringSoon = members.filter(m => {
      const d = getDaysLeft(m.expiryDate);
      return d > 0 && d <= 30 && m.status === "active";
    }).length;
    const revenue = members.reduce((sum, m) => sum + (PRICES[m.plan] ?? 0), 0);
    const paid = members.filter(m => m.paymentStatus === "paid").length;
    const pending = members.filter(m => ["pending", "partial", "unpaid"].includes(m.paymentStatus)).length;
    return { total, active, expired, expiringSoon, revenue, paid, pending };
  }, [members]);

  const planBreakdown = useMemo(() => PLANS.map(plan => ({
    plan,
    count: members.filter(m => m.plan === plan).length,
    revenue: members.filter(m => m.plan === plan).length * (PRICES[plan] ?? 0),
    color: PLAN_COLORS[plan],
  })), [members]);

  const filtered = useMemo(() => {
    return members.filter(m => {
      const daysLeft = getDaysLeft(m.expiryDate);
      const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.phone.includes(search);
      const matchPlan = !planFilter || m.plan === planFilter;
      let matchTile = true;
      if (tileFilter === "active") matchTile = m.status === "active" && !(daysLeft > 0 && daysLeft <= 30);
      else if (tileFilter === "expired") matchTile = m.status === "expired";
      else if (tileFilter === "expiring") matchTile = daysLeft > 0 && daysLeft <= 30 && m.status === "active";
      else if (tileFilter === "pending") matchTile = ["pending", "partial", "unpaid"].includes(m.paymentStatus);
      return matchSearch && matchPlan && matchTile;
    }).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }, [members, search, planFilter, tileFilter]);

  const expiringMembers = useMemo(() =>
    members.filter(m => { const d = getDaysLeft(m.expiryDate); return d > 0 && d <= 30 && m.status === "active"; })
      .sort((a, b) => getDaysLeft(a.expiryDate) - getDaysLeft(b.expiryDate)),
    [members]);

  function handleRenew() {
    if (!renewId) return;
    renewMembership.mutate({ id: renewId, data: { plan: renewPlan, paymentStatus: renewPayment } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMembersQueryKey({}) });
        setRenewId(null);
        toast({ title: "Membership renewed successfully" });
      },
      onError: () => toast({ title: "Renewal failed", variant: "destructive" }),
    });
  }

  function logContact() {
    if (!contactId) return;
    const entry: ContactEntry = {
      date: new Date().toISOString(),
      note: contactNote.trim() || "Contacted",
      type: contactType,
    };
    setContactLog(prev => ({
      ...prev,
      [contactId]: [entry, ...(prev[contactId] ?? [])].slice(0, 10),
    }));
    setContactNote("");
    setContactId(null);
    toast({ title: "Contact logged" });
  }

  function getLastContact(memberId: number) {
    const entries = contactLog[memberId];
    if (!entries?.length) return null;
    return entries[0];
  }

  async function sendBulkReminders() {
    if (!expiringMembers.length || bulkSending) return;
    setBulkSending(true);
    setBulkResult(null);
    const webhookUrl = getWAWebhook("expiry_reminder");
    let sent = 0;
    let failed = 0;
    for (const m of expiringMembers) {
      const daysLeft = getDaysLeft(m.expiryDate);
      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": WA_API_KEY },
          body: JSON.stringify({
            event: "expiry_reminder",
            name: m.name,
            phone: m.phone,
            plan: m.plan,
            expiry_date: m.expiryDate,
            days_left: daysLeft,
            source: "gym_dashboard_bulk",
          }),
        });
        res.ok ? sent++ : failed++;
      } catch {
        failed++;
      }
    }
    setBulkSending(false);
    setBulkResult({ sent, failed });
    toast({
      title: `WhatsApp Bulk Send Complete`,
      description: `${sent} sent successfully${failed > 0 ? `, ${failed} failed` : ""}`,
      variant: failed > 0 ? "destructive" : "default",
    });
  }

  const renewingMember = members.find(m => m.id === renewId);
  const contactingMember = members.find(m => m.id === contactId);

  const tiles: { key: TileFilter; label: string; value: string | number; sub?: string; icon: React.ReactNode; bg: string; activeColor: string }[] = [
    { key: "all", label: "Total Members", value: stats.total, icon: <Users className="w-5 h-5 text-blue-500" />, bg: "bg-blue-50", activeColor: "ring-blue-400" },
    { key: "active", label: "Active", value: stats.active, icon: <CheckCircle className="w-5 h-5 text-emerald-500" />, bg: "bg-emerald-50", activeColor: "ring-emerald-400" },
    { key: "expired", label: "Expired", value: stats.expired, icon: <XCircle className="w-5 h-5 text-red-500" />, bg: "bg-red-50", activeColor: "ring-red-400" },
    { key: "expiring", label: "Expiring Soon", value: stats.expiringSoon, sub: "within 30 days", icon: <AlertTriangle className="w-5 h-5 text-amber-500" />, bg: "bg-amber-50", activeColor: "ring-amber-400" },
    { key: "all", label: "Total Revenue", value: `₹${stats.revenue.toLocaleString("en-IN")}`, icon: <IndianRupee className="w-5 h-5 text-violet-500" />, bg: "bg-violet-50", activeColor: "ring-violet-400" },
    { key: "pending", label: "Pending Payment", value: stats.pending, sub: "members", icon: <CreditCard className="w-5 h-5 text-orange-500" />, bg: "bg-orange-50", activeColor: "ring-orange-400" },
  ];

  return (
    <div className="p-6 space-y-6">

      {/* Clickable Stat Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {tiles.map((tile, i) => {
          const isActive = tileFilter === tile.key && !(tile.key === "all" && tileFilter === "all" && i !== 0);
          const isRevenueTile = tile.label === "Total Revenue";
          return (
            <button
              key={`${tile.key}-${i}`}
              onClick={() => {
                if (isRevenueTile) return;
                setTileFilter(prev => prev === tile.key && tile.key !== "all" ? "all" : tile.key);
                setSearch("");
                setPlanFilter("");
              }}
              className={`bg-card border rounded-xl p-4 shadow-sm text-left transition-all duration-150
                ${isRevenueTile ? "cursor-default" : "cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"}
                ${tileFilter === tile.key && !isRevenueTile ? `ring-2 ${tile.activeColor} border-transparent` : "border-card-border hover:border-primary/30"}
              `}
            >
              <div className={`w-9 h-9 rounded-lg ${tile.bg} flex items-center justify-center mb-3`}>
                {tile.icon}
              </div>
              <p className="text-xl font-bold text-foreground">{tile.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{tile.label}</p>
              {tile.sub && <p className="text-[10px] text-muted-foreground">{tile.sub}</p>}
              {!isRevenueTile && (
                <p className="text-[10px] text-primary/60 mt-1">{tileFilter === tile.key ? "Filtering ↓" : "Click to filter"}</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Revenue by Plan</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={planBreakdown} barSize={28}>
              <XAxis dataKey="plan" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]} onClick={(d) => { setPlanFilter(d.plan); setTileFilter("all"); }}>
                {planBreakdown.map(entry => (
                  <Cell key={entry.plan} fill={entry.color} style={{ cursor: "pointer" }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground text-center mt-1">Click a bar to filter by plan</p>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Subscription Breakdown</p>
          </div>
          <div className="space-y-3">
            {planBreakdown.map(p => (
              <button
                key={p.plan}
                onClick={() => { setPlanFilter(prev => prev === p.plan ? "" : p.plan); setTileFilter("all"); }}
                className={`w-full flex items-center gap-3 rounded-lg px-2 py-1 transition-colors text-left ${planFilter === p.plan ? "bg-muted" : "hover:bg-muted/50"}`}
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{p.plan}</span>
                    <span className="text-xs text-muted-foreground">{p.count} members · ₹{p.revenue.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: stats.total > 0 ? `${(p.count / stats.total) * 100}%` : "0%", background: p.color }} />
                  </div>
                </div>
              </button>
            ))}
            {stats.total === 0 && <p className="text-xs text-muted-foreground text-center py-4">No subscription data yet</p>}
          </div>
          <div className="mt-5 pt-4 border-t border-border grid grid-cols-2 gap-3">
            <button onClick={() => { setTileFilter("all"); setPlanFilter(""); }} className="text-center hover:bg-muted rounded-lg p-2 transition-colors">
              <p className="text-lg font-bold text-emerald-600">{stats.paid}</p>
              <p className="text-xs text-muted-foreground">Paid</p>
            </button>
            <button onClick={() => { setTileFilter("pending"); setPlanFilter(""); }} className={`text-center hover:bg-muted rounded-lg p-2 transition-colors ${tileFilter === "pending" ? "bg-muted" : ""}`}>
              <p className="text-lg font-bold text-red-500">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending / Partial</p>
            </button>
          </div>
        </div>
      </div>

      {/* Follow-up Reminder Section */}
      {expiringMembers.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Bell className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Expiry Reminders</p>
              <p className="text-xs text-muted-foreground">
                {expiringMembers.length} member{expiringMembers.length > 1 ? "s" : ""} expiring within 30 days
                {bulkResult && (
                  <span className="ml-2 text-emerald-600 font-medium">
                    · Last bulk: {bulkResult.sent} sent{bulkResult.failed > 0 ? `, ${bulkResult.failed} failed` : ""}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={sendBulkReminders}
                disabled={bulkSending || expiringMembers.length === 0}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#25D366] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
              >
                {bulkSending
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Sending…</>
                  : <><Send className="w-3 h-3" /> WhatsApp All ({expiringMembers.length})</>
                }
              </button>
              <button
                onClick={() => setTileFilter("expiring")}
                className="text-xs text-primary font-medium hover:underline"
              >
                Show in table
              </button>
            </div>
          </div>

          <div className="divide-y divide-border">
            {expiringMembers.map(m => {
              const daysLeft = getDaysLeft(m.expiryDate);
              const lastContact = getLastContact(m.id);
              const daysSinceContact = lastContact
                ? Math.floor((Date.now() - new Date(lastContact.date).getTime()) / (1000 * 60 * 60 * 24))
                : null;

              return (
                <div key={m.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">{m.name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.phone} · {m.plan}</p>
                    {lastContact && (
                      <p className="text-[11px] text-emerald-600 mt-0.5">
                        Last contacted: {daysSinceContact === 0 ? "Today" : `${daysSinceContact}d ago`} — {lastContact.note}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${daysLeft <= 7 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {daysLeft}d left
                    </span>
                    <button
                      onClick={() => { setContactId(m.id); setContactNote(""); setContactType("call"); }}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
                    >
                      <Phone className="w-3 h-3" /> Log Contact
                    </button>
                    <button
                      onClick={() => { setRenewId(m.id); setRenewPlan(m.plan); setRenewPayment("paid"); }}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-primary text-primary rounded-lg hover:bg-primary/5 transition-colors font-medium"
                    >
                      <RefreshCw className="w-3 h-3" /> Renew
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters + Table */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                placeholder="Search by name or phone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-48"
              />
            </div>
            <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className="text-xs border border-input rounded-lg px-2 py-1.5 bg-background focus:outline-none">
              <option value="">All Plans</option>
              {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {(search || planFilter || tileFilter !== "all") && (
              <button
                onClick={() => { setSearch(""); setPlanFilter(""); setTileFilter("all"); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-input rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
              >
                <X className="w-3 h-3" /> Clear filters
              </button>
            )}
            {tileFilter !== "all" && (
              <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-medium capitalize">
                {tileFilter === "expiring" ? "Expiring Soon" : tileFilter}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground whitespace-nowrap">{filtered.length} of {members.length} members</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Member</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expiry</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Payment</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Last Contact</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  ))}</tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">No subscriptions found</td></tr>
              ) : (
                filtered.map(m => {
                  const daysLeft = getDaysLeft(m.expiryDate);
                  const isExpired = m.status === "expired";
                  const isExpiringSoon = !isExpired && daysLeft <= 30;
                  const lastContact = getLastContact(m.id);
                  const daysSinceContact = lastContact
                    ? Math.floor((Date.now() - new Date(lastContact.date).getTime()) / (1000 * 60 * 60 * 24))
                    : null;

                  return (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/members/${m.id}`}>
                          <div className="flex items-center gap-2.5 cursor-pointer">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-primary">{m.name[0]}</span>
                            </div>
                            <div>
                              <p className="font-medium text-foreground hover:text-primary text-sm">{m.name}</p>
                              <p className="text-xs text-muted-foreground">{m.phone}</p>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: PLAN_COLORS[m.plan] ?? "#ccc" }} />
                          <span className="text-sm font-medium">{m.plan}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                        {new Date(m.joiningDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-foreground">
                          {new Date(m.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        {isExpired ? (
                          <p className="text-xs text-red-500 font-medium">Expired</p>
                        ) : (
                          <p className={`text-xs font-medium flex items-center gap-0.5 ${isExpiringSoon ? "text-amber-500" : "text-muted-foreground"}`}>
                            {isExpiringSoon && <Clock className="w-3 h-3" />}{daysLeft}d left
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          isExpired ? "bg-red-100 text-red-700"
                          : isExpiringSoon ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {isExpired ? "Expired" : isExpiringSoon ? "Expiring" : "Active"}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          m.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700"
                          : m.paymentStatus === "partial" ? "bg-blue-100 text-blue-700"
                          : "bg-red-100 text-red-700"
                        }`}>
                          {m.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {lastContact ? (
                          <div>
                            <p className="text-xs text-emerald-600 font-medium">
                              {daysSinceContact === 0 ? "Today" : `${daysSinceContact}d ago`}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate max-w-[100px]">{lastContact.note}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">—</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {(isExpired || isExpiringSoon) && (
                            <button
                              onClick={() => { setContactId(m.id); setContactNote(""); setContactType("call"); }}
                              className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors"
                              title="Log contact"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => { setRenewId(m.id); setRenewPlan(m.plan); setRenewPayment("paid"); }}
                            className="flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-md transition-colors font-medium"
                          >
                            <RefreshCw className="w-3 h-3" /> Renew
                          </button>
                          <Link href={`/members/${m.id}`}>
                            <ChevronRight className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Renew Modal */}
      {renewId && renewingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-bold text-foreground">Renew Membership</p>
                <p className="text-sm text-muted-foreground mt-0.5">{renewingMember.name} · {renewingMember.phone}</p>
              </div>
              <button onClick={() => setRenewId(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Plan</span>
                <span className="font-medium">{renewingMember.plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expires</span>
                <span className={`font-medium ${renewingMember.status === "expired" ? "text-red-500" : "text-foreground"}`}>
                  {new Date(renewingMember.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">New Plan</label>
                <select value={renewPlan} onChange={e => setRenewPlan(e.target.value)} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {PLANS.map(p => <option key={p} value={p}>{p} — ₹{PRICES[p].toLocaleString("en-IN")}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Payment Status</label>
                <select value={renewPayment} onChange={e => setRenewPayment(e.target.value)} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div className="bg-primary/5 rounded-lg p-3 flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Amount</span>
                <span className="text-lg font-bold text-primary">₹{(PRICES[renewPlan] ?? 0).toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRenewId(null)} className="flex-1 py-2.5 text-sm border border-input rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleRenew} disabled={renewMembership.isPending} className="flex-1 py-2.5 text-sm bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity font-medium">
                {renewMembership.isPending ? "Renewing..." : "Confirm Renewal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Contact Modal */}
      {contactId && contactingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-bold text-foreground">Log Contact</p>
                <p className="text-sm text-muted-foreground mt-0.5">{contactingMember.name} · {contactingMember.phone}</p>
              </div>
              <button onClick={() => setContactId(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Contact Type</label>
              <div className="flex gap-2 mt-2">
                {([["call", "Call", Phone], ["message", "Message", MessageSquare], ["visit", "Visit", Users]] as const).map(([val, lbl, Icon]) => (
                  <button
                    key={val}
                    onClick={() => setContactType(val)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg border transition-colors font-medium ${
                      contactType === val ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Note</label>
              <textarea
                value={contactNote}
                onChange={e => setContactNote(e.target.value)}
                placeholder="e.g. Discussed renewal, interested in 3 month plan..."
                rows={3}
                className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            {contactLog[contactId]?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Previous Contacts</p>
                <div className="space-y-1.5 max-h-28 overflow-y-auto">
                  {contactLog[contactId].map((c, i) => (
                    <div key={i} className="text-xs bg-muted/40 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="capitalize font-medium text-foreground">{c.type}</span>
                        <span className="text-muted-foreground">{new Date(c.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                      </div>
                      <p className="text-muted-foreground">{c.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setContactId(null)} className="flex-1 py-2.5 text-sm border border-input rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={logContact} className="flex-1 py-2.5 text-sm bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity font-medium">
                Save Contact
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
