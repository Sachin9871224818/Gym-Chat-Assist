import { useState } from "react";
import { useListDietPlans, useCreateDietPlan, getListDietPlansQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Salad } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

const GOALS = ["Weight Loss", "Muscle Gain", "General Fitness", "Endurance"];

export default function DietPlans() {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const params = goal ? { goal } : {};
  const { data: plans, isLoading } = useListDietPlans(params, { query: { queryKey: getListDietPlansQueryKey(params) } });
  const createDietPlan = useCreateDietPlan();

  const form = useForm({ defaultValues: { title: "", goal: "Weight Loss", content: "" } });

  function onSubmit(data: Record<string, unknown>) {
    createDietPlan.mutate({ data: data as never }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDietPlansQueryKey() });
        setOpen(false);
        form.reset();
        toast({ title: "Diet plan created" });
      },
      onError: () => toast({ title: "Failed to create plan", variant: "destructive" }),
    });
  }

  const goalColors: Record<string, string> = {
    "Weight Loss": "bg-orange-100 text-orange-700",
    "Muscle Gain": "bg-blue-100 text-blue-700",
    "General Fitness": "bg-emerald-100 text-emerald-700",
    "Endurance": "bg-purple-100 text-purple-700",
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setGoal("")} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${!goal ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`} data-testid="filter-all-goals">All</button>
          {GOALS.map(g => (
            <button key={g} onClick={() => setGoal(g === goal ? "" : g)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${goal === g ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`} data-testid={`filter-goal-${g.toLowerCase().replace(/\s/g, "-")}`}>{g}</button>
          ))}
        </div>
        <button onClick={() => setOpen(true)} data-testid="button-add-diet-plan" className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium">
          <Plus className="w-4 h-4" /> Add Plan
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (plans?.length ?? 0) === 0 ? (
        <div className="bg-card border border-card-border rounded-xl py-16 text-center">
          <Salad className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No diet plans found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans?.map(plan => (
            <div key={plan.id} className="bg-card border border-card-border rounded-xl p-5 shadow-sm" data-testid={`card-diet-plan-${plan.id}`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="font-semibold text-foreground leading-snug">{plan.title}</p>
                <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap flex-shrink-0 ${goalColors[plan.goal] ?? "bg-muted text-muted-foreground"}`}>{plan.goal}</span>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-6">{plan.content}</p>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">{plan.trainerName ? `By ${plan.trainerName}` : "General plan"}</p>
                <p className="text-xs text-muted-foreground">{new Date(plan.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Diet Plan</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit as never)} className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title *</label>
              <input {...form.register("title", { required: true })} placeholder="e.g. Weight Loss Meal Plan" data-testid="input-diet-plan-title" className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Goal *</label>
              <select {...form.register("goal")} data-testid="select-diet-plan-goal" className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none">
                {GOALS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Plan Content *</label>
              <textarea {...form.register("content", { required: true })} rows={6} placeholder="Describe the diet plan..." data-testid="input-diet-plan-content" className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 text-sm border border-input rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button type="submit" disabled={createDietPlan.isPending} data-testid="button-submit-diet-plan" className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                {createDietPlan.isPending ? "Saving..." : "Create Plan"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
