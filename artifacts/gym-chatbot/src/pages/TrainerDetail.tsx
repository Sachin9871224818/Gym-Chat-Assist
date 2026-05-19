import { useParams, useLocation } from "wouter";
import { useGetTrainer, useGetTrainerMembers, useGetTrainerBookings, getGetTrainerQueryKey, getGetTrainerMembersQueryKey, getGetTrainerBookingsQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, Users, Calendar } from "lucide-react";
import { Link } from "wouter";

export default function TrainerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const trainerId = parseInt(id);

  const { data: trainer, isLoading } = useGetTrainer(trainerId, { query: { queryKey: getGetTrainerQueryKey(trainerId) } });
  const { data: rawMembers } = useGetTrainerMembers(trainerId, { query: { queryKey: getGetTrainerMembersQueryKey(trainerId) } });
  const members = Array.isArray(rawMembers) ? rawMembers : [];
  const { data: rawBookings } = useGetTrainerBookings(trainerId, { query: { queryKey: getGetTrainerBookingsQueryKey(trainerId) } });
  const bookings = Array.isArray(rawBookings) ? rawBookings : [];

  if (isLoading) {
    return <div className="p-6 space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>;
  }
  if (!trainer) return <div className="p-6 text-center text-muted-foreground">Trainer not found</div>;

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <button onClick={() => setLocation("/trainers")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back-trainers">
        <ArrowLeft className="w-4 h-4" /> Back to Trainers
      </button>

      {/* Profile */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm flex items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl font-bold text-primary">{trainer.name[0]}</span>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{trainer.name}</h1>
          {trainer.specialization && <p className="text-sm text-primary font-medium mt-0.5">{trainer.specialization}</p>}
          <p className="text-sm text-muted-foreground mt-1">{trainer.phone} {trainer.email ? `· ${trainer.email}` : ""}</p>
          {trainer.bio && <p className="text-sm text-muted-foreground mt-2">{trainer.bio}</p>}
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-sm">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground">{trainer.memberCount}</span>
              <span className="text-muted-foreground">members</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground">{bookings?.length ?? 0}</span>
              <span className="text-muted-foreground">bookings</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Assigned Members */}
        <div className="bg-card border border-card-border rounded-xl shadow-sm">
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
            <Users className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Assigned Members</p>
          </div>
          <div className="divide-y divide-border">
            {(members?.length ?? 0) === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No members assigned</div>
            ) : (
              members?.map(m => (
                <Link key={m.id} href={`/members/${m.id}`}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer" data-testid={`trainer-member-${m.id}`}>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{m.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.plan}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {m.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Bookings */}
        <div className="bg-card border border-card-border rounded-xl shadow-sm">
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
            <Calendar className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Booking Schedule</p>
          </div>
          <div className="divide-y divide-border">
            {(bookings?.length ?? 0) === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No bookings scheduled</div>
            ) : (
              bookings?.map(b => (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3" data-testid={`booking-${b.id}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${b.status === "scheduled" ? "bg-amber-500" : "bg-emerald-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{b.memberName ?? `Member #${b.memberId}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{b.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
