import { useState, useEffect, useCallback } from "react";
import { useGetRecentActivity, useGetAttendanceStats, getGetRecentActivityQueryKey, getGetAttendanceStatsQueryKey } from "@workspace/api-client-react";
import { Users, UserCheck, TrendingUp, IndianRupee, AlertTriangle, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Link } from "wouter";

const PRICES: Record<string, number> = {
  "Monthly": 2000, "Quarterly": 5000, "Half Yearly": 9000, "Yearly": 17000,
};

interface N8nMember {
  member_id: string;
  name: string;
  phone: number | string;
  age?: number;
  gender?: string;
  membership_plan: string;
  membership_expiry: string;
  fee_status: string;
  status: string;
  assigned_trainer?: string;
  [key: string]: unknown;
}

function StatCard({ icon: Icon, label, value, sub, color, loading }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string; loading?: boolean;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          {loading ? (
            <div className="h-8 w-16 bg-muted rounded animate-pulse mt-1" />
          ) : (
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          )}
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [members, setMembers] = useState<N8nMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

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

  const { data: activity } = useGetRecentActivity({ query: { queryKey: getGetRecentActivityQueryKey() } });
  const { data: stats } = useGetAttendanceStats({ query: { queryKey: getGetAttendanceStatsQueryKey() } });

  const today = new Date();
  const in30Days = new Date(today);
  in30Days.setDate(today.getDate() + 30);

  const activeMembers = members.filter(m => m.status?.toLowerCase() === "active");
  const expiredMembers = members.filter(m => m.status?.toLowerCase() === "expired");

  const monthlyRevenue = members
    .filter(m => m.fee_status?.toLowerCase() === "paid")
    .reduce((sum, m) => sum + (PRICES[m.membership_plan] ?? 0), 0);

  const expiringList = activeMembers.filter(m => {
    if (!m.membership_expiry) return false;
    const expiry = new Date(m.membership_expiry);
    return expiry >= today && expiry <= in30Days;
  });

  const chartData = stats?.byDay?.map(d => ({
    day: new Date(d.day).toLocaleDateString("en-IN", { weekday: "short" }),
    count: d.count,
  })) ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Members"
          value={members.length}
          sub={`${activeMembers.length} active`}
          color="bg-primary/10 text-primary"
          loading={membersLoading}
        />
        <StatCard
          icon={UserCheck}
          label="Today's Attendance"
          value={stats?.todayCount ?? 0}
          sub="check-ins today"
          color="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          icon={IndianRupee}
          label="Monthly Revenue"
          value={`₹${(monthlyRevenue / 1000).toFixed(1)}k`}
          sub="total paid members"
          color="bg-blue-100 text-blue-600"
          loading={membersLoading}
        />
        <StatCard
          icon={AlertTriangle}
          label="Expiring Soon"
          value={expiringList.length}
          sub="within 30 days"
          color="bg-amber-100 text-amber-600"
          loading={membersLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance chart */}
        <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Attendance This Week</p>
              <p className="text-xs text-muted-foreground mt-0.5">Daily check-ins</p>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Week: <strong className="text-foreground">{stats?.weekCount ?? 0}</strong></span>
              <span>Month: <strong className="text-foreground">{stats?.monthCount ?? 0}</strong></span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: "hsl(var(--muted))" }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Check-ins" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Membership Breakdown */}
        <div className="space-y-4">
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Membership Breakdown</p>
            {membersLoading ? (
              <div className="space-y-2.5">
                {[1,2,3].map(i => <div key={i} className="h-5 bg-muted rounded animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground">Active</span>
                  <span className="text-sm font-semibold text-emerald-600">{activeMembers.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground">Expired</span>
                  <span className="text-sm font-semibold text-red-500">{expiredMembers.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground">Monthly</span>
                  <span className="text-sm font-semibold text-blue-600">
                    {members.filter(m => m.membership_plan === "Monthly").length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground">Quarterly+</span>
                  <span className="text-sm font-semibold text-purple-600">
                    {members.filter(m => ["Quarterly","Half Yearly","Yearly"].includes(m.membership_plan)).length}
                  </span>
                </div>
              </div>
            )}
          </div>

          <Link href="/members">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 cursor-pointer hover:bg-amber-100 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <p className="text-sm font-semibold text-amber-800">Expiring Memberships</p>
              </div>
              {membersLoading ? (
                <div className="h-4 w-40 bg-amber-100 rounded animate-pulse" />
              ) : (
                <p className="text-xs text-amber-700">
                  {expiringList.length > 0
                    ? `${expiringList.length} members expiring within 30 days`
                    : "No memberships expiring soon"}
                </p>
              )}
            </div>
          </Link>
        </div>
      </div>

      {/* Expiring Members List */}
      {!membersLoading && expiringList.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-semibold text-foreground">Members Expiring Soon</p>
            <span className="ml-auto text-xs text-muted-foreground">{expiringList.length} members</span>
          </div>
          <div className="divide-y divide-border">
            {expiringList.slice(0, 5).map((m, i) => {
              const expiry = new Date(m.membership_expiry);
              const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={m.member_id ?? i} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-amber-700">{m.name?.[0] ?? "?"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.membership_plan} · {String(m.phone).replace(/^91/, "")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-amber-600">{daysLeft}d left</p>
                    <p className="text-xs text-muted-foreground">
                      {expiry.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Activity className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Recent Activity</p>
        </div>
        <div className="divide-y divide-border">
          {(!Array.isArray(activity) || activity.length === 0) ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No recent activity</div>
          ) : (
            activity.slice(0, 8).map(item => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.type === "member" ? "bg-primary" : item.type === "lead" ? "bg-amber-500" : "bg-emerald-500"}`} />
                <p className="text-sm text-foreground flex-1">{item.description}</p>
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(item.timestamp).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
