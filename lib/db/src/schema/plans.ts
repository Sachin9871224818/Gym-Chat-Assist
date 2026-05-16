import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dietPlansTable = pgTable("diet_plans", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  goal: text("goal").notNull(),
  content: text("content").notNull(),
  trainerId: integer("trainer_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDietPlanSchema = createInsertSchema(dietPlansTable).omit({ id: true, createdAt: true });
export type InsertDietPlan = z.infer<typeof insertDietPlanSchema>;
export type DietPlan = typeof dietPlansTable.$inferSelect;

export const workoutPlansTable = pgTable("workout_plans", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  goal: text("goal").notNull(),
  content: text("content").notNull(),
  trainerId: integer("trainer_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWorkoutPlanSchema = createInsertSchema(workoutPlansTable).omit({ id: true, createdAt: true });
export type InsertWorkoutPlan = z.infer<typeof insertWorkoutPlanSchema>;
export type WorkoutPlan = typeof workoutPlansTable.$inferSelect;
