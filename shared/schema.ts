import { pgTable, text, serial, integer, jsonb, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Companies table
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  activity: text("activity").notNull(),
  sector: text("sector"),
  address: text("address"),
  siret: text("siret"),
  phone: text("phone"),
  email: text("email"),
  employeeCount: integer("employee_count"),
  logo: text("logo"),
  existingPreventionMeasures: jsonb("existing_prevention_measures").$type<PreventionMeasure[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Users table for multi-user collaboration
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  role: varchar("role", { length: 50 }).default("user"), // admin, editor, viewer
  companyId: integer("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

// DUERP documents table
export const duerpDocuments = pgTable("duerp_documents", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  title: text("title").notNull(),
  version: varchar("version", { length: 20 }).default("1.0"),
  status: varchar("status", { length: 50 }).default("draft"), // draft, pending, approved, archived
  locations: jsonb("locations").$type<Location[]>().default([]),
  workStations: jsonb("work_stations").$type<WorkStation[]>().default([]),
  finalRisks: jsonb("final_risks").$type<Risk[]>().default([]),
  preventionMeasures: jsonb("prevention_measures").$type<PreventionMeasure[]>().default([]),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  nextReviewDate: timestamp("next_review_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Actions and tasks table
export const actions = pgTable("actions", {
  id: serial("id").primaryKey(),
  duerpId: integer("duerp_id").references(() => duerpDocuments.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  priority: varchar("priority", { length: 20 }).default("medium"), // low, medium, high, critical
  status: varchar("status", { length: 20 }).default("pending"), // pending, in_progress, completed, cancelled
  assignedTo: integer("assigned_to").references(() => users.id),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Risk templates/catalog
export const riskTemplates = pgTable("risk_templates", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 100 }).notNull(),
  sector: varchar("sector", { length: 100 }),
  type: text("type").notNull(),
  danger: text("danger").notNull(),
  gravity: varchar("gravity", { length: 20 }).notNull(),
  frequency: varchar("frequency", { length: 20 }).notNull(),
  control: varchar("control", { length: 20 }).notNull(),
  finalRisk: varchar("final_risk", { length: 20 }).notNull(),
  measures: text("measures").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Comments and collaboration
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  duerpId: integer("duerp_id").references(() => duerpDocuments.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  locationId: text("location_id"), // Optional: comment on specific location
  workUnitId: text("work_unit_id"), // Optional: comment on specific work unit
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  duerpDocuments: many(duerpDocuments),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  approvedDocuments: many(duerpDocuments),
  assignedActions: many(actions),
  comments: many(comments),
}));

export const duerpDocumentsRelations = relations(duerpDocuments, ({ one, many }) => ({
  company: one(companies, {
    fields: [duerpDocuments.companyId],
    references: [companies.id],
  }),
  approvedBy: one(users, {
    fields: [duerpDocuments.approvedBy],
    references: [users.id],
  }),
  actions: many(actions),
  comments: many(comments),
}));

export const actionsRelations = relations(actions, ({ one }) => ({
  duerp: one(duerpDocuments, {
    fields: [actions.duerpId],
    references: [duerpDocuments.id],
  }),
  assignedTo: one(users, {
    fields: [actions.assignedTo],
    references: [users.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  duerp: one(duerpDocuments, {
    fields: [comments.duerpId],
    references: [duerpDocuments.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

// Schemas
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  existingPreventionMeasures: z.array(z.object({
    id: z.string(),
    description: z.string(),
  })).optional(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertDuerpDocumentSchema = createInsertSchema(duerpDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActionSchema = createInsertSchema(actions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRiskTemplateSchema = createInsertSchema(riskTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type User = typeof users.$inferSelect;
export type DuerpDocument = typeof duerpDocuments.$inferSelect;
export type Action = typeof actions.$inferSelect;
export type RiskTemplate = typeof riskTemplates.$inferSelect;
export type Comment = typeof comments.$inferSelect;

// Types for nested data structures
export interface Risk {
  id: string;
  type: string;
  danger: string;
  gravity: 'Faible' | 'Moyenne' | 'Élevée';
  frequency: 'Rare' | 'Occasionnel' | 'Hebdomadaire' | 'Quotidien';
  control: 'Faible' | 'Moyenne' | 'Élevée';
  finalRisk: 'Faible' | 'Moyen' | 'Important';
  measures: string;
  source?: string;
  sourceType?: 'Lieu' | 'Poste';
}

export interface PreventionMeasure {
  id: string;
  description: string;
}

export interface WorkUnit {
  id: string;
  name: string;
  risks: Risk[];
  preventionMeasures: PreventionMeasure[];
}

export interface Location {
  id: string;
  name: string;
  risks: Risk[];
  preventionMeasures: PreventionMeasure[];
}

export interface WorkStation {
  id: string;
  name: string;
  description?: string;
  risks: Risk[];
  preventionMeasures: PreventionMeasure[];
  locationId?: string; // Optionnel - peut être rattaché à un lieu
}

export const generateRisksRequestSchema = z.object({
  workUnitName: z.string(),
  locationName: z.string(),
  companyActivity: z.string(),
});

export type GenerateRisksRequest = z.infer<typeof generateRisksRequestSchema>;

export interface GenerateRisksResponse {
  risks: Risk[];
}
