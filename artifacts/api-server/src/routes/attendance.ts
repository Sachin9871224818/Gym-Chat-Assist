import { Router } from "express";
import { db } from "@workspace/db";
import { attendanceTable, membersTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";

const router = Router();

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// GET /api/attendance
router.get("/attendance", async (req, res) => {
  const { memberId, date } = req.query as Record<string, string>;

  let rows = await db.select().from(attendanceTable);

  if (memberId) {
    rows = rows.filter(r => r.memberId === parseInt(memberId));
  }
  if (date) {
    rows = rows.filter(r => r.date === date);
  }

  const enriched = await Promise.all(rows.map(async r => {
    const [member] = await db.select({ name: membersTable.name }).from(membersTable).where(eq(membersTable.id, r.memberId));
    return {
      ...r,
      memberName: member?.name ?? null,
      checkIn: r.checkIn ? r.checkIn.toISOString() : null,
      checkOut: r.checkOut ? r.checkOut.toISOString() : null,
    };
  }));

  return res.json(enriched);
});

// POST /api/attendance
router.post("/attendance", async (req, res) => {
  const { memberId, type } = req.body as { memberId: number; type: "check_in" | "check_out" };
  const today = todayStr();

  if (type === "check_in") {
    const existing = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.memberId, memberId), eq(attendanceTable.date, today)));

    if (existing.length > 0 && existing[0].checkIn && !existing[0].checkOut) {
      const [member] = await db.select({ name: membersTable.name }).from(membersTable).where(eq(membersTable.id, memberId));
      return res.json({
        ...existing[0],
        memberName: member?.name ?? null,
        checkIn: existing[0].checkIn?.toISOString() ?? null,
        checkOut: existing[0].checkOut?.toISOString() ?? null,
      });
    }

    const [record] = await db.insert(attendanceTable).values({
      memberId,
      checkIn: new Date(),
      date: today,
    }).returning();

    const [member] = await db.select({ name: membersTable.name }).from(membersTable).where(eq(membersTable.id, memberId));
    return res.json({
      ...record,
      memberName: member?.name ?? null,
      checkIn: record.checkIn?.toISOString() ?? null,
      checkOut: record.checkOut?.toISOString() ?? null,
    });
  } else {
    const existing = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.memberId, memberId), eq(attendanceTable.date, today)));

    if (existing.length > 0 && existing[0].checkIn) {
      const [record] = await db.update(attendanceTable).set({ checkOut: new Date() })
        .where(eq(attendanceTable.id, existing[0].id)).returning();
      const [member] = await db.select({ name: membersTable.name }).from(membersTable).where(eq(membersTable.id, memberId));
      return res.json({
        ...record,
        memberName: member?.name ?? null,
        checkIn: record.checkIn?.toISOString() ?? null,
        checkOut: record.checkOut?.toISOString() ?? null,
      });
    }

    const [record] = await db.insert(attendanceTable).values({
      memberId,
      checkOut: new Date(),
      date: today,
    }).returning();
    const [member] = await db.select({ name: membersTable.name }).from(membersTable).where(eq(membersTable.id, memberId));
    return res.json({
      ...record,
      memberName: member?.name ?? null,
      checkIn: record.checkIn?.toISOString() ?? null,
      checkOut: record.checkOut?.toISOString() ?? null,
    });
  }
});

export default router;
