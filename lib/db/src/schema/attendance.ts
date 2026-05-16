import { pgTable, serial, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  checkIn: timestamp("check_in"),
  checkOut: timestamp("check_out"),
  date: date("date").notNull(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
