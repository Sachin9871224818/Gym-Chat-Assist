import { useState } from "react";
import { useListBroadcasts, useCreateBroadcast, getListBroadcastsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Megaphone, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

const TYPES = ["offer", "announcement", "festival", "promotion"];
const AUDIENCES = ["all", "active", "expired"];

const TYPE_COLORS: Record<string, string> = {
  offer: "bg-amber-100 text-amber-700",
  announcement: "bg-blue-100 text-blue-700",
  festival: "bg-purple-100 text-purple-700",
  promotion: "bg-emerald-100 text-emerald-700",
};

export default function Broadcasts() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: rawBroadcasts, isLoading } = useListBroadcasts({ query: { queryKey: getListBroadcastsQueryKey() } });
  const broadcasts = Array.isArray(rawBroadcasts) ? rawBroadcasts : [];
  const createBroadcast = useCreateBroadcast();

  const form = useForm({ defaultValues: { title: "", message: "", type: "announcement", targetAudience: "all" } });

  function onSubmit(data: Record<string, unknown>) {
    createBroadcast.mutate({ data: data as never }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBroadcastsQueryKey() });
        setOpen(false);
        form.reset();
        toast({ title: "Broadcast sent successfully" });
      },
      onError: () => toast({ title: "Failed to send broadcast", variant: "destructive" }),
    });
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{broadcasts?.length ?? 0} broadcasts</p>
        <button onClick={() => setOpen(true)} data-testid="button-create-broadcast" className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium">
          <Plus className="w-4 h-4" /> New Broadcast
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (broadcasts?.length ?? 0) === 0 ? (
        <div className="bg-card border border-card-border rounded-xl py-16 text-center">
          <Megaphone className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No broadcasts sent yet</p>
          <button onClick={() => setOpen(true)} className="mt-3 text-sm text-primary hover:underline">Send your first broadcast</button>
        </div>
      ) : (
        <div className="space-y-3">
          {broadcasts?.map(b => (
            <div key={b.id} className="bg-card border border-card-border rounded-xl p-5 shadow-sm" data-testid={`card-broadcast-${b.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="font-semibold text-foreground">{b.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TYPE_COLORS[b.type] ?? "bg-muted text-muted-foreground"}`}>{b.type}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{b.message}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-1 text-sm font-semibold text-foreground justify-end">
                    <Send className="w-3.5 h-3.5 text-primary" />
                    {b.sentCount}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">recipients</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                <span>Audience: <strong className="text-foreground capitalize">{b.targetAudience}</strong></span>
                <span>·</span>
                <span>{new Date(b.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Broadcast</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit as never)} className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title *</label>
              <input {...form.register("title", { required: true })} placeholder="e.g. New Year Offer" data-testid="input-broadcast-title" className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Message *</label>
              <textarea {...form.register("message", { required: true })} rows={3} placeholder="Your broadcast message..." data-testid="input-broadcast-message" className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Type *</label>
                <select {...form.register("type")} data-testid="select-broadcast-type" className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none capitalize">
                  {TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Target Audience *</label>
                <select {...form.register("targetAudience")} data-testid="select-broadcast-audience" className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none capitalize">
                  {AUDIENCES.map(a => <option key={a} value={a} className="capitalize">{a} members</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 text-sm border border-input rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button type="submit" disabled={createBroadcast.isPending} data-testid="button-submit-broadcast" className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
                <Send className="w-3.5 h-3.5" />
                {createBroadcast.isPending ? "Sending..." : "Send Broadcast"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
