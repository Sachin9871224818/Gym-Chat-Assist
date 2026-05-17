import { useState, useEffect } from "react";
import {
  CheckCircle, XCircle, Send, ChevronDown, ChevronUp,
  Users, CreditCard, ClipboardList, Salad, Dumbbell,
  Target, Gift, UserCheck, RefreshCw, Megaphone, CalendarCheck, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_WEBHOOK = "https://n8n.grindoverdreams.in/webhook/converso";
const CONFIG_KEY = "fitpro_wa_config";
const API_KEY = "skgym2026";

interface IntegrationConfig {
  enabled: boolean;
  webhookUrl: string;
}

function loadConfig(): Record<string, IntegrationConfig> {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "{}"); } catch { return {}; }
}
function saveConfig(c: Record<string, IntegrationConfig>) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
}

interface Integration {
  id: string;
  category: string;
  categoryColor: string;
  icon: React.ReactNode;
  name: string;
  description: string;
  trigger: string;
  testPayload: Record<string, unknown>;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "member_welcome",
    category: "Members",
    categoryColor: "bg-blue-100 text-blue-700",
    icon: <Users className="w-5 h-5 text-blue-600" />,
    name: "New Member Welcome",
    description: "Naya member register hone par usse WhatsApp pe welcome message aur membership details bhejo.",
    trigger: "Jab bhi naya member register ho",
    testPayload: { event: "member_welcome", name: "Test Member", phone: "9999999999", plan: "Monthly", join_date: new Date().toISOString().split("T")[0], source: "gym_dashboard" },
  },
  {
    id: "birthday_wish",
    category: "Members",
    categoryColor: "bg-blue-100 text-blue-700",
    icon: <Gift className="w-5 h-5 text-pink-500" />,
    name: "Birthday Greetings",
    description: "Member ke birthday pe automatically WhatsApp pe wishes aur special offer bhejo.",
    trigger: "Member ke birthday wale din (daily automation)",
    testPayload: { event: "birthday_wish", name: "Test Member", phone: "9999999999", source: "gym_dashboard" },
  },
  {
    id: "trainer_assigned",
    category: "Members",
    categoryColor: "bg-blue-100 text-blue-700",
    icon: <UserCheck className="w-5 h-5 text-indigo-500" />,
    name: "Trainer Assignment",
    description: "Jab member ko trainer assign ho, toh member ko WhatsApp pe trainer ki details bhejo.",
    trigger: "Trainer assign hone par",
    testPayload: { event: "trainer_assigned", name: "Test Member", phone: "9999999999", trainer: "Vikas Singh", source: "gym_dashboard" },
  },
  {
    id: "expiry_reminder",
    category: "Membership",
    categoryColor: "bg-amber-100 text-amber-700",
    icon: <CreditCard className="w-5 h-5 text-amber-600" />,
    name: "Expiry Reminder",
    description: "Membership expire hone se pehle member ko WhatsApp reminder bhejo aur renew karne ka option do.",
    trigger: "Expiry se 7, 15 aur 30 din pehle (automatic)",
    testPayload: { event: "expiry_reminder", name: "Test Member", phone: "9999999999", expiry_date: "2026-06-01", days_left: 7, plan: "Monthly", source: "gym_dashboard" },
  },
  {
    id: "renewal_confirm",
    category: "Membership",
    categoryColor: "bg-amber-100 text-amber-700",
    icon: <RefreshCw className="w-5 h-5 text-emerald-600" />,
    name: "Renewal Confirmation",
    description: "Membership renew hone par member ko new expiry date aur plan ke saath confirmation bhejo.",
    trigger: "Membership renew hone par",
    testPayload: { event: "renewal_confirm", name: "Test Member", phone: "9999999999", new_plan: "Quarterly", new_expiry: "2026-09-01", amount: 5000, source: "gym_dashboard" },
  },
  {
    id: "payment_due",
    category: "Membership",
    categoryColor: "bg-amber-100 text-amber-700",
    icon: <CreditCard className="w-5 h-5 text-red-500" />,
    name: "Payment Due Reminder",
    description: "Pending ya partial payment wale members ko WhatsApp pe payment reminder bhejo.",
    trigger: "Jab payment status pending/partial ho",
    testPayload: { event: "payment_due", name: "Test Member", phone: "9999999999", amount_due: 2000, plan: "Monthly", source: "gym_dashboard" },
  },
  {
    id: "checkin_confirm",
    category: "Attendance",
    categoryColor: "bg-emerald-100 text-emerald-700",
    icon: <ClipboardList className="w-5 h-5 text-emerald-600" />,
    name: "Check-in Confirmation",
    description: "Member gym aane par WhatsApp pe check-in confirmation bhejo.",
    trigger: "Har attendance check-in par",
    testPayload: { event: "checkin_confirm", name: "Test Member", phone: "9999999999", checkin_time: new Date().toLocaleTimeString("en-IN"), source: "gym_dashboard" },
  },
  {
    id: "checkout_confirm",
    category: "Attendance",
    categoryColor: "bg-emerald-100 text-emerald-700",
    icon: <CalendarCheck className="w-5 h-5 text-teal-600" />,
    name: "Check-out Summary",
    description: "Member gym se nikalne par aaj ka workout summary aur total time bhejo.",
    trigger: "Attendance check-out par",
    testPayload: { event: "checkout_confirm", name: "Test Member", phone: "9999999999", duration_minutes: 65, source: "gym_dashboard" },
  },
  {
    id: "diet_plan",
    category: "Plans",
    categoryColor: "bg-green-100 text-green-700",
    icon: <Salad className="w-5 h-5 text-green-600" />,
    name: "Diet Plan Share",
    description: "Member ka personalized diet plan WhatsApp pe bhejo — breakfast, lunch, dinner, snacks ke saath.",
    trigger: "Manual trigger ya plan create hone par",
    testPayload: { event: "diet_plan", name: "Test Member", phone: "9999999999", plan_title: "Weight Loss Diet", source: "gym_dashboard" },
  },
  {
    id: "workout_plan",
    category: "Plans",
    categoryColor: "bg-green-100 text-green-700",
    icon: <Dumbbell className="w-5 h-5 text-purple-600" />,
    name: "Workout Plan Share",
    description: "Member ka weekly workout schedule WhatsApp pe bhejo — exercises, sets, reps ke saath.",
    trigger: "Manual trigger ya plan assign hone par",
    testPayload: { event: "workout_plan", name: "Test Member", phone: "9999999999", plan_title: "Muscle Gain Program", source: "gym_dashboard" },
  },
  {
    id: "lead_followup",
    category: "Leads & Marketing",
    categoryColor: "bg-violet-100 text-violet-700",
    icon: <Target className="w-5 h-5 text-violet-600" />,
    name: "Lead Auto Follow-up",
    description: "Naye lead inquiry aane par automatically WhatsApp pe gym information, timing aur plans bhejo.",
    trigger: "Naya lead add hone par",
    testPayload: { event: "lead_followup", name: "Test Lead", phone: "9999999999", interest: "Membership", source: "gym_dashboard" },
  },
  {
    id: "trial_booking",
    category: "Leads & Marketing",
    categoryColor: "bg-violet-100 text-violet-700",
    icon: <CalendarCheck className="w-5 h-5 text-orange-500" />,
    name: "Trial Booking Confirmation",
    description: "Trial session book hone par WhatsApp pe confirmation aur gym address/map link bhejo.",
    trigger: "Trial booking hone par",
    testPayload: { event: "trial_booking", name: "Test Lead", phone: "9999999999", trial_date: new Date().toISOString().split("T")[0], map_link: "https://share.google/xn74qajNaPA0gtmef", source: "gym_dashboard" },
  },
  {
    id: "bulk_broadcast",
    category: "Leads & Marketing",
    categoryColor: "bg-violet-100 text-violet-700",
    icon: <Megaphone className="w-5 h-5 text-red-500" />,
    name: "Bulk Broadcast",
    description: "Saare ya selected members ko ek saath WhatsApp pe custom message bhejo — offers, announcements, etc.",
    trigger: "Manual trigger (dashboard se)",
    testPayload: { event: "bulk_broadcast", message: "Test broadcast message from FitPro Gym!", target: "all_members", source: "gym_dashboard" },
  },
];

