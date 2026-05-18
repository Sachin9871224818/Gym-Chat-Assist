import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Target, Phone, X, Mail, MessageSquare, Tag, Calendar, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-amber-100 text-amber-700 border-amber-200",
  contacted: "bg-blue-100 text-blue-700 border-blue-200",
  converted: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
const STATUS_DOT: Record<string, string> = {
  new: "bg-amber-400",
  contacted: "bg-blue-400",
  converted: "bg-emerald-400",
};

const STATUS_TABS = ["All", "New", "Contacted", "Converted"];

interface Lead {
  id?: number;
  name: string;
  phone: string;
  goal?: string | null;
  status?: string | null;
  age?: string | null;
  weight?: string | null;
  email?: string | null;
  message?: string | null;
  source?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

function normalizeStatus(lead: Lead): string {
  return lead.status?.trim().toLowerCase() || "new";
}

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground break-all">{value}</p>
      </div>
    </div>
  );
}

function DetailDrawer({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const statusKey = normalizeStatus(lead);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-sm bg-background shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Lead Details</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Avatar + Name */}
        <div className="px-5 py-5 flex items-center gap-4 border-b border-border bg-muted/20">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xl font-bold text-primary">
            {lead.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">{lead.name}</p>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border capitalize mt-1 ${STATUS_COLORS[statusKey] ?? "bg-muted text-muted-foreground border-border"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[statusKey] ?? "bg-muted-foreground"}`} />
              {statusKey}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <DetailRow icon={<Phone className="w-4 h-4" />} label="Phone" value={lead.phone} />
          {lead.email && <DetailRow icon={<Mail className="w-4 h-4" />} label="Email" value={lead.email} />}
          {lead.goal && <DetailRow icon={<Target className="w-4 h-4" />} label="Goal" value={lead.goal} />}
          {lead.age && <DetailRow icon={<Tag className="w-4 h-4" />} label="Details" value={lead.age} />}
          {lead.weight && <DetailRow icon={<Tag className="w-4 h-4" />} label="Weight" value={String(lead.weight)} />}
          {lead.source && <DetailRow icon={<Tag className="w-4 h-4" />} label="Source" value={lead.source} />}
          {lead.message && <DetailRow icon={<MessageSquare className="w-4 h-4" />} label="Message" value={lead.message} />}
          {lead.createdAt && <DetailRow icon={<Calendar className="w-4 h-4" />} label="Enquiry Date" value={formatDate(lead.createdAt)!} />}
          {lead.updatedAt && lead.updatedAt !== lead.createdAt && (
            <DetailRow icon={<Calendar className="w-4 h-4" />} label="Last Updated" value={formatDate(lead.updatedAt)!} />
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-border flex gap-2">
          <a
            href={`https://wa.me/${lead.phone?.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2.5 text-sm font-medium text-center bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
          >
            WhatsApp
          </a>
          <a
            href={`tel:${lead.phone}`}
            className="flex-1 py-2.5 text-sm font-medium text-center border border-input rounded-lg hover:bg-muted transition-colors"
          >
            Call
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("All");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [selected, setSelected] = useState<Lead | null>(null);
  const { toast } = useToast();

  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${base}/api/webhook-proxy/gymbot_leads_database`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load leads";
      setError(msg);
      toast({ title: "Failed to load leads", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [base, toast]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const filtered = leads
    .filter(lead => {
      const matchesSearch =
        !search ||
        lead.name?.toLowerCase().includes(search.toLowerCase()) ||
        lead.phone?.includes(search);
      const matchesStatus =
        statusTab === "All" ||
        normalizeStatus(lead) === statusTab.toLowerCase();
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const da = new Date(a.createdAt ?? 0).getTime();
      const db = new Date(b.createdAt ?? 0).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });

  // Count per status for badge
  const countFor = (tab: string) => {
    if (tab === "All") return leads.length;
    return leads.filter(l => normalizeStatus(l) === tab.toLowerCase()).length;
  };

  return (
    <div className="p-6 space-y-5">
      {/* Status Tabs */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                statusTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab}
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusTab === tab ? "bg-white/20 text-white" : "bg-background text-foreground"}`}>
                {countFor(tab)}
              </span>
            </button>
          ))}
        </div>

        {/* Search + Sort + Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or phone..."
              className="pl-8 pr-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-48"
            />
          </div>
          <button
            onClick={() => setSortOrder(o => o === "newest" ? "oldest" : "newest")}
            title={sortOrder === "newest" ? "Showing newest first" : "Showing oldest first"}
            className="flex items-center gap-1.5 p-2 rounded-lg border border-input hover:bg-muted transition-colors text-xs text-muted-foreground"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{sortOrder === "newest" ? "Newest" : "Oldest"}</span>
          </button>
          <button
            onClick={fetchLeads}
            disabled={loading}
            className="p-2 rounded-lg border border-input hover:bg-muted transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-4 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-6 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-card border border-card-border rounded-xl py-16 text-center space-y-3">
          <Target className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">Could not load leads</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <button
            onClick={fetchLeads}
            className="inline-flex items-center gap-2 mt-2 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl py-16 text-center">
          <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No leads found</p>
          {(search || statusTab !== "All") && (
            <button
              onClick={() => { setSearch(""); setStatusTab("All"); }}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{filtered.length} lead{filtered.length !== 1 ? "s" : ""} · sorted {sortOrder === "newest" ? "newest first" : "oldest first"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((lead, i) => {
              const statusKey = normalizeStatus(lead);
              return (
                <button
                  key={lead.id ?? i}
                  onClick={() => setSelected(lead)}
                  className="bg-card border border-card-border rounded-xl p-4 text-left hover:shadow-md hover:border-primary/30 transition-all group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 font-bold text-primary text-sm group-hover:bg-primary/20 transition-colors">
                      {lead.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{lead.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{lead.phone}</span>
                      </p>
                    </div>
                  </div>

                  {lead.goal && (
                    <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Target className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{lead.goal}</span>
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[statusKey] ?? "bg-muted text-muted-foreground border-border"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[statusKey] ?? "bg-muted-foreground"}`} />
                      {statusKey}
                    </span>
                    {lead.createdAt && (
                      <span className="text-[10px] text-muted-foreground">{formatDate(lead.createdAt)}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {selected && <DetailDrawer lead={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
