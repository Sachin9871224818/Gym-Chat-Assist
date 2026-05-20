import { useState, useEffect, useCallback, useMemo } from "react";
import { IndianRupee, TrendingUp, Clock, Users, RefreshCw, Calendar, ChevronDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const PRICES: Record<string, number> = {
  "Monthly": 2000,
  "Quarterly": 5000,
  "Half Yearly": 9000,
  "Yearly": 17000,
};

const PLAN_COLORS: Record<string, string> = {
  "Monthly": "#f97316",
  "Quarterly": "#3b82f6",
  "Half Yearly": "#8b5cf6",
  "Yearly": "#10b981",
};

interface N8nMember {
  member_id: string;
  name: string;
  phone: number | string;
  age?: number;
  gender?: string;
  membership_plan: string;
  membership_expiry: string;
  join_date: string;
  fee_status: string;
  status: string;
  [key: string]: unknown;
}

type FilterMode = "day" | "month" | "year" | "custom" | "all";

function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function StatTile({
  icon: Icon, label, value, sub, color, loading,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string; loading?: boolean;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          {loading ? (
            <div className="h-7 w-28 bg-muted rounded animate-pulse mt-1.5" />
          ) : (
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          )}
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ml-3 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function Accounting() {
  const [members, setMembers] = useState<N8nMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>("month");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [planFilter, setPlanFilter] = useState("All");
  const [feeFilter, setFeeFilter] = useState("All");

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const res = await fetch(`${base}/api/webhook-proxy/gymbot_members`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : data ? [data] : []);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const isInRange = useCallback((joinDate: string): boolean => {
    if (!joinDate) return false;
    const d = new Date(joinDate);
    if (isNaN(d.getTime())) return false;
    const ds = d.toISOString().split("T")[0];
    if (filterMode === "all") return true;
    if (filterMode === "day") return ds === selectedDate;
    if (filterMode === "month") return ds.slice(0, 7) === selectedMonth;
    if (filterMode === "year") return ds.slice(0, 4) === selectedYear;
    if (filterMode === "custom") return ds >= customFrom && ds <= customTo;
    return true;
  }, [filterMode, selectedDate, selectedMonth, selectedYear, customFrom, customTo]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const inRange = isInRange(m.join_date);
      const matchPlan = planFilter === "All" || m.membership_plan === planFilter;
      const matchFee = feeFilter === "All" || m.fee_status?.toLowerCase() === feeFilter.toLowerCase();
      return inRange && matchPlan && matchFee;
    });
  }, [members, isInRange, planFilter, feeFilter]);

  const paid = useMemo(() => filteredMembers.filter(m => m.fee_status?.toLowerCase() === "paid"), [filteredMembers]);
  const pending = useMemo(() => filteredMembers.filter(m => m.fee_status?.toLowerCase() !== "paid"), [filteredMembers]);

  const totalRevenue = useMemo(() => paid.reduce((s, m) => s + (PRICES[m.membership_plan] ?? 0), 0), [paid]);
  const pendingRevenue = useMemo(() => pending.reduce((s, m) => s + (PRICES[m.membership_plan] ?? 0), 0), [pending]);

  const planBreakdown = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    paid.forEach(m => {
      const plan = m.membership_plan || "Unknown";
      if (!map[plan]) map[plan] = { count: 0, revenue: 0 };
      map[plan].count++;
      map[plan].revenue += PRICES[plan] ?? 0;
    });
    return Object.entries(map).map(([plan, v]) => ({ plan, ...v }));
  }, [paid]);

  const monthlyChart = useMemo(() => {
    if (filterMode !== "year" && filterMode !== "all") return [];
    const map: Record<string, number> = {};
    paid.forEach(m => {
      if (!m.join_date) return;
      const mo = new Date(m.join_date).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      map[mo] = (map[mo] ?? 0) + (PRICES[m.membership_plan] ?? 0);
    });
    return Object.entries(map)
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [paid, filterMode]);

  const availableYears = useMemo(() => {
    const years = new Set(members.map(m => m.join_date?.slice(0, 4)).filter(Boolean));
    return Array.from(years).sort().reverse();
  }, [members]);

  return (
    <div className="p-6 space-y-6">

      {/* Filter Bar */}
      <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">

          {/* Mode tabs */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {(["day", "month", "year", "custom", "all"] as FilterMode[]).map(m => (
              <button
                key={m}
                onClick={() => setFilterMode(m)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors capitalize ${
                  filterMode === m ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "all" ? "All Time" : m === "custom" ? "Custom" : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {/* Date inputs */}
          {filterMode === "day" && (
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="text-sm px-3 py-1.5 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          )}
          {filterMode === "month" && (
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="text-sm px-3 py-1.5 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          )}
          {filterMode === "year" && (
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
              className="text-sm px-3 py-1.5 border border-input rounded-lg bg-background focus:outline-none">
              {availableYears.length > 0
                ? availableYears.map(y => <option key={y} value={y}>{y}</option>)
                : <option>{selectedYear}</option>}
            </select>
          )}
          {filterMode === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="text-sm px-3 py-1.5 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <span className="text-xs text-muted-foreground">to</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="text-sm px-3 py-1.5 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          )}

          <div className="flex gap-2 ml-auto">
            <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
              className="text-sm px-3 py-1.5 border border-input rounded-lg bg-background focus:outline-none">
              <option value="All">All Plans</option>
              {Object.keys(PRICES).map(p => <option key={p}>{p}</option>)}
            </select>
            <select value={feeFilter} onChange={e => setFeeFilter(e.target.value)}
              className="text-sm px-3 py-1.5 border border-input rounded-lg bg-background focus:outline-none">
              <option value="All">All Payments</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
            </select>
            <button onClick={loadMembers} disabled={loading}
              className="p-2 rounded-lg border border-input hover:bg-muted transition-colors disabled:opacity-50" title="Refresh">
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={IndianRupee} label="Total Revenue" value={fmt(totalRevenue)} sub={`${paid.length} paid members`} color="bg-emerald-100 text-emerald-600" loading={loading} />
        <StatTile icon={Clock} label="Pending Revenue" value={fmt(pendingRevenue)} sub={`${pending.length} unpaid members`} color="bg-red-100 text-red-600" loading={loading} />
        <StatTile icon={TrendingUp} label="Avg per Member" value={paid.length ? fmt(Math.round(totalRevenue / paid.length)) : "₹0"} sub="among paid" color="bg-blue-100 text-blue-600" loading={loading} />
        <StatTile icon={Users} label="Total Members" value={String(filteredMembers.length)} sub={`in selected period`} color="bg-primary/10 text-primary" loading={loading} />
      </div>

      {/* Charts row */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Monthly bar chart (year / all-time view) */}
          {(filterMode === "year" || filterMode === "all") && monthlyChart.length > 0 ? (
            <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-foreground mb-4">Revenue by Month</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyChart} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: "hsl(var(--muted))" }} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-foreground mb-4">Revenue by Plan</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={planBreakdown} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="plan" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: "hsl(var(--muted))" }} />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                    {planBreakdown.map((entry, i) => (
                      <Cell key={i} fill={PLAN_COLORS[entry.plan] ?? "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Pie chart: plan split */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-foreground mb-4">Plan Split</p>
            {planBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={planBreakdown} dataKey="revenue" nameKey="plan" cx="50%" cy="50%" outerRadius={65} label={({ plan, percent }) => `${plan} ${(percent * 100).toFixed(0)}%`} labelLine={false}
                    style={{ fontSize: 10 }}>
                    {planBreakdown.map((entry, i) => (
                      <Cell key={i} fill={PLAN_COLORS[entry.plan] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Plan summary cards */}
      {!loading && planBreakdown.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(PRICES).map(([plan, price]) => {
            const count = paid.filter(m => m.membership_plan === plan).length;
            return (
              <div key={plan} className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: PLAN_COLORS[plan] }} />
                  <span className="text-xs font-semibold text-foreground">{plan}</span>
                </div>
                <p className="text-lg font-bold text-foreground">₹{(count * price).toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{count} members × ₹{price.toLocaleString("en-IN")}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Transactions table */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Transactions</p>
            <span className="text-xs text-muted-foreground ml-1">({filteredMembers.length} records)</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Member</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Join Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Expiry</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No transactions found for the selected period
                  </td>
                </tr>
              ) : (
                filteredMembers
                  .slice()
                  .sort((a, b) => new Date(b.join_date).getTime() - new Date(a.join_date).getTime())
                  .map((m, idx) => {
                    const amount = PRICES[m.membership_plan] ?? 0;
                    const isPaid = m.fee_status?.toLowerCase() === "paid";
                    return (
                      <tr key={m.member_id ?? idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-primary">{m.name?.[0] ?? "?"}</span>
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-xs">{m.name}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">{m.status}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                          {String(m.phone).replace(/^91/, "")}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ background: PLAN_COLORS[m.membership_plan] + "20", color: PLAN_COLORS[m.membership_plan] }}>
                            {m.membership_plan || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-semibold ${isPaid ? "text-emerald-600" : "text-red-500"}`}>
                            {amount ? fmt(amount) : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                          {m.join_date ? formatDate(m.join_date) : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                          {m.membership_expiry ? formatDate(m.membership_expiry) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            isPaid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                          }`}>
                            {m.fee_status || "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
            {!loading && filteredMembers.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-foreground">
                    Total ({filteredMembers.length} records)
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-600">{fmt(totalRevenue)}</td>
                  <td colSpan={3} className="px-4 py-3 text-xs text-muted-foreground">
                    {pending.length > 0 && <span className="text-red-500">{fmt(pendingRevenue)} pending</span>}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
