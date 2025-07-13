import { z } from "zod";

// Types de base sans PostgreSQL
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
  locationId?: string;
}

export interface Company {
  id: number;
  name: string;
  activity: string;
  employeeCount: number;
  address: string;
  phone: string;
  email: string;
  locations: Location[];
  workStations: WorkStation[];
  finalRisks: Risk[];
  preventionMeasures: PreventionMeasure[];
  existingPreventionMeasures: PreventionMeasure[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertCompany {
  name: string;
  activity: string;
  employeeCount: number;
  address: string;
  phone: string;
  email: string;
  locations: Location[];
  workStations: WorkStation[];
  finalRisks: Risk[];
  preventionMeasures: PreventionMeasure[];
  existingPreventionMeasures: PreventionMeasure[];
}

export interface DuerpDocument {
  id: number;
  companyId: number;
  title: string;
  locations: Location[];
  workStations: WorkStation[];
  finalRisks: Risk[];
  preventionMeasures: PreventionMeasure[];
  nextReviewDate: string;
  lastRevisionDate: string;
  revisionNotified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskTemplate {
  id: number;
  sector: string;
  type: string;
  danger: string;
  gravity: 'Faible' | 'Moyenne' | 'Élevée';
  frequency: 'Rare' | 'Occasionnel' | 'Hebdomadaire' | 'Quotidien';
  control: 'Faible' | 'Moyenne' | 'Élevée';
  finalRisk: 'Faible' | 'Moyen' | 'Important';
  measures: string;
  createdAt: Date;
}

export interface Action {
  id: number;
  duerpId: number;
  title: string;
  description: string;
  responsible: string;
  deadline: string;
  priority: 'Faible' | 'Moyenne' | 'Élevée';
  status: 'En attente' | 'En cours' | 'Terminé';
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: number;
  duerpId: number;
  content: string;
  author: string;
  createdAt: Date;
}

// Schémas de validation
export const insertCompanySchema = z.object({
  name: z.string().min(1, "Le nom de l'entreprise est requis"),
  activity: z.string().min(1, "L'activité de l'entreprise est requise"),
  employeeCount: z.number().min(1, "Le nombre d'employés doit être positif"),
  address: z.string().min(1, "L'adresse est requise"),
  phone: z.string().min(1, "Le téléphone est requis"),
  email: z.string().email("Email invalide"),
  locations: z.array(z.any()).default([]),
  workStations: z.array(z.any()).default([]),
  finalRisks: z.array(z.any()).default([]),
  preventionMeasures: z.array(z.any()).default([]),
  existingPreventionMeasures: z.array(z.any()).default([])
});

export const generateRisksRequestSchema = z.object({
  workUnitName: z.string().min(1, "Le nom de l'unité de travail est requis"),
  locationName: z.string().min(1, "Le nom du lieu est requis"),
  companyActivity: z.string().min(1, "L'activité de l'entreprise est requise")
});

export type GenerateRisksRequest = z.infer<typeof generateRisksRequestSchema>;

export interface GenerateRisksResponse {
  risks: Risk[];
}