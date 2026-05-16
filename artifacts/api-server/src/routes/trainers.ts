import { Router } from "express";
import { db } from "@workspace/db";
import { trainersTable, membersTable, trainerBookingsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

const router = Router();

async function enrichTrainer(t: typeof trainersTable.$inferSelect) {
  const [{ value: memberCount }] = await db.select({ value: count() }).from(membersTable).where(eq(membersTable.trainerId, t.id));
  return {
    ...t,
    memberCount: Number(memberCount),
    createdAt: t.createdAt.toISOString(),
  };
}

// GET /api/trainers
router.get("/trainers", async (req, res) => {
  const rows = await db.select().from(trainersTable);
  const enriched = await Promise.all(rows.map(enrichTrainer));
  return res.json(enriched);
});

// POST /api/trainers
router.post("/trainers", async (req, res) => {
  const [trainer] = await db.insert(trainersTable).values(req.body).returning();
  return res.status(201).json(await enrichTrainer(trainer));
});

// GET /api/trainers/:id
router.get("/trainers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [trainer] = await db.select().from(trainersTable).where(eq(trainersTable.id, id));
  if (!trainer) return res.status(404).json({ error: "Not found" });
  return res.json(await enrichTrainer(trainer));
});

// PATCH /api/trainers/:id
router.patch("/trainers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [trainer] = await db.update(trainersTable).set(req.body).where(eq(trainersTable.id, id)).returning();
  if (!trainer) return res.status(404).json({ error: "Not found" });
  return res.json(await enrichTrainer(trainer));
});

// DELETE /api/trainers/:id
router.delete("/trainers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(trainersTable).where(eq(trainersTable.id, id));
  return res.json({ success: true, message: "Deleted" });
});

// GET /api/trainers/:id/members
router.get("/trainers/:id/members", async (req, res) => {
  const id = parseInt(req.params.id);
  const members = await db.select().from(membersTable).where(eq(membersTable.trainerId, id));
  return res.json(members.map(m => ({
    ...m,
    trainerName: null,
    bmi: null,
    createdAt: m.createdAt.toISOString(),
  })));
});

// GET /api/trainers/:id/bookings
router.get("/trainers/:id/bookings", async (req, res) => {
  const id = parseInt(req.params.id);
  const bookings = await db.select().from(trainerBookingsTable).where(eq(trainerBookingsTable.trainerId, String(id)));

  const enriched = await Promise.all(bookings.map(async b => {
    const [trainer] = await db.select({ name: trainersTable.name }).from(trainersTable).where(eq(trainersTable.id, id));
    const [member] = await db.select({ name: membersTable.name }).from(membersTable).where(eq(membersTable.id, parseInt(b.memberId)));
    return {
      ...b,
      trainerName: trainer?.name ?? null,
      memberName: member?.name ?? null,
      scheduledAt: b.scheduledAt.toISOString(),
      createdAt: b.createdAt.toISOString(),
    };
  }));

  return res.json(enriched);
});

// POST /api/trainers/bookings
router.post("/trainers/bookings", async (req, res) => {
  const { trainerId, memberId, scheduledAt, notes } = req.body;
  const [booking] = await db.insert(trainerBookingsTable).values({
    trainerId: String(trainerId),
    memberId: String(memberId),
    scheduledAt: new Date(scheduledAt),
    notes: notes ?? null,
    status: "scheduled",
  }).returning();

  const [trainer] = await db.select({ name: trainersTable.name }).from(trainersTable).where(eq(trainersTable.id, trainerId));
  const [member] = await db.select({ name: membersTable.name }).from(membersTable).where(eq(membersTable.id, memberId));

  return res.status(201).json({
    ...booking,
    trainerName: trainer?.name ?? null,
    memberName: member?.name ?? null,
    scheduledAt: booking.scheduledAt.toISOString(),
    createdAt: booking.createdAt.toISOString(),
  });
});

export default router;
