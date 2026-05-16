import { useState } from "react";
import { useListAttendance, useRecordAttendance, useListMembers, getListAttendanceQueryKey, getListMembersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Attendance() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const params = { ...(date ? { date } : {}) };
  const { data: records, isLoading } = useListAttendance(params, { query: { queryKey: getListAttendanceQueryKey(params) } });
  const { data: members } = useListMembers({}, { query: { queryKey: getListMembersQueryKey({}) } });
  const recordAttendance = useRecordAttendance();

  function handleAttendance(type: "check_in" | "check_out") {
    if (!selectedMemberId) {
      toast({ title: "Please select a member", variant: "destructive" });
      return;
    }
    recordAttendance.mutate({ data: { memberId: parseInt(selectedMemberId), type } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAttendanceQueryKey(params) });
        toast({ title: type === "check_in" ? "Check-in recorded" : "Check-out recorded" });
      },
      onError: () => toast({ title: "Failed to record attendance", variant: "destructive" }),
    });
  }

  const todayRecords = records?.filter(r => r.date === new Date().toISOString().split("T")[0]) ?? [];

  return (
    <div className="p-6 space-y-5">
      {/* Quick action card */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-foreground mb-4">Quick Attendance</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedMemberId}
            onChange={e => setSelectedMemberId(e.target.value)}
            className="flex-1 text-sm px-3 py-2.5 border border-input rounded-lg bg-background focus:outline-none"
            data-testid="select-attendance-member"
          >
            <option value="">Select member...</option>
            {members?.filter(m => m.status === "active").map(m => (
              <option key={m.id} value={m.id}>{m.name} — {m.phone}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => handleAttendance("check_in")}
              disabled={recordAttendance.isPending}
              data-testid="button-check-in"
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors font-medium"
            >
              <LogIn className="w-4 h-4" /> Check In
            </button>
            <button
              onClick={() => handleAttendance("check_out")}
              disabled={recordAttendance.isPending}
              data-testid="button-check-out"
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              <LogOut className="w-4 h-4" /> Check Out
            </button>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-muted-foreground">Date:</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none"
          data-testid="input-attendance-date"
        />
        <span className="text-sm text-muted-foreground ml-auto">
          {records?.length ?? 0} records
        </span>
      </div>

      {/* Records table */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Member</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Check In</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Check Out</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}</tr>
                ))
              ) : (records?.length ?? 0) === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">No attendance records for this date</td></tr>
              ) : (
                records?.map(r => {
                  const duration = r.checkIn && r.checkOut
                    ? Math.round((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 60000)
                    : null;
                  return (
                    <tr key={r.id} data-testid={`row-attendance-${r.id}`} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{r.memberName ?? `Member #${r.memberId}`}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                      <td className="px-4 py-3">
                        {r.checkIn ? (
                          <span className="flex items-center gap-1.5 text-emerald-600">
                            <LogIn className="w-3.5 h-3.5" />
                            {new Date(r.checkIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r.checkOut ? (
                          <span className="flex items-center gap-1.5 text-blue-600">
                            <LogOut className="w-3.5 h-3.5" />
                            {new Date(r.checkOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">Still in</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {duration !== null ? `${Math.floor(duration / 60)}h ${duration % 60}m` : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
