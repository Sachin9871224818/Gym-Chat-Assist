import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const progressTable = pgTable("progress", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  weight: real("weight"),
  bmi: real("bmi"),
  notes: text("notes"),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

export const insertProgressSchema = createInsertSchema(progressTable).omit({ id: true, recordedAt: true });
export type InsertProgress = z.infer<typeof insertProgressSchema>;
export type Progress = typeof progressTable.$inferSelect;
