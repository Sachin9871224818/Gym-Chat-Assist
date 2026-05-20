import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, UserCheck,
  ClipboardList, Salad, Dumbbell, Target, Megaphone, Menu, X, CreditCard, MessageCircle, BookOpen
} from "lucide-react";
import { useState } from "react";

const nav = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/members", icon: Users, label: "Members" },
  { href: "/membership", icon: CreditCard, label: "Membership" },
  { href: "/trainers", icon: UserCheck, label: "Trainers" },
  { href: "/attendance", icon: ClipboardList, label: "Attendance" },
  { href: "/diet-plans", icon: Salad, label: "Diet Plans" },
  { href: "/workout-plans", icon: Dumbbell, label: "Workout Plans" },
  { href: "/leads", icon: Target, label: "Leads" },
  { href: "/broadcasts", icon: Megaphone, label: "Broadcasts" },
  { href: "/whatsapp", icon: MessageCircle, label: "WhatsApp" },
  { href: "/accounting", icon: BookOpen, label: "Accounting" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-56 flex flex-col bg-sidebar text-sidebar-foreground
          transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:relative lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Dumbbell className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-wide">FitPro</p>
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Gym System</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin">
          {nav.map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)}>
                <div
                  data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                  className={`
                    flex items-center gap-3 mx-2 px-3 py-2.5 rounded-md text-sm font-medium
                    transition-colors duration-150 cursor-pointer mb-0.5
                    ${active
                      ? "bg-primary text-primary-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }
                  `}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-sidebar-border">
          <p className="text-[11px] text-sidebar-foreground/40">FitPro Gym v1.0</p>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 border-b border-border bg-card flex items-center gap-3 px-4 flex-shrink-0">
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="button-menu-toggle"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {nav.find(n => n.href === "/" ? location === "/" : location.startsWith(n.href))?.label ?? "Page"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">A</span>
            </div>
            <span className="text-sm text-muted-foreground hidden sm:block">Admin</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
