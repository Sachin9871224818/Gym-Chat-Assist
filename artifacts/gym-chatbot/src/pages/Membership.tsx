import { useState, useMemo } from "react";
import { useListMembers, useRenewMembership, getListMembersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  CreditCard, Users, AlertTriangle, CheckCircle, XCircle,
  ChevronRight, RefreshCw, IndianRupee, TrendingUp, Clock,
  Search, Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

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

export default function Membership() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [renewId, setRenewId] = useState<number | null>(null);
  const [renewPlan, setRenewPlan] = useState("1 Month");
  const [renewPayment, setRenewPayment] = useState("paid");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: members = [], isLoading } = useListMembers({}, { query: { queryKey: getListMembersQueryKey({}) } });
  const renewMembership = useRenewMembership();

  const now = new Date();

  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter(m => m.status === "active").length;
    const expired = members.filter(m => m.status === "expired").length;
    const expiringSoon = members.filter(m => {
      const days = Math.ceil((new Date(m.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return days > 0 && days <= 30 && m.status === "active";
    }).length;
    const revenue = members.reduce((sum, m) => sum + (PRICES[m.plan] ?? 0), 0);
    const paid = members.filter(m => m.paymentStatus === "paid").length;
    const pending = members.filter(m => m.paymentStatus === "pending" || m.paymentStatus === "partial" || m.paymentStatus === "unpaid").length;
    return { total, active, expired, expiringSoon, revenue, paid, pending };
  }, [members]);

  const planBreakdown = useMemo(() => {
    return PLANS.map(plan => ({
      plan,
      count: members.filter(m => m.plan === plan).length,
      revenue: members.filter(m => m.plan === plan).length * (PRICES[plan] ?? 0),
      color: PLAN_COLORS[plan],
    }));
  }, [members]);

  const filtered = useMemo(() => {
    return members.filter(m => {
      const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.phone.includes(search);
      const matchStatus = !statusFilter || m.status === statusFilter;
      const matchPlan = !planFilter || m.plan === planFilter;
      const matchPayment = !paymentFilter || m.paymentStatus === paymentFilter;
      return matchSearch && matchStatus && matchPlan && matchPayment;
    }).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }, [members, search, statusFilter, planFilter, paymentFilter]);

  function getDaysLeft(expiryDate: string) {
    return Math.ceil((new Date(expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

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

  const renewingMember = members.find(m => m.id === renewId);

  return (
    <div className="p-6 space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5 text-blue-500" />}
          bg="bg-blue-50"
          label="Total Members"
          value={stats.total}
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5 text-emerald-500" />}
          bg="bg-emerald-50"
          label="Active"
          value={stats.active}
        />
        <StatCard
          icon={<XCircle className="w-5 h-5 text-red-500" />}
          bg="bg-red-50"
          label="Expired"
          value={stats.expired}
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
          bg="bg-amber-50"
          label="Expiring Soon"
          value={stats.expiringSoon}
          sub="within 30 days"
        />
        <StatCard
          icon={<IndianRupee className="w-5 h-5 text-violet-500" />}
          bg="bg-violet-50"
          label="Total Revenue"
          value={`₹${stats.revenue.toLocaleString("en-IN")}`}
        />
        <StatCard
          icon={<CreditCard className="w-5 h-5 text-orange-500" />}
          bg="bg-orange-50"
          label="Pending Payment"
          value={stats.pending}
          sub="members"
        />
      </div>

      {/* Charts + Plan Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Revenue by Plan bar chart */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Revenue by Plan</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={planBreakdown} barSize={28}>
              <XAxis dataKey="plan" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {planBreakdown.map(entry => (
                  <Cell key={entry.plan} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Plan breakdown cards */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Subscription Breakdown</p>
          </div>
          <div className="space-y-3">
            {planBreakdown.map(p => (
              <div key={p.plan} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{p.plan}</span>
                    <span className="text-xs text-muted-foreground">{p.count} members · ₹{p.revenue.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: stats.total > 0 ? `${(p.count / stats.total) * 100}%` : "0%", background: p.color }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {stats.total === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No subscription data yet</p>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-border grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-600">{stats.paid}</p>
              <p className="text-xs text-muted-foreground">Paid</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-red-500">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending / Partial</p>
            </div>
          </div>
        </div>
      </div>

      {/* Expiring Soon Alert */}
      {stats.expiringSoon > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">{stats.expiringSoon} membership{stats.expiringSoon > 1 ? "s" : ""} expiring within 30 days</p>
            <p className="text-xs text-amber-700 mt-0.5">Contact these members to renew before expiry.</p>
          </div>
          <button
            onClick={() => setStatusFilter("active")}
            className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900 underline whitespace-nowrap"
          >
            View all
          </button>
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
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-xs border border-input rounded-lg px-2 py-1.5 bg-background focus:outline-none">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
            <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className="text-xs border border-input rounded-lg px-2 py-1.5 bg-background focus:outline-none">
              <option value="">All Plans</option>
              {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="text-xs border border-input rounded-lg px-2 py-1.5 bg-background focus:outline-none">
              <option value="">All Payments</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="pending">Pending</option>
              <option value="unpaid">Unpaid</option>
            </select>
            {(search || statusFilter || planFilter || paymentFilter) && (
              <button
                onClick={() => { setSearch(""); setStatusFilter(""); setPlanFilter(""); setPaymentFilter(""); }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear
              </button>
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Revenue</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No subscriptions found
                  </td>
                </tr>
              ) : (
                filtered.map(m => {
                  const daysLeft = getDaysLeft(m.expiryDate);
                  const isExpired = m.status === "expired";
                  const isExpiringSoon = !isExpired && daysLeft <= 30;

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
                        <div>
                          <p className="text-xs font-medium text-foreground">
                            {new Date(m.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          {isExpired ? (
                            <p className="text-xs text-red-500 font-medium">Expired</p>
                          ) : (
                            <p className={`text-xs font-medium flex items-center gap-0.5 ${isExpiringSoon ? "text-amber-500" : "text-muted-foreground"}`}>
                              {isExpiringSoon && <Clock className="w-3 h-3" />}
                              {daysLeft}d left
                            </p>
                          )}
                        </div>
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
                      <td className="px-4 py-3 text-sm font-semibold text-foreground hidden xl:table-cell">
                        ₹{(PRICES[m.plan] ?? 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setRenewId(m.id); setRenewPlan(m.plan); setRenewPayment("paid"); }}
                            className="flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-md transition-colors font-medium"
                            title="Renew membership"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Renew
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
            <div>
              <p className="text-base font-bold text-foreground">Renew Membership</p>
              <p className="text-sm text-muted-foreground mt-0.5">{renewingMember.name} · {renewingMember.phone}</p>
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
                <select
                  value={renewPlan}
                  onChange={e => setRenewPlan(e.target.value)}
                  className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {PLANS.map(p => (
                    <option key={p} value={p}>{p} — ₹{PRICES[p].toLocaleString("en-IN")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Payment Status</label>
                <select
                  value={renewPayment}
                  onChange={e => setRenewPayment(e.target.value)}
                  className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
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

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setRenewId(null)}
                className="flex-1 py-2.5 text-sm border border-input rounded-xl hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRenew}
                disabled={renewMembership.isPending}
                className="flex-1 py-2.5 text-sm bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
              >
                {renewMembership.isPending ? "Renewing..." : "Confirm Renewal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, bg, label, value, sub }: { icon: React.ReactNode; bg: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
