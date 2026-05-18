import { useState, useEffect, useCallback } from "react";
import { Plus, Dumbbell, Pencil, Trash2, RefreshCw, Search, X, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchExercises,
  addExercise,
  updateExercise,
  deleteExercise,
  buildExerciseId,
  CATEGORIES,
  LEVELS,
  CATEGORY_COLORS,
  LEVEL_COLORS,
  type Exercise,
} from "@/services/workoutApi";

const ALL_CATEGORIES = ["All", ...CATEGORIES.map(c => c.name)];

const EMPTY_FORM = { exercise_id: "", category: "Chest", level: "beginner", title: "", description: "" };

function ExerciseFormModal({
  mode,
  initial,
  onSave,
  onClose,
  saving,
}: {
  mode: "add" | "edit";
  initial: typeof EMPTY_FORM;
  onSave: (data: typeof EMPTY_FORM) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);

  const set = (k: string, v: string) => {
    setForm(prev => {
      const updated = { ...prev, [k]: v };
      if (k === "category" || k === "level") {
        updated.exercise_id = buildExerciseId(
          k === "category" ? v : updated.category,
          k === "level" ? v : updated.level
        );
      }
      return updated;
    });
  };

  useEffect(() => {
    setForm({
      ...initial,
      exercise_id: mode === "add"
        ? buildExerciseId(initial.category, initial.level)
        : initial.exercise_id,
    });
  }, [initial, mode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{mode === "add" ? "Add Exercise" : "Edit Exercise"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Category *</label>
              <select
                value={form.category}
                onChange={e => set("category", e.target.value)}
                disabled={mode === "edit"}
                className="w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              >
                {CATEGORIES.map(c => <option key={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Level *</label>
              <select
                value={form.level}
                onChange={e => set("level", e.target.value)}
                disabled={mode === "edit"}
                className="w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 capitalize"
              >
                {LEVELS.map(l => <option key={l} value={l} className="capitalize">{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Exercise ID</label>
            <input
              value={form.exercise_id}
              readOnly
              className="w-full text-sm px-3 py-2 border border-input rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Auto-generated from category + level</p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label>
            <input
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="e.g. Chest Beginner Workout"
              className="w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description *</label>
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={5}
              placeholder="Describe the workout routine, sets, reps, rest time..."
              className="w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm border border-input rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !form.title.trim() || !form.description.trim()}
            onClick={() => onSave(form)}
            className="flex-1 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
          >
            {saving ? "Saving…" : mode === "add" ? "Add Exercise" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  exercise,
  onConfirm,
  onClose,
  deleting,
}: {
  exercise: Exercise;
  onConfirm: () => void;
  onClose: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-background rounded-2xl shadow-2xl p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Delete Exercise?</p>
          <p className="text-sm text-muted-foreground mt-1">
            "<span className="font-medium text-foreground">{exercise.title}</span>" will be permanently removed from n8n.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-input rounded-lg hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors font-medium"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WorkoutPlans() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.name)));

  const [formModal, setFormModal] = useState<{ mode: "add" | "edit"; data: typeof EMPTY_FORM } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { toast } = useToast();

  const loadExercises = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchExercises();
      setExercises(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load exercises";
      setError(msg);
      toast({ title: "Failed to load exercises", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadExercises(); }, [loadExercises]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const filteredExercises = exercises.filter(ex => {
    const matchSearch =
      !search ||
      ex.title?.toLowerCase().includes(search.toLowerCase()) ||
      ex.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      categoryFilter === "All" ||
      ex.category?.toLowerCase() === categoryFilter.toLowerCase();
    return matchSearch && matchCat;
  });

  const grouped = CATEGORIES.reduce<Record<string, Exercise[]>>((acc, cat) => {
    acc[cat.name] = filteredExercises.filter(
      ex => ex.category?.toLowerCase() === cat.name.toLowerCase()
    );
    return acc;
  }, {});

  const visibleGroups = categoryFilter === "All"
    ? CATEGORIES.filter(c => grouped[c.name].length > 0).map(c => c.name)
    : [categoryFilter].filter(c => (grouped[c]?.length ?? 0) > 0);

  async function handleSave(data: typeof EMPTY_FORM) {
    setSaving(true);
    try {
      if (formModal?.mode === "add") {
        await addExercise(data);
        toast({ title: "Exercise added successfully" });
      } else {
        await updateExercise(data);
        toast({ title: "Exercise updated successfully" });
      }
      setFormModal(null);
      await loadExercises();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Operation failed";
      toast({ title: "Failed to save exercise", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExercise(deleteTarget.exercise_id);
      toast({ title: "Exercise deleted" });
      setDeleteTarget(null);
      await loadExercises();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      toast({ title: "Failed to delete exercise", description: msg, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Category Filters */}
        <div className="flex gap-2 flex-wrap">
          {ALL_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat}
              {cat !== "All" && (
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${categoryFilter === cat ? "bg-white/20" : "bg-background"}`}>
                  {exercises.filter(e => e.category?.toLowerCase() === cat.toLowerCase()).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search + Add + Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search exercises..."
              className="pl-8 pr-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-44"
            />
          </div>
          <button
            onClick={loadExercises}
            disabled={loading}
            className="p-2 rounded-lg border border-input hover:bg-muted transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setFormModal({ mode: "add", data: { ...EMPTY_FORM } })}
            className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            <Plus className="w-4 h-4" /> Add Exercise
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl overflow-hidden animate-pulse">
              <div className="h-12 bg-muted/60" />
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 2 }).map((_, j) => <div key={j} className="h-28 bg-muted rounded-lg" />)}
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-card border border-card-border rounded-xl py-16 text-center space-y-3">
          <Dumbbell className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">Could not load exercises</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <button
            onClick={loadExercises}
            className="inline-flex items-center gap-2 mt-2 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : exercises.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl py-20 text-center space-y-3">
          <Dumbbell className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">No exercises yet</p>
          <p className="text-xs text-muted-foreground">Add your first exercise to get started</p>
          <button
            onClick={() => setFormModal({ mode: "add", data: { ...EMPTY_FORM } })}
            className="inline-flex items-center gap-2 mt-2 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
          >
            <Plus className="w-4 h-4" /> Add Exercise
          </button>
        </div>
      ) : visibleGroups.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl py-16 text-center">
          <Dumbbell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No exercises match your search</p>
          <button onClick={() => { setSearch(""); setCategoryFilter("All"); }} className="mt-2 text-xs text-primary hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleGroups.map(catName => {
            const catExercises = grouped[catName] ?? [];
            const isExpanded = expandedCategories.has(catName);
            const colorClass = CATEGORY_COLORS[catName.toLowerCase()] ?? "bg-muted text-muted-foreground border-border";

            return (
              <div key={catName} className="bg-card border border-card-border rounded-xl overflow-hidden shadow-sm">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(catName)}
                  className="w-full flex items-center justify-between px-5 py-3.5 bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${colorClass}`}>
                      {catName}
                    </span>
                    <span className="text-xs text-muted-foreground">{catExercises.length} exercise{catExercises.length !== 1 ? "s" : ""}</span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {/* Cards Grid */}
                {isExpanded && (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {catExercises.map(ex => (
                      <div key={ex.exercise_id} className="border border-border rounded-xl p-4 bg-background hover:shadow-sm transition-shadow group">
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-semibold text-sm text-foreground leading-snug">{ex.title}</p>
                          <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setFormModal({
                                mode: "edit",
                                data: {
                                  exercise_id: ex.exercise_id,
                                  category: CATEGORIES.find(c => c.name.toLowerCase() === ex.category?.toLowerCase())?.name ?? ex.category,
                                  level: ex.level,
                                  title: ex.title,
                                  description: ex.description,
                                },
                              })}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(ex)}
                              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex gap-1.5 mb-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${LEVEL_COLORS[ex.level?.toLowerCase()] ?? "bg-muted text-muted-foreground"}`}>
                            {ex.level}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            ID: {ex.exercise_id}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 whitespace-pre-line">
                          {ex.description || "No description provided."}
                        </p>

                        {/* Extra fields (future-ready) */}
                        {Object.entries(ex)
                          .filter(([k]) => !["exercise_id","category","level","title","description","id","createdAt","updatedAt"].includes(k))
                          .filter(([, v]) => v !== null && v !== undefined && v !== "")
                          .map(([k, v]) => (
                            <p key={k} className="text-[10px] text-muted-foreground mt-1">
                              <span className="font-medium capitalize">{k.replace(/_/g, " ")}:</span> {String(v)}
                            </p>
                          ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {formModal && (
        <ExerciseFormModal
          mode={formModal.mode}
          initial={formModal.data}
          onSave={handleSave}
          onClose={() => setFormModal(null)}
          saving={saving}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          exercise={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
