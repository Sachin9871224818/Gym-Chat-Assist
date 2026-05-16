import { Router } from "express";
import { db } from "@workspace/db";
import { leadsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/leads
router.get("/leads", async (req, res) => {
  const { status } = req.query as Record<string, string>;
  let rows = await db.select().from(leadsTable);
  if (status) rows = rows.filter(r => r.status === status);
  return res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

// POST /api/leads
router.post("/leads", async (req, res) => {
  const [lead] = await db.insert(leadsTable).values(req.body).returning();
  return res.status(201).json({ ...lead, createdAt: lead.createdAt.toISOString() });
});

// PATCH /api/leads/:id
router.patch("/leads/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [lead] = await db.update(leadsTable).set(req.body).where(eq(leadsTable.id, id)).returning();
  if (!lead) return res.status(404).json({ error: "Not found" });
  return res.json({ ...lead, createdAt: lead.createdAt.toISOString() });
});

export default router;
