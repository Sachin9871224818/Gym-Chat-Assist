import { useParams, useLocation } from "wouter";
import { useGetMember, useGetMemberProgress, useListAttendance, useUpdateMember, useRenewMembership, useAddMemberProgress, getGetMemberQueryKey, getGetMemberProgressQueryKey, getListAttendanceQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, TrendingUp, Calendar } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const PLANS = ["1 Month", "3 Months", "6 Months", "1 Year"];
const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  expired: "bg-red-100 text-red-700",
  trial: "bg-blue-100 text-blue-700",
};

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [renewOpen, setRenewOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [renewPlan, setRenewPlan] = useState("1 Month");
  const [newWeight, setNewWeight] = useState("");

  const memberId = parseInt(id);
  const { data: member, isLoading } = useGetMember(memberId, { query: { queryKey: getGetMemberQueryKey(memberId) } });
  const { data: progress } = useGetMemberProgress(memberId, { query: { queryKey: getGetMemberProgressQueryKey(memberId) } });
  const { data: attendance } = useListAttendance({ memberId }, { query: { queryKey: getListAttendanceQueryKey({ memberId }) } });
  const renewMembership = useRenewMembership();
  const addProgress = useAddMemberProgress();

  const chartData = progress?.map(p => ({
    date: new Date(p.recordedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    weight: p.weight,
    bmi: p.bmi,
  })).filter(d => d.weight) ?? [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!member) {
    return <div className="p-6 text-center text-muted-foreground">Member not found</div>;
  }

  const daysUntilExpiry = Math.ceil((new Date(member.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  function handleRenew() {
    renewMembership.mutate({ id: memberId, data: { plan: renewPlan, paymentStatus: "paid" } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMemberQueryKey(memberId) });
        setRenewOpen(false);
        toast({ title: "Membership renewed successfully" });
      },
    });
  }

  function handleProgress() {
    addProgress.mutate({ id: memberId, data: { weight: newWeight ? parseFloat(newWeight) : undefined } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMemberProgressQueryKey(memberId) });
        setProgressOpen(false);
        setNewWeight("");
        toast({ title: "Progress recorded" });
      },
    });
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Back */}
      <button onClick={() => setLocation("/members")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back-members">
        <ArrowLeft className="w-4 h-4" /> Back to Members
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="text-xl font-bold text-primary">{member.name[0]}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{member.name}</h1>
            <p className="text-sm text-muted-foreground">{member.phone} {member.email ? `· ${member.email}` : ""}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[member.status] ?? "bg-muted text-muted-foreground"}`}>
                {member.status}
              </span>
              <span className="text-xs text-muted-foreground">{member.plan}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setProgressOpen(true)} data-testid="button-add-progress" className="text-sm px-3 py-2 border border-input rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> Log Progress
          </button>
          <button onClick={() => setRenewOpen(true)} data-testid="button-renew-membership" className="text-sm px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4" /> Renew
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Info cards */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Personal Info</p>
            <div className="space-y-2 text-sm">
              <Row label="Gender" value={member.gender} />
              <Row label="Age" value={`${member.age} years`} />
              <Row label="Weight" value={member.weight ? `${member.weight} kg` : "—"} />
              <Row label="Height" value={member.height ? `${member.height} cm` : "—"} />
              <Row label="BMI" value={member.bmi ? String(member.bmi) : "—"} />
              <Row label="Goal" value={member.goal || "—"} />
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Membership</p>
            <div className="space-y-2 text-sm">
              <Row label="Plan" value={member.plan} />
              <Row label="Joined" value={new Date(member.joiningDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
              <Row label="Expiry" value={new Date(member.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
              <Row label="Days Left" value={daysUntilExpiry > 0 ? `${daysUntilExpiry} days` : "Expired"} highlight={daysUntilExpiry < 10} />
              <Row label="Payment" value={member.paymentStatus} />
              <Row label="Trainer" value={member.trainerName || "Not assigned"} />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Progress chart */}
          {chartData.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground mb-3">Weight Progress</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }} name="Weight (kg)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Attendance */}
          <div className="bg-card border border-card-border rounded-xl shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
              <Calendar className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Recent Attendance</p>
              <span className="ml-auto text-xs text-muted-foreground">{attendance?.length ?? 0} records</span>
            </div>
            <div className="divide-y divide-border">
              {(attendance?.length ?? 0) === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">No attendance records</div>
              ) : (
                attendance?.slice(0, 10).map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm" data-testid={`attendance-record-${a.id}`}>
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-foreground flex-1">{a.date}</span>
                    <span className="text-muted-foreground text-xs">
                      {a.checkIn ? `In: ${new Date(a.checkIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}
                      {a.checkOut ? ` · Out: ${new Date(a.checkOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Renew Dialog */}
      {renewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-xl shadow-xl p-6 w-80 space-y-4">
            <p className="text-sm font-semibold">Renew Membership</p>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Select Plan</label>
              <select value={renewPlan} onChange={e => setRenewPlan(e.target.value)} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background" data-testid="select-renew-plan">
                {PLANS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRenewOpen(false)} className="flex-1 py-2 text-sm border border-input rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleRenew} disabled={renewMembership.isPending} data-testid="button-confirm-renew" className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                {renewMembership.isPending ? "Renewing..." : "Renew"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Dialog */}
      {progressOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-xl shadow-xl p-6 w-72 space-y-4">
            <p className="text-sm font-semibold">Log Progress</p>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Current Weight (kg)</label>
              <input type="number" step="0.1" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder={String(member.weight ?? "")} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none" data-testid="input-progress-weight" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setProgressOpen(false)} className="flex-1 py-2 text-sm border border-input rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleProgress} disabled={addProgress.isPending} data-testid="button-confirm-progress" className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                {addProgress.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${highlight ? "text-red-500" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
