import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trainersTable = pgTable("trainers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  specialization: text("specialization"),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTrainerSchema = createInsertSchema(trainersTable).omit({ id: true, createdAt: true });
export type InsertTrainer = z.infer<typeof insertTrainerSchema>;
export type Trainer = typeof trainersTable.$inferSelect;

export const trainerBookingsTable = pgTable("trainer_bookings", {
  id: serial("id").primaryKey(),
  trainerId: text("trainer_id").notNull(),
  memberId: text("member_id").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTrainerBookingSchema = createInsertSchema(trainerBookingsTable).omit({ id: true, createdAt: true });
export type InsertTrainerBooking = z.infer<typeof insertTrainerBookingSchema>;
export type TrainerBooking = typeof trainerBookingsTable.$inferSelect;
