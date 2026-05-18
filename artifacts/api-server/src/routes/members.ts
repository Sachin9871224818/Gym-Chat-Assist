import { Router } from "express";
import { db } from "@workspace/db";
import { membersTable, trainersTable, progressTable } from "@workspace/db";
import { eq, ilike, or, and } from "drizzle-orm";

const router = Router();

const PLAN_MONTHS: Record<string, number> = {
  "1 Month": 1,
  "3 Months": 3,
  "6 Months": 6,
  "1 Year": 12,
};

function computeExpiry(joiningDate: string, plan: string): string {
  const d = new Date(joiningDate);
  const months = PLAN_MONTHS[plan] ?? 1;
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function computeBmi(weight?: number | null, height?: number | null): number | null {
  if (!weight || !height || height === 0) return null;
  const hMeters = height / 100;
  return Math.round((weight / (hMeters * hMeters)) * 10) / 10;
}

async function enrichMember(m: typeof membersTable.$inferSelect) {
  let trainerName: string | null = null;
  if (m.trainerId) {
    const [trainer] = await db.select({ name: trainersTable.name }).from(trainersTable).where(eq(trainersTable.id, m.trainerId));
    trainerName = trainer?.name ?? null;
  }
  const now = new Date();
  const expiry = new Date(m.expiryDate);
  const status = expiry < now ? "expired" : m.status;
  return {
    ...m,
    trainerName,
    bmi: computeBmi(m.weight, m.height),
    status,
    joiningDate: m.joiningDate,
    expiryDate: m.expiryDate,
    createdAt: m.createdAt.toISOString(),
  };
}

// GET /api/members
router.get("/members", async (req, res) => {
  const { search, status, plan } = req.query as Record<string, string>;

  let rows = await db.select().from(membersTable);

  if (search) {
    rows = rows.filter(
      m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.phone.includes(search),
    );
  }
  if (plan) {
    rows = rows.filter(m => m.plan === plan);
  }

  const enriched = await Promise.all(rows.map(enrichMember));

  const result = status ? enriched.filter(m => m.status === status) : enriched;

  return res.json(result);
});

// POST /api/members
router.post("/members", async (req, res) => {
  const body = req.body;
  const expiryDate = computeExpiry(body.joiningDate, body.plan);
  const [member] = await db.insert(membersTable).values({
    ...body,
    expiryDate,
    status: "active",
  }).returning();
  return res.status(201).json(await enrichMember(member));
});

// GET /api/members/:id
router.get("/members/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  if (!member) return res.status(404).json({ error: "Not found" });
  return res.json(await enrichMember(member));
});

// PATCH /api/members/:id
router.patch("/members/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = req.body;
  const updates: Record<string, unknown> = { ...body };
  if (body.plan && body.joiningDate) {
    updates.expiryDate = computeExpiry(body.joiningDate, body.plan);
  }
  const [member] = await db.update(membersTable).set(updates).where(eq(membersTable.id, id)).returning();
  if (!member) return res.status(404).json({ error: "Not found" });
  return res.json(await enrichMember(member));
});

// POST /api/members/import
router.post("/members/import", async (req, res) => {
  const rows: Array<Record<string, unknown>> = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "No rows provided" });
  }
  const inserted: unknown[] = [];
  const failed: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      const joiningDate = String(r.joiningDate ?? r.joining_date ?? new Date().toISOString().split("T")[0]);
      const plan = String(r.plan ?? "1 Month");
      const expiryDate = computeExpiry(joiningDate, plan);
      const [member] = await db.insert(membersTable).values({
        name: String(r.name),
        phone: String(r.phone),
        email: r.email ? String(r.email) : null,
        gender: String(r.gender ?? "male").toLowerCase(),
        age: Number(r.age ?? 25),
        weight: r.weight ? Number(r.weight) : null,
        height: r.height ? Number(r.height) : null,
        goal: r.goal ? String(r.goal) : null,
        plan,
        joiningDate,
        expiryDate,
        paymentStatus: String(r.paymentStatus ?? r.payment_status ?? "paid"),
        status: "active",
      }).returning();
      inserted.push(member);
    } catch (err) {
      failed.push({ row: i + 1, error: String(err) });
    }
  }

  return res.status(201).json({ inserted: inserted.length, failed });
});

// DELETE /api/members/:id
router.delete("/members/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(membersTable).where(eq(membersTable.id, id));
  return res.json({ success: true, message: "Deleted" });
});

// GET /api/members/:id/progress
router.get("/members/:id/progress", async (req, res) => {
  const id = parseInt(req.params.id);
  const rows = await db.select().from(progressTable).where(eq(progressTable.memberId, id));
  return res.json(rows.map(r => ({ ...r, recordedAt: r.recordedAt.toISOString() })));
});

// POST /api/members/:id/progress
router.post("/members/:id/progress", async (req, res) => {
  const id = parseInt(req.params.id);
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  const weight = req.body.weight ?? member?.weight;
  const height = member?.height;
  const bmi = computeBmi(weight, height);
  const [entry] = await db.insert(progressTable).values({
    memberId: id,
    weight: req.body.weight ?? null,
    bmi,
    notes: req.body.notes ?? null,
  }).returning();
  return res.status(201).json({ ...entry, recordedAt: entry.recordedAt.toISOString() });
});

// POST /api/members/:id/renew
router.post("/members/:id/renew", async (req, res) => {
  const id = parseInt(req.params.id);
  const { plan, paymentStatus } = req.body;
  const [current] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  if (!current) return res.status(404).json({ error: "Not found" });

  const now = new Date();
  const currentExpiry = new Date(current.expiryDate);
  const startFrom = currentExpiry > now ? currentExpiry : now;
  const startDateStr = startFrom.toISOString().split("T")[0];
  const newExpiry = computeExpiry(startDateStr, plan);

  const [member] = await db.update(membersTable).set({
    plan,
    paymentStatus,
    expiryDate: newExpiry,
    status: "active",
  }).where(eq(membersTable.id, id)).returning();

  return res.json(await enrichMember(member));
});

export default router;
