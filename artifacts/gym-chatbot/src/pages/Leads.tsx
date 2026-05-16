import { useState } from "react";
import { useListLeads, useUpdateLead, useCreateLead, getListLeadsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-amber-100 text-amber-700",
  contacted: "bg-blue-100 text-blue-700",
  converted: "bg-emerald-100 text-emerald-700",
};

const STATUSES = ["new", "contacted", "converted"];

export default function Leads() {
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const params = status ? { status } : {};
  const { data: leads, isLoading } = useListLeads(params, { query: { queryKey: getListLeadsQueryKey(params) } });
  const updateLead = useUpdateLead();
  const createLead = useCreateLead();

  const form = useForm({ defaultValues: { name: "", phone: "", email: "", interest: "" } });

  function onSubmit(data: Record<string, unknown>) {
    createLead.mutate({ data: data as never }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        setOpen(false);
        form.reset();
        toast({ title: "Lead added" });
      },
    });
  }

  function handleStatusChange(id: number, newStatus: string) {
    updateLead.mutate({ id, data: { status: newStatus } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        toast({ title: "Lead status updated" });
      },
    });
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setStatus("")} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${!status ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`} data-testid="filter-leads-all">All</button>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatus(s === status ? "" : s)} className={`text-xs px-3 py-1.5 rounded-full font-medium capitalize transition-colors ${status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`} data-testid={`filter-leads-${s}`}>{s}</button>
          ))}
        </div>
        <button onClick={() => setOpen(true)} data-testid="button-add-lead" className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium">
          <Plus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Interest</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}</tr>
                ))
              ) : (leads?.length ?? 0) === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No leads found</td></tr>
              ) : (
                leads?.map(lead => (
                  <tr key={lead.id} data-testid={`row-lead-${lead.id}`} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{lead.name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{lead.phone}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{lead.interest || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${STATUS_COLORS[lead.status] ?? "bg-muted text-muted-foreground"}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                      {new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.status}
                        onChange={e => handleStatusChange(lead.id, e.target.value)}
                        className="text-xs px-2 py-1 border border-input rounded-md bg-background focus:outline-none"
                        data-testid={`select-lead-status-${lead.id}`}
                      >
                        {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Lead</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit as never)} className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name *</label>
              <input {...form.register("name", { required: true })} data-testid="input-lead-name" className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone *</label>
              <input {...form.register("phone", { required: true })} data-testid="input-lead-phone" className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input {...form.register("email")} data-testid="input-lead-email" className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Interest</label>
              <input {...form.register("interest")} placeholder="e.g. Membership Inquiry" data-testid="input-lead-interest" className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 text-sm border border-input rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button type="submit" disabled={createLead.isPending} data-testid="button-submit-lead" className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                {createLead.isPending ? "Saving..." : "Add Lead"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
