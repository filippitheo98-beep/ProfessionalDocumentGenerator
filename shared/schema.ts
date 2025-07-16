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
  lastRevisionDate: timestamp("last_revision_date"),
  revisionNotified: boolean("revision_notified").default(false),
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
  gravity: 'Faible' | 'Moyenne' | 'Grave' | 'Très Grave';
  gravityValue: 1 | 4 | 20 | 100;
  frequency: 'Annuelle' | 'Mensuelle' | 'Hebdomadaire' | 'Journalière';
  frequencyValue: 1 | 4 | 10 | 50;
  control: 'Très élevée' | 'Élevée' | 'Moyenne' | 'Absente';
  controlValue: 0.05 | 0.2 | 0.5 | 1;
  riskScore: number; // Gravité × Fréquence × Maîtrise
  priority: 'Priorité 1 (Forte)' | 'Priorité 2 (Moyenne)' | 'Priorité 3 (Modéré)' | 'Priorité 4 (Faible)';
  measures: string;
  source?: string;
  sourceType?: 'Lieu' | 'Poste';
}

export interface PreventionMeasure {
  id: string;
  description: string;
  level: 'Général' | 'Lieu' | 'Poste'; // Niveau d'application
  category: 'Technique' | 'Organisationnel' | 'Humain' | 'EPI'; // Catégorie de mesure
  priority: 'Élevée' | 'Moyenne' | 'Faible'; // Priorité
  responsible?: string; // Responsable de la mise en œuvre
  deadline?: string; // Date limite d'application
  cost?: 'Faible' | 'Moyenne' | 'Élevée'; // Coût estimé
  effectiveness?: 'Faible' | 'Moyenne' | 'Élevée'; // Efficacité estimée
  targetRiskIds?: string[]; // IDs des risques ciblés
  locationId?: string; // ID du lieu si applicable
  workStationId?: string; // ID du poste si applicable
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

// Utility functions for risk calculation
export const GRAVITY_VALUES = {
  'Faible': 1,
  'Moyenne': 4,
  'Grave': 20,
  'Très Grave': 100
} as const;

export const FREQUENCY_VALUES = {
  'Annuelle': 1,
  'Mensuelle': 4,
  'Hebdomadaire': 10,
  'Journalière': 50
} as const;

export const CONTROL_VALUES = {
  'Très élevée': 0.05,
  'Élevée': 0.2,
  'Moyenne': 0.5,
  'Absente': 1
} as const;

export function calculateRiskScore(
  gravity: keyof typeof GRAVITY_VALUES,
  frequency: keyof typeof FREQUENCY_VALUES,
  control: keyof typeof CONTROL_VALUES
): number {
  return GRAVITY_VALUES[gravity] * FREQUENCY_VALUES[frequency] * CONTROL_VALUES[control];
}

export function calculatePriority(score: number): 'Priorité 1 (Forte)' | 'Priorité 2 (Moyenne)' | 'Priorité 3 (Modéré)' | 'Priorité 4 (Faible)' {
  if (score >= 500) return 'Priorité 1 (Forte)';
  if (score >= 100) return 'Priorité 2 (Moyenne)';
  if (score >= 10) return 'Priorité 3 (Modéré)';
  return 'Priorité 4 (Faible)';
}
