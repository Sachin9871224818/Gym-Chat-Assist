import { Router } from "express";
import { db } from "@workspace/db";
import { dietPlansTable, workoutPlansTable, trainersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/diet-plans
router.get("/diet-plans", async (req, res) => {
  const { goal, trainerId } = req.query as Record<string, string>;
  let rows = await db.select().from(dietPlansTable);
  if (goal) rows = rows.filter(r => r.goal.toLowerCase().includes(goal.toLowerCase()));
  if (trainerId) rows = rows.filter(r => r.trainerId === parseInt(trainerId));

  const enriched = await Promise.all(rows.map(async r => {
    let trainerName = null;
    if (r.trainerId) {
      const [t] = await db.select({ name: trainersTable.name }).from(trainersTable).where(eq(trainersTable.id, r.trainerId));
      trainerName = t?.name ?? null;
    }
    return { ...r, trainerName, createdAt: r.createdAt.toISOString() };
  }));

  return res.json(enriched);
});

// POST /api/diet-plans
router.post("/diet-plans", async (req, res) => {
  const [plan] = await db.insert(dietPlansTable).values(req.body).returning();
  return res.status(201).json({ ...plan, trainerName: null, createdAt: plan.createdAt.toISOString() });
});

// GET /api/workout-plans
router.get("/workout-plans", async (req, res) => {
  const { goal } = req.query as Record<string, string>;
  let rows = await db.select().from(workoutPlansTable);
  if (goal) rows = rows.filter(r => r.goal.toLowerCase().includes(goal.toLowerCase()));

  const enriched = await Promise.all(rows.map(async r => {
    let trainerName = null;
    if (r.trainerId) {
      const [t] = await db.select({ name: trainersTable.name }).from(trainersTable).where(eq(trainersTable.id, r.trainerId));
      trainerName = t?.name ?? null;
    }
    return { ...r, trainerName, createdAt: r.createdAt.toISOString() };
  }));

  return res.json(enriched);
});

// POST /api/workout-plans
router.post("/workout-plans", async (req, res) => {
  const [plan] = await db.insert(workoutPlansTable).values(req.body).returning();
  return res.status(201).json({ ...plan, trainerName: null, createdAt: plan.createdAt.toISOString() });
});

export default router;
