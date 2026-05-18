import { useState, useEffect } from "react";
import {
  useListMembers, useCreateMember, useDeleteMember,
  useListTrainers, getListMembersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Search, ChevronRight, Trash2, Loader2, Calculator, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const N8N_WEBHOOK = "https://n8n.grindoverdreams.in/webhook/gymbot";
const N8N_API_KEY = "skgym2026";

const PLAN_OPTIONS = [
  { label: "Monthly", value: "Monthly", months: 1, localValue: "1 Month" },
  { label: "Quarterly", value: "Quarterly", months: 3, localValue: "3 Months" },
  { label: "Half Yearly", value: "Half Yearly", months: 6, localValue: "6 Months" },
  { label: "Yearly", value: "Yearly", months: 12, localValue: "1 Year" },
];

const PRICES: Record<string, number> = {
  "1 Month": 2000, "3 Months": 5000, "6 Months": 9000, "1 Year": 17000,
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  expired: "bg-red-100 text-red-700",
  trial: "bg-blue-100 text-blue-700",
};

function calcExpiry(joinDate: string, months: number): string {
  if (!joinDate) return "";
  const d = new Date(joinDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function calcBmi(weight: number, height: number): number {
  if (!weight || !height || height === 0) return 0;
  const h = height / 100;
  return Math.round((weight / (h * h)) * 10) / 10;
}

function getISTTimestamp(): string {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

interface FormState {
  name: string;
  phone: string;
  age: string;
  gender: string;
  weight: string;
  height: string;
  bmi: string;
  goal: string;
  experience_level: string;
  injury_notes: string;
  join_date: string;
  membership_plan: string;
  membership_expiry: string;
  fee_status: string;
  assigned_trainer: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  phone: "",
  age: "",
  gender: "Male",
  weight: "",
  height: "",
  bmi: "",
  goal: "Weight Loss",
  experience_level: "Beginner",
  injury_notes: "",
  join_date: new Date().toISOString().split("T")[0],
  membership_plan: "Monthly",
  membership_expiry: calcExpiry(new Date().toISOString().split("T")[0], 1),
  fee_status: "Paid",
  assigned_trainer: "",
};

export default function Members() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const { toast } = useToast();
  const qc = useQueryClient();

  const params = {
    ...(search ? { search } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(planFilter ? { plan: planFilter } : {}),
  };
  const { data: members, isLoading } = useListMembers(params, { query: { queryKey: getListMembersQueryKey(params) } });
  const { data: trainers = [] } = useListTrainers({ query: { queryKey: ["trainers"] } });
  const createMember = useCreateMember();
  const deleteMember = useDeleteMember();

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value };

      if (key === "weight" || key === "height") {
        const w = parseFloat(key === "weight" ? value as string : prev.weight);
        const h = parseFloat(key === "height" ? value as string : prev.height);
        if (w > 0 && h > 0) {
          next.bmi = String(calcBmi(w, h));
        } else {
          next.bmi = "";
        }
      }

      if (key === "membership_plan" || key === "join_date") {
        const plan = PLAN_OPTIONS.find(p => p.value === (key === "membership_plan" ? value : prev.membership_plan));
        const date = key === "join_date" ? value as string : prev.join_date;
        if (plan && date) {
          next.membership_expiry = calcExpiry(date, plan.months);
        }
      }

      return next;
    });
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.phone.trim()) e.phone = "Required";
    else if (!/^\d{10,15}$/.test(form.phone.replace(/\s/g, ""))) e.phone = "Enter valid phone (10-15 digits)";
    if (!form.age || Number(form.age) < 5 || Number(form.age) > 100) e.age = "Enter valid age";
    if (form.weight && Number(form.weight) <= 0) e.weight = "Invalid";
    if (form.height && Number(form.height) <= 0) e.height = "Invalid";
    if (!form.join_date) e.join_date = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const selectedPlan = PLAN_OPTIONS.find(p => p.value === form.membership_plan)!;
    const bmiNum = form.bmi ? parseFloat(form.bmi) : 0;

    const rawPhone = form.phone.replace(/\D/g, "");
    const phone = rawPhone.startsWith("91") ? rawPhone : `91${rawPhone}`;

    const n8nPayload = {
      event: "member_welcome",
      name: form.name.trim(),
      phone,
      age: Number(form.age),
      gender: form.gender,
      weight: form.weight ? Number(form.weight) : null,
      height: form.height ? Number(form.height) : null,
      bmi: bmiNum || null,
      goal: form.goal,
      experience_level: form.experience_level,
      injury_notes: form.injury_notes.trim() || null,
      join_date: form.join_date,
      membership_plan: form.membership_plan,
      expiry_date: form.membership_expiry,
      payment_status: form.fee_status,
      status: "active",
      assigned_trainer: form.assigned_trainer || null,
    };

    const localPayload = {
      name: form.name.trim(),
      phone: form.phone.replace(/\s/g, ""),
      age: Number(form.age),
      gender: form.gender,
      weight: form.weight ? Number(form.weight) : undefined,
      height: form.height ? Number(form.height) : undefined,
      goal: form.goal,
      plan: selectedPlan.localValue,
      joiningDate: form.join_date,
      paymentStatus: form.fee_status === "Paid" ? "paid" : "pending",
    };

    let n8nOk = false;
    let localOk = false;

    try {
      const res = await fetch(N8N_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": N8N_API_KEY },
        body: JSON.stringify(n8nPayload),
      });
      n8nOk = res.ok;
    } catch {
      n8nOk = false;
    }

    await new Promise<void>((resolve) => {
      createMember.mutate({ data: localPayload as never }, {
        onSuccess: () => { localOk = true; resolve(); },
        onError: () => { localOk = false; resolve(); },
      });
    });

    setSubmitting(false);

    if (localOk || n8nOk) {
      qc.invalidateQueries({ queryKey: getListMembersQueryKey() });
      setOpen(false);
      setForm(INITIAL_FORM);
      setErrors({});
      toast({
        title: "Member registered successfully!",
        description: n8nOk
          ? "Saved to n8n data table & local database."
          : "Saved to local database (n8n sync pending).",
      });
    } else {
      toast({ title: "Registration failed", description: "Both n8n and local save failed. Please try again.", variant: "destructive" });
    }
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

  const bmiCategory = (bmi: number) => {
    if (!bmi) return null;
    if (bmi < 18.5) return { label: "Underweight", color: "text-blue-500" };
    if (bmi < 25) return { label: "Normal", color: "text-emerald-500" };
    if (bmi < 30) return { label: "Overweight", color: "text-amber-500" };
    return { label: "Obese", color: "text-red-500" };
  };

  const bmiVal = form.bmi ? parseFloat(form.bmi) : 0;
  const bmiCat = bmiCategory(bmiVal);

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
              className="pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-52"
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-input rounded-lg px-3 py-2 bg-background focus:outline-none">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
          </select>
          <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className="text-sm border border-input rounded-lg px-3 py-2 bg-background focus:outline-none">
            <option value="">All Plans</option>
            {PLAN_OPTIONS.map(p => <option key={p.value} value={p.localValue}>{p.label}</option>)}
          </select>
        </div>
        <button
          onClick={() => { setForm(INITIAL_FORM); setErrors({}); setOpen(true); }}
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
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  ))}</tr>
                ))
              ) : (members?.length ?? 0) === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No members found</td></tr>
              ) : members?.map(m => (
                <tr key={m.id} className="hover:bg-muted/30 transition-colors">
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
                      <button onClick={e => handleDelete(e, m.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <Link href={`/members/${m.id}`}>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">Register New Member</h2>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Scrollable Form */}
            <form onSubmit={onSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* Section: Personal Info */}
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Personal Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs font-medium text-muted-foreground">Full Name *</label>
                    <input
                      value={form.name}
                      onChange={e => setField("name", e.target.value)}
                      placeholder="e.g. Sachin Kumar"
                      className={`mt-1 w-full text-sm px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.name ? "border-red-400" : "border-input"}`}
                    />
                    {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Phone Number *</label>
                    <input
                      value={form.phone}
                      onChange={e => setField("phone", e.target.value.replace(/[^\d\s]/g, ""))}
                      placeholder="10-digit mobile number"
                      inputMode="numeric"
                      className={`mt-1 w-full text-sm px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.phone ? "border-red-400" : "border-input"}`}
                    />
                    {errors.phone && <p className="text-xs text-red-500 mt-0.5">{errors.phone}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Age *</label>
                    <input
                      type="number"
                      value={form.age}
                      onChange={e => setField("age", e.target.value)}
                      min={5} max={100}
                      className={`mt-1 w-full text-sm px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.age ? "border-red-400" : "border-input"}`}
                    />
                    {errors.age && <p className="text-xs text-red-500 mt-0.5">{errors.age}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Gender *</label>
                    <select value={form.gender} onChange={e => setField("gender", e.target.value)} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none">
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section: Body Stats */}
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Body Statistics</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.weight}
                      onChange={e => setField("weight", e.target.value)}
                      placeholder="72"
                      className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Height (cm)</label>
                    <input
                      type="number"
                      value={form.height}
                      onChange={e => setField("height", e.target.value)}
                      placeholder="175"
                      className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Calculator className="w-3 h-3" /> BMI (auto)
                    </label>
                    <div className={`mt-1 w-full text-sm px-3 py-2 border rounded-lg bg-muted/30 ${bmiCat ? "border-primary/30" : "border-input"}`}>
                      {bmiVal > 0 ? (
                        <span className={`font-semibold ${bmiCat?.color}`}>{bmiVal} <span className="text-xs font-normal">({bmiCat?.label})</span></span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Fitness Profile */}
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Fitness Profile</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Goal *</label>
                    <select value={form.goal} onChange={e => setField("goal", e.target.value)} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none">
                      <option>Weight Loss</option>
                      <option>Muscle Gain</option>
                      <option>Fat Loss</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Experience Level *</label>
                    <select value={form.experience_level} onChange={e => setField("experience_level", e.target.value)} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none">
                      <option>Beginner</option>
                      <option>Intermediate</option>
                      <option>Advanced</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Injury Notes</label>
                    <input
                      value={form.injury_notes}
                      onChange={e => setField("injury_notes", e.target.value)}
                      placeholder="e.g. Knee pain, shoulder injury (leave blank if none)"
                      className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Assigned Trainer</label>
                    <select value={form.assigned_trainer} onChange={e => setField("assigned_trainer", e.target.value)} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none">
                      <option value="">— No trainer assigned —</option>
                      {(trainers as { id: number; name: string }[]).map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section: Membership */}
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Membership & Payment</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Membership Plan *</label>
                    <select value={form.membership_plan} onChange={e => setField("membership_plan", e.target.value)} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none">
                      {PLAN_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Joining Date *</label>
                    <input
                      type="date"
                      value={form.join_date}
                      onChange={e => setField("join_date", e.target.value)}
                      className={`mt-1 w-full text-sm px-3 py-2 border rounded-lg bg-background focus:outline-none ${errors.join_date ? "border-red-400" : "border-input"}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Membership Expiry (auto)</label>
                    <div className="mt-1 w-full text-sm px-3 py-2 border border-primary/30 rounded-lg bg-muted/30 font-medium text-foreground">
                      {form.membership_expiry
                        ? new Date(form.membership_expiry).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Payment Status *</label>
                    <select value={form.fee_status} onChange={e => setField("fee_status", e.target.value)} className="mt-1 w-full text-sm px-3 py-2 border border-input rounded-lg bg-background focus:outline-none">
                      <option value="Paid">Paid</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-4 py-2.5 text-xs text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Status: <span className="font-semibold text-emerald-600 ml-1">Active</span>
                      <span className="ml-auto text-[10px]">Auto-set on registration</span>
                    </div>
                  </div>
                </div>
              </div>
            </form>

            {/* Footer Buttons */}
            <div className="px-6 py-4 border-t border-border flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 text-sm border border-input rounded-xl hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                disabled={submitting}
                className="flex-1 py-2.5 text-sm bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity font-medium flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Registering...</>
                ) : (
                  "Register Member"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
