import { useGetDashboardSummary, useGetExpiringMemberships, useGetRecentActivity, useGetAttendanceStats, getGetDashboardSummaryQueryKey, getGetRecentActivityQueryKey, getGetAttendanceStatsQueryKey, getGetExpiringMembershipsQueryKey } from "@workspace/api-client-react";
import { Users, UserCheck, TrendingUp, IndianRupee, AlertTriangle, Activity, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Link } from "wouter";

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm" data-testid={`stat-card-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
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
  const { data: summary, isLoading: sumLoading } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: expiring } = useGetExpiringMemberships({ query: { queryKey: getGetExpiringMembershipsQueryKey() } });
  const { data: activity } = useGetRecentActivity({ query: { queryKey: getGetRecentActivityQueryKey() } });
  const { data: stats } = useGetAttendanceStats({ query: { queryKey: getGetAttendanceStatsQueryKey() } });

  const chartData = stats?.byDay?.map(d => ({
    day: new Date(d.day).toLocaleDateString("en-IN", { weekday: "short" }),
    count: d.count,
  })) ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Members" value={sumLoading ? "..." : (summary?.totalMembers ?? 0)} sub={`${summary?.activeMembers ?? 0} active`} color="bg-primary/10 text-primary" />
        <StatCard icon={UserCheck} label="Today's Attendance" value={sumLoading ? "..." : (summary?.todayAttendance ?? 0)} sub="check-ins today" color="bg-emerald-100 text-emerald-600" />
        <StatCard icon={IndianRupee} label="Monthly Revenue" value={sumLoading ? "..." : `₹${((summary?.monthlyRevenue ?? 0) / 1000).toFixed(1)}k`} sub="this month" color="bg-blue-100 text-blue-600" />
        <StatCard icon={AlertTriangle} label="Expiring Soon" value={sumLoading ? "..." : (summary?.expiringThisMonth ?? 0)} sub="within 30 days" color="bg-amber-100 text-amber-600" />
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

        {/* Second stats column */}
        <div className="space-y-4">
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Membership Breakdown</p>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground">Active</span>
                <span className="text-sm font-semibold text-emerald-600">{summary?.activeMembers ?? 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground">Expired</span>
                <span className="text-sm font-semibold text-red-500">{summary?.expiredMembers ?? 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground">Trainers</span>
                <span className="text-sm font-semibold text-blue-600">{summary?.totalTrainers ?? 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground">Leads</span>
                <span className="text-sm font-semibold text-amber-600">{summary?.totalLeads ?? 0}</span>
              </div>
            </div>
          </div>

          <Link href="/members?status=expired">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 cursor-pointer hover:bg-amber-100 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <p className="text-sm font-semibold text-amber-800">Expiring Memberships</p>
              </div>
              <p className="text-xs text-amber-700">{expiring?.length ?? 0} members expiring within 30 days</p>
            </div>
          </Link>
        </div>
      </div>

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
              <div key={item.id} className="flex items-center gap-3 px-5 py-3.5" data-testid={`activity-item-${item.id}`}>
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
