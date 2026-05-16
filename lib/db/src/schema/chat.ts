import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const chatSessionsTable = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  phone: text("phone"),
  botMode: text("bot_mode"),
  mode: text("mode"),
  pendingStep: text("pending_step"),
  pendingData: text("pending_data"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  stepUpdatedAt: timestamp("step_updated_at").defaultNow().notNull(),
});

export const insertChatSessionSchema = createInsertSchema(chatSessionsTable).omit({ id: true, updatedAt: true, stepUpdatedAt: true });
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatSession = typeof chatSessionsTable.$inferSelect;
