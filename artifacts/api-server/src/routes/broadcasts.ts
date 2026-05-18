import { Router } from "express";
import { db } from "@workspace/db";
import { broadcastsTable, membersTable } from "@workspace/db";

const router = Router();

const BROADCAST_WEBHOOK = "https://n8n.grindoverdreams.in/webhook/gymbot_broadcast";

// GET /api/broadcasts
router.get("/broadcasts", async (req, res) => {
  const rows = await db.select().from(broadcastsTable);
  return res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

// POST /api/broadcasts
router.post("/broadcasts", async (req, res) => {
  const { title, message, type, targetAudience } = req.body;

  const allMembers = await db
    .select({ id: membersTable.id, name: membersTable.name, phone: membersTable.phone, status: membersTable.status })
    .from(membersTable);

  let targetedMembers = allMembers;
  if (targetAudience === "active") {
    targetedMembers = allMembers.filter(m => m.status === "active");
  } else if (targetAudience === "expired") {
    targetedMembers = allMembers.filter(m => m.status === "expired");
  }

  const sentCount = targetedMembers.length;

  const [broadcast] = await db
    .insert(broadcastsTable)
    .values({ title, message, type, targetAudience, sentCount })
    .returning();

  try {
    await fetch(BROADCAST_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        broadcast: {
          id: broadcast.id,
          title,
          message,
          type,
          targetAudience,
          sentCount,
          createdAt: broadcast.createdAt.toISOString(),
        },
        members: targetedMembers.map(m => ({ name: m.name, phone: m.phone })),
      }),
    });
  } catch (err) {
    console.error("Failed to send broadcast to n8n webhook:", err);
  }

  return res.status(201).json({ ...broadcast, createdAt: broadcast.createdAt.toISOString() });
});

export default router;
