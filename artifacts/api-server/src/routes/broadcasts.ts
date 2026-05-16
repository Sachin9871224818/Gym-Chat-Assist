import { Router } from "express";
import { db } from "@workspace/db";
import { broadcastsTable, membersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

const router = Router();

// GET /api/broadcasts
router.get("/broadcasts", async (req, res) => {
  const rows = await db.select().from(broadcastsTable);
  return res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

// POST /api/broadcasts
router.post("/broadcasts", async (req, res) => {
  const { targetAudience } = req.body;
  let sentCount = 0;
  const members = await db.select({ id: membersTable.id, status: membersTable.status }).from(membersTable);
  if (targetAudience === "all") sentCount = members.length;
  else if (targetAudience === "active") sentCount = members.filter(m => m.status === "active").length;
  else if (targetAudience === "expired") sentCount = members.filter(m => m.status === "expired").length;
  else sentCount = members.length;

  const [broadcast] = await db.insert(broadcastsTable).values({ ...req.body, sentCount }).returning();
  return res.status(201).json({ ...broadcast, createdAt: broadcast.createdAt.toISOString() });
});

export default router;
