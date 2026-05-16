import { pgTable, serial, text, integer, real, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const membersTable = pgTable("members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  gender: text("gender").notNull(),
  age: integer("age").notNull(),
  weight: real("weight"),
  height: real("height"),
  goal: text("goal"),
  plan: text("plan").notNull(),
  joiningDate: date("joining_date").notNull(),
  expiryDate: date("expiry_date").notNull(),
  paymentStatus: text("payment_status").notNull().default("paid"),
  trainerId: integer("trainer_id"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMemberSchema = createInsertSchema(membersTable).omit({ id: true, expiryDate: true, createdAt: true });
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof membersTable.$inferSelect;
