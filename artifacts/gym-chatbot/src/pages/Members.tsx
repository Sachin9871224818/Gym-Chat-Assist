import { useState } from "react";
import { useListMembers, useCreateMember, useDeleteMember, getListMembersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Search, ChevronRight, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const PLANS = ["1 Month", "3 Months", "6 Months", "1 Year"];
const PRICES: Record<string, number> = { "1 Month": 2000, "3 Months": 5000, "6 Months": 9000, "1 Year": 17000 };
const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  expired: "bg-red-100 text-red-700",
  trial: "bg-blue-100 text-blue-700",
};

export default function Members() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const params = { ...(search ? { search } : {}), ...(status ? { status } : {}), ...(plan ? { plan } : {}) };
  const { data: members, isLoading } = useListMembers(params, { query: { queryKey: getListMembersQueryKey(params) } });
  const createMember = useCreateMember();
  const deleteMember = useDeleteMember();

  const form = useForm({
    defaultValues: { name: "", phone: "", gender: "Male", age: 25, weight: undefined, height: undefined, goal: "", plan: "1 Month", joiningDate: new Date().toISOString().split("T")[0], paymentStatus: "paid" },
  });

  function onSubmit(data: Record<string, unknown>) {
    createMember.mutate({ data: { ...data, age: Number(data.age), weight: data.weight ? Number(data.weight) : undefined, height: data.height ? Number(data.height) : undefined } as never }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMembersQueryKey() });
        setOpen(false);
        form.reset();
        toast({ title: "Member registered successfully" });
      },
      onError: () => toast({ title: "Failed to register member", variant: "destructive" }),
    });
  }

  function handleDelete(e: React.MouseEvent, id: number) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this member?")) return;
    deleteMember.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMembersQueryKey() });
        toast({ title: "Member deleted" });
      },
    });
  }

  return (
    <div className="p-6 space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="Search members..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-search-members"
              className="pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-52"
            />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)} className="text-sm border border-input rounded-lg px-3 py-2 bg-background focus:outline-none" data-testid="select-status-filter">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
          </select>
          <select value={plan} onChange={e => setPlan(e.target.value)} className="text-sm border border-input rounded-lg px-3 py-2 bg-background focus:outline-none" data-testid="select-plan-filter">
            <option value="">All Plans</option>
            {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <button
          onClick={() => setOpen(true)}
          data-testid="button-add-member"
          className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
        >
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Expiry</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Payment</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : (members?.length ?? 0) === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No members found</td></tr>
              ) : (
                members?.map(m => (
                  <tr key={m.id} data-testid={`row-member-${m.id}`} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/members/${m.id}`}>
                        <div className="flex items-center gap-2.5 cursor-pointer">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">{m.name[0]}</span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground hover:text-primary">{m.name}</p>
                            <p className="text-xs text-muted-foreground">{m.gender}, {m.age}y</p>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{m.phone}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium">{m.plan}</span>
                      <p className="text-xs text-muted-foreground">₹{PRICES[m.plan]?.toLocaleString("en-IN") ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                      {new Date(m.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[m.status] ?? "bg-muted text-muted-foreground"}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${m.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {m.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={e => handleDelete(e, m.id)} data-testid={`button-delete-member-${m.id}`} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <Link href={`/members/${m.id}`}>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register New Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit as never)} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Full Name *</label>
                <input {...form.register("name", { required: true })} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="input-member-name" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Phone *</label>
                <input {...form.register("phone", { required: true })} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="input-member-phone" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Gender *</label>
                <select {...form.register("gender")} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none" data-testid="select-member-gender">
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Age *</label>
                <input type="number" {...form.register("age")} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="input-member-age" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Weight (kg)</label>
                <input type="number" step="0.1" {...form.register("weight")} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="input-member-weight" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Height (cm)</label>
                <input type="number" {...form.register("height")} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="input-member-height" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Goal</label>
                <select {...form.register("goal")} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none" data-testid="select-member-goal">
                  <option value="">Select goal</option>
                  <option>Weight Loss</option><option>Muscle Gain</option><option>General Fitness</option><option>Endurance</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Plan *</label>
                <select {...form.register("plan")} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none" data-testid="select-member-plan">
                  {PLANS.map(p => <option key={p}>{p} — ₹{PRICES[p].toLocaleString("en-IN")}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Joining Date *</label>
                <input type="date" {...form.register("joiningDate")} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none" data-testid="input-member-joining-date" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Payment Status *</label>
                <select {...form.register("paymentStatus")} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none" data-testid="select-member-payment-status">
                  <option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="partial">Partial</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 text-sm border border-input rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button type="submit" disabled={createMember.isPending} data-testid="button-submit-member" className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
                {createMember.isPending ? "Saving..." : "Register Member"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
