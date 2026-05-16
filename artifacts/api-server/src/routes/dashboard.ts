import { Router } from "express";
import { db } from "@workspace/db";
import { membersTable, trainersTable, leadsTable, attendanceTable } from "@workspace/db";
import { eq, count, gte, lte, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

// GET /api/dashboard/summary
router.get("/dashboard/summary", async (req, res) => {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const members = await db.select().from(membersTable);
  const activeMembers = members.filter(m => {
    const exp = new Date(m.expiryDate);
    return exp >= now && m.status !== "expired";
  });
  const expiredMembers = members.filter(m => {
    const exp = new Date(m.expiryDate);
    return exp < now || m.status === "expired";
  });

  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const expiringThisMonth = members.filter(m => {
    return m.expiryDate >= todayStr && m.expiryDate <= thisMonthEnd;
  });

  const [{ value: totalTrainers }] = await db.select({ value: count() }).from(trainersTable);
  const [{ value: totalLeads }] = await db.select({ value: count() }).from(leadsTable);

  const todayAttendance = await db.select().from(attendanceTable).where(eq(attendanceTable.date, todayStr));

  const PLAN_PRICES: Record<string, number> = {
    "1 Month": 2000, "3 Months": 5000, "6 Months": 9000, "1 Year": 17000,
  };
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const monthlyRevenue = members
    .filter(m => m.joiningDate >= monthStart)
    .reduce((sum, m) => sum + (PLAN_PRICES[m.plan] ?? 0), 0);

  return res.json({
    totalMembers: members.length,
    activeMembers: activeMembers.length,
    expiredMembers: expiredMembers.length,
    todayAttendance: todayAttendance.length,
    totalTrainers: Number(totalTrainers),
    totalLeads: Number(totalLeads),
    monthlyRevenue,
    expiringThisMonth: expiringThisMonth.length,
  });
});

// GET /api/dashboard/expiring-memberships
router.get("/dashboard/expiring-memberships", async (req, res) => {
  const now = new Date();
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  const members = await db.select().from(membersTable);
  const expiring = members.filter(m => m.expiryDate >= todayStr && m.expiryDate <= next30Days);

  return res.json(expiring.map(m => ({
    ...m,
    trainerName: null,
    bmi: null,
    createdAt: m.createdAt.toISOString(),
  })));
});

// GET /api/dashboard/recent-activity
router.get("/dashboard/recent-activity", async (req, res) => {
  const members = await db.select().from(membersTable);
  const leads = await db.select().from(leadsTable);

  const activities = [
    ...members.slice(-5).map(m => ({
      id: randomUUID(),
      type: "member",
      description: `New member registered: ${m.name} (${m.plan})`,
      timestamp: m.createdAt.toISOString(),
    })),
    ...leads.slice(-3).map(l => ({
      id: randomUUID(),
      type: "lead",
      description: `New inquiry from ${l.name}`,
      timestamp: l.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

  return res.json(activities);
});

// GET /api/dashboard/attendance-stats
router.get("/dashboard/attendance-stats", async (req, res) => {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const allRecords = await db.select().from(attendanceTable);

  const todayCount = allRecords.filter(r => r.date === todayStr).length;
  const weekCount = allRecords.filter(r => r.date >= weekStartStr && r.date <= todayStr).length;
  const monthCount = allRecords.filter(r => r.date >= monthStart).length;

  const byDayMap: Record<string, number> = {};
  allRecords.forEach(r => {
    if (r.date >= weekStartStr) {
      byDayMap[r.date] = (byDayMap[r.date] ?? 0) + 1;
    }
  });

  const byDay = Object.entries(byDayMap).map(([day, cnt]) => ({ day, count: cnt })).sort((a, b) => a.day.localeCompare(b.day));

  return res.json({ todayCount, weekCount, monthCount, byDay });
});

export default router;
