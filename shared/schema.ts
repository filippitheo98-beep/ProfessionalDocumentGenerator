import { pgTable, text, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  activity: text("activity").notNull(),
  locations: jsonb("locations").$type<Location[]>().default([]),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

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
  workUnits: WorkUnit[];
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
