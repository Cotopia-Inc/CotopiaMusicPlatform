import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const trustWeHeardYouTable = pgTable("trust_we_heard_you", {
  id: serial("id").primaryKey(),
  youAsked: text("you_asked").notNull(),
  weDid: text("we_did").notNull(),
  status: text("status").notNull().default("released"),
  dateRequested: timestamp("date_requested", { withTimezone: true }),
  dateReleased: timestamp("date_released", { withTimezone: true }),
  relatedFeature: text("related_feature"),
  link: text("link"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export type TrustWeHeardYou = typeof trustWeHeardYouTable.$inferSelect;
export type InsertTrustWeHeardYou = typeof trustWeHeardYouTable.$inferInsert;
