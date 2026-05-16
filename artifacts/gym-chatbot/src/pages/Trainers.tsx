import { useListTrainers, useCreateTrainer, useDeleteTrainer, getListTrainersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Trash2, Users, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function Trainers() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: trainers, isLoading } = useListTrainers({ query: { queryKey: getListTrainersQueryKey() } });
  const createTrainer = useCreateTrainer();
  const deleteTrainer = useDeleteTrainer();

  const form = useForm({ defaultValues: { name: "", phone: "", email: "", specialization: "", bio: "" } });

  function onSubmit(data: Record<string, unknown>) {
    createTrainer.mutate({ data: data as never }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTrainersQueryKey() });
        setOpen(false);
        form.reset();
        toast({ title: "Trainer added" });
      },
      onError: () => toast({ title: "Failed to add trainer", variant: "destructive" }),
    });
  }

  function handleDelete(e: React.MouseEvent, id: number) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Remove this trainer?")) return;
    deleteTrainer.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTrainersQueryKey() });
        toast({ title: "Trainer removed" });
      },
    });
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{trainers?.length ?? 0} trainers</p>
        <button onClick={() => setOpen(true)} data-testid="button-add-trainer" className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium">
          <Plus className="w-4 h-4" /> Add Trainer
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (trainers?.length ?? 0) === 0 ? (
        <div className="bg-card border border-card-border rounded-xl py-16 text-center">
          <p className="text-muted-foreground text-sm">No trainers added yet</p>
          <button onClick={() => setOpen(true)} className="mt-3 text-sm text-primary hover:underline">Add your first trainer</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trainers?.map(t => (
            <Link key={t.id} href={`/trainers/${t.id}`}>
              <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" data-testid={`card-trainer-${t.id}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">{t.name[0]}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => handleDelete(e, t.id)} data-testid={`button-delete-trainer-${t.id}`} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
                <p className="font-semibold text-foreground">{t.name}</p>
                {t.specialization && <p className="text-xs text-primary font-medium mt-0.5">{t.specialization}</p>}
                <p className="text-xs text-muted-foreground mt-1">{t.phone}</p>
                {t.bio && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{t.bio}</p>}
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{t.memberCount} members assigned</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Trainer</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit as never)} className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name *</label>
              <input {...form.register("name", { required: true })} data-testid="input-trainer-name" className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone *</label>
              <input {...form.register("phone", { required: true })} data-testid="input-trainer-phone" className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input {...form.register("email")} data-testid="input-trainer-email" className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Specialization</label>
              <input {...form.register("specialization")} placeholder="e.g. Strength & Conditioning" data-testid="input-trainer-specialization" className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Bio</label>
              <textarea {...form.register("bio")} rows={2} data-testid="input-trainer-bio" className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 text-sm border border-input rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button type="submit" disabled={createTrainer.isPending} data-testid="button-submit-trainer" className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                {createTrainer.isPending ? "Saving..." : "Add Trainer"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