const CATEGORIES = ["Members", "Membership", "Attendance", "Plans", "Leads & Marketing"];

export default function WhatsApp() {
  const [config, setConfig] = useState<Record<string, IntegrationConfig>>(loadConfig);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { saveConfig(config); }, [config]);

  function getIntConfig(id: string): IntegrationConfig {
    return config[id] ?? { enabled: false, webhookUrl: DEFAULT_WEBHOOK };
  }

  function toggle(id: string) {
    setConfig(prev => ({
      ...prev,
      [id]: { ...getIntConfig(id), ...prev[id], enabled: !(prev[id]?.enabled ?? false) },
    }));
  }

  function setWebhook(id: string, url: string) {
    setConfig(prev => ({ ...prev, [id]: { ...(prev[id] ?? { enabled: false }), webhookUrl: url } }));
  }

  async function testSend(integration: Integration) {
    const cfg = getIntConfig(integration.id);
    const url = cfg.webhookUrl || DEFAULT_WEBHOOK;
    setTesting(integration.id);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify(integration.testPayload),
      });
      if (res.ok) {
        toast({ title: `Test sent: ${integration.name}`, description: "n8n webhook successfully hit!" });
      } else {
        toast({ title: "Webhook responded with error", description: `HTTP ${res.status}`, variant: "destructive" });
      }
    } catch {
      toast({ title: "Connection failed", description: "Webhook URL reachable nahi hai.", variant: "destructive" });
    }
    setTesting(null);
  }

  const activeCount = INTEGRATIONS.filter(i => getIntConfig(i.id).enabled).length;

  return (
    <div className="p-6 space-y-6">

      {/* Summary Header */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-7 h-7 fill-[#25D366]">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">WhatsApp Automations</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Ye sare sections n8n webhook se connect hokar WhatsApp messages bhejte hain</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-bold text-[#25D366]">{activeCount}</p>
          <p className="text-xs text-muted-foreground">of {INTEGRATIONS.length} active</p>
        </div>
      </div>

      {/* Default Webhook Info */}
      <div className="bg-muted/40 border border-border rounded-xl px-4 py-3 flex items-start gap-3 text-xs text-muted-foreground">
        <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-blue-600 font-bold text-[10px]">i</span>
        </div>
        <div>
          <span className="font-medium text-foreground">Default Webhook: </span>
          <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">{DEFAULT_WEBHOOK}</code>
          <span className="ml-2">— Har integration ka alag webhook URL bhi set kar sakte ho "Configure" se.</span>
        </div>
      </div>

      {/* Integration Cards by Category */}
      {CATEGORIES.map(cat => {
        const items = INTEGRATIONS.filter(i => i.category === cat);
        const catActive = items.filter(i => getIntConfig(i.id).enabled).length;
        return (
          <div key={cat}>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-sm font-semibold text-foreground">{cat}</p>
              <span className="text-xs text-muted-foreground">{catActive}/{items.length} active</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map(integration => {
                const cfg = getIntConfig(integration.id);
                const isExpanded = expanded === integration.id;
                const isTesting = testing === integration.id;
                return (
                  <div
                    key={integration.id}
                    className={`bg-card border rounded-xl shadow-sm overflow-hidden transition-all ${cfg.enabled ? "border-[#25D366]/40" : "border-card-border"}`}
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                          {integration.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{integration.name}</p>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${integration.categoryColor}`}>
                              {integration.category}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{integration.description}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-1.5">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex-shrink-0">Trigger:</span>
                        <span className="text-[11px] text-foreground">{integration.trigger}</span>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        {/* Toggle */}
                        <button
                          onClick={() => toggle(integration.id)}
                          className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${cfg.enabled ? "bg-[#25D366]" : "bg-muted-foreground/30"}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${cfg.enabled ? "left-5" : "left-0.5"}`} />
                        </button>
                        <span className={`text-xs font-medium ${cfg.enabled ? "text-[#25D366]" : "text-muted-foreground"}`}>
                          {cfg.enabled ? "Active" : "Inactive"}
                        </span>

                        <div className="flex-1" />

                        {/* Test Send */}
                        <button
                          onClick={() => testSend(integration)}
                          disabled={isTesting}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-muted hover:bg-primary/10 hover:text-primary rounded-lg transition-colors font-medium disabled:opacity-50"
                        >
                          {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Test
                        </button>

                        {/* Configure Toggle */}
                        <button
                          onClick={() => setExpanded(isExpanded ? null : integration.id)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-input rounded-lg hover:bg-muted transition-colors font-medium"
                        >
                          Configure
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>

                      {/* Configure Panel */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-border space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">n8n Webhook URL</label>
                          <input
                            value={cfg.webhookUrl || DEFAULT_WEBHOOK}
                            onChange={e => setWebhook(integration.id, e.target.value)}
                            placeholder={DEFAULT_WEBHOOK}
                            className="w-full text-xs px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                          />
                          <div className="text-[10px] text-muted-foreground">
                            Test payload preview:
                          </div>
                          <pre className="text-[10px] bg-muted/50 rounded-lg p-2 overflow-x-auto text-muted-foreground leading-relaxed">
                            {JSON.stringify(integration.testPayload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>

                    {/* Active indicator bar */}
                    {cfg.enabled && (
                      <div className="h-0.5 bg-[#25D366]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Status Summary */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-foreground mb-4">Integration Status</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {CATEGORIES.map(cat => {
            const items = INTEGRATIONS.filter(i => i.category === cat);
            const active = items.filter(i => getIntConfig(i.id).enabled).length;
            const allActive = active === items.length;
            const noneActive = active === 0;
            return (
              <div key={cat} className={`rounded-lg p-3 border ${allActive ? "border-[#25D366]/40 bg-[#25D366]/5" : noneActive ? "border-border bg-muted/20" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {allActive ? <CheckCircle className="w-3.5 h-3.5 text-[#25D366]" /> : noneActive ? <XCircle className="w-3.5 h-3.5 text-muted-foreground/40" /> : <CheckCircle className="w-3.5 h-3.5 text-amber-500" />}
                  <p className="text-xs font-medium text-foreground">{cat}</p>
                </div>
                <p className={`text-base font-bold ${allActive ? "text-[#25D366]" : noneActive ? "text-muted-foreground" : "text-amber-600"}`}>{active}/{items.length}</p>
                <p className="text-[10px] text-muted-foreground">active</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
