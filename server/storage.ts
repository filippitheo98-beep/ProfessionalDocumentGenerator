import { 
  companies, 
  duerpDocuments, 
  riskTemplates, 
  actions, 
  comments,
  type Company, 
  type InsertCompany, 
  type Location, 
  type WorkUnit, 
  type Risk, 
  type PreventionMeasure, 
  type DuerpDocument,
  type RiskTemplate,
  type Action,
  type Comment
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Company operations
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<Company>): Promise<Company>;
  
  // DUERP document operations
  getDuerpDocument(companyId: number): Promise<DuerpDocument | undefined>;
  createDuerpDocument(companyId: number, locations: Location[]): Promise<DuerpDocument>;
  updateDuerpDocument(id: number, updates: Partial<DuerpDocument>): Promise<DuerpDocument>;
  
  // Risk operations
  generateRisks(workUnitName: string, locationName: string, companyActivity: string): Promise<Risk[]>;
  getRiskTemplates(sector?: string): Promise<RiskTemplate[]>;
  createRiskTemplate(template: Omit<RiskTemplate, 'id' | 'createdAt'>): Promise<RiskTemplate>;
  
  // Action operations
  getActionsByDuerp(duerpId: number): Promise<Action[]>;
  createAction(action: Omit<Action, 'id' | 'createdAt' | 'updatedAt'>): Promise<Action>;
  updateAction(id: number, updates: Partial<Action>): Promise<Action>;
  
  // Comment operations
  getCommentsByDuerp(duerpId: number): Promise<Comment[]>;
  createComment(comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment>;
}

export class DatabaseStorage implements IStorage {
  // Company operations
  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const [company] = await db
      .insert(companies)
      .values({
        ...insertCompany,
        updatedAt: new Date()
      })
      .returning();
    return company;
  }

  async updateCompany(id: number, updates: Partial<Company>): Promise<Company> {
    const [company] = await db
      .update(companies)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(companies.id, id))
      .returning();
    
    if (!company) {
      throw new Error(`Company with id ${id} not found`);
    }
    return company;
  }

  // DUERP document operations
  async getDuerpDocument(companyId: number): Promise<DuerpDocument | undefined> {
    const [document] = await db
      .select()
      .from(duerpDocuments)
      .where(eq(duerpDocuments.companyId, companyId))
      .orderBy(desc(duerpDocuments.createdAt))
      .limit(1);
    return document;
  }

  async createDuerpDocument(companyId: number, locations: Location[]): Promise<DuerpDocument> {
    const [document] = await db
      .insert(duerpDocuments)
      .values({
        companyId,
        version: "1.0",
        locations,
        status: "draft",
        nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        updatedAt: new Date()
      })
      .returning();
    return document;
  }

  async updateDuerpDocument(id: number, updates: Partial<DuerpDocument>): Promise<DuerpDocument> {
    const [document] = await db
      .update(duerpDocuments)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(duerpDocuments.id, id))
      .returning();
    
    if (!document) {
      throw new Error(`DUERP document with id ${id} not found`);
    }
    return document;
  }

  // Risk operations
  async getRiskTemplates(sector?: string): Promise<RiskTemplate[]> {
    if (sector) {
      return await db.select().from(riskTemplates)
        .where(and(eq(riskTemplates.isActive, true), eq(riskTemplates.sector, sector)));
    }
    
    return await db.select().from(riskTemplates)
      .where(eq(riskTemplates.isActive, true));
  }

  async createRiskTemplate(template: Omit<RiskTemplate, 'id' | 'createdAt'>): Promise<RiskTemplate> {
    const [riskTemplate] = await db
      .insert(riskTemplates)
      .values(template)
      .returning();
    return riskTemplate;
  }

  async generateRisks(workUnitName: string, locationName: string, companyActivity: string): Promise<Risk[]> {
    // Try to get risks from database templates first
    const templates = await this.getRiskTemplates();
    const workUnitLower = workUnitName.toLowerCase();
    const activityLower = companyActivity.toLowerCase();
    
    let applicableTemplates = templates.filter(template => {
      const categoryMatch = workUnitLower.includes(template.category.toLowerCase());
      const sectorMatch = template.sector && activityLower.includes(template.sector.toLowerCase());
      return categoryMatch || sectorMatch;
    });

    // If no templates found, use fallback risk generation
    if (applicableTemplates.length === 0) {
      return this.generateFallbackRisks(workUnitName, locationName, companyActivity);
    }

    // Convert templates to risks
    const risks: Risk[] = applicableTemplates.slice(0, 8).map(template => ({
      id: crypto.randomUUID(),
      type: template.type,
      danger: template.danger,
      gravity: template.gravity as 'Faible' | 'Moyenne' | 'Élevée',
      frequency: template.frequency as 'Rare' | 'Occasionnel' | 'Hebdomadaire' | 'Quotidien',
      control: template.control as 'Faible' | 'Moyenne' | 'Élevée',
      finalRisk: template.finalRisk as 'Faible' | 'Moyen' | 'Important',
      measures: template.measures,
    }));

    return risks;
  }

  private generateFallbackRisks(workUnitName: string, locationName: string, companyActivity: string): Risk[] {
    // Professional risk generation based on work unit type and activity
    const riskDatabase = this.getRiskDatabase();
    const workUnitLower = workUnitName.toLowerCase();
    const activityLower = companyActivity.toLowerCase();
    
    let applicableRisks: Risk[] = [];
    
    // Match risks based on work unit type
    for (const [category, risks] of Object.entries(riskDatabase)) {
      if (workUnitLower.includes(category) || activityLower.includes(category)) {
        applicableRisks = [...applicableRisks, ...risks];
      }
    }
    
    // If no specific matches, use general office/industrial risks
    if (applicableRisks.length === 0) {
      applicableRisks = [
        ...riskDatabase.general,
        ...riskDatabase.office
      ];
    }
    
    // Return 5-10 most relevant risks
    const shuffled = applicableRisks.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(10, shuffled.length));
  }

  // Action operations
  async getActionsByDuerp(duerpId: number): Promise<Action[]> {
    return await db
      .select()
      .from(actions)
      .where(eq(actions.duerpId, duerpId))
      .orderBy(desc(actions.createdAt));
  }

  async createAction(action: Omit<Action, 'id' | 'createdAt' | 'updatedAt'>): Promise<Action> {
    const [newAction] = await db
      .insert(actions)
      .values({
        ...action,
        updatedAt: new Date()
      })
      .returning();
    return newAction;
  }

  async updateAction(id: number, updates: Partial<Action>): Promise<Action> {
    const [action] = await db
      .update(actions)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(actions.id, id))
      .returning();
    
    if (!action) {
      throw new Error(`Action with id ${id} not found`);
    }
    return action;
  }

  // Comment operations
  async getCommentsByDuerp(duerpId: number): Promise<Comment[]> {
    return await db
      .select()
      .from(comments)
      .where(eq(comments.duerpId, duerpId))
      .orderBy(desc(comments.createdAt));
  }

  async createComment(comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
    const [newComment] = await db
      .insert(comments)
      .values(comment)
      .returning();
    return newComment;
  }

  private getRiskDatabase() {
    return {
      soudure: [
        {
          id: crypto.randomUUID(),
          type: "TMS",
          danger: "Posture debout prolongée",
          gravity: "Moyenne" as const,
          frequency: "Quotidien" as const,
          control: "Faible" as const,
          finalRisk: "Moyen" as const,
          measures: "Chaise réglable, pauses régulières"
        },
        {
          id: crypto.randomUUID(),
          type: "Incendie",
          danger: "Équipement inflammable",
          gravity: "Élevée" as const,
          frequency: "Occasionnel" as const,
          control: "Moyenne" as const,
          finalRisk: "Important" as const,
          measures: "Extincteurs, détecteurs de fumée"
        },
        {
          id: crypto.randomUUID(),
          type: "Brûlures",
          danger: "Contact avec surfaces chaudes",
          gravity: "Élevée" as const,
          frequency: "Hebdomadaire" as const,
          control: "Élevée" as const,
          finalRisk: "Moyen" as const,
          measures: "Gants de protection, formation"
        },
        {
          id: crypto.randomUUID(),
          type: "Intoxication",
          danger: "Inhalation de fumées",
          gravity: "Élevée" as const,
          frequency: "Quotidien" as const,
          control: "Élevée" as const,
          finalRisk: "Important" as const,
          measures: "Masque respiratoire, ventilation"
        },
        {
          id: crypto.randomUUID(),
          type: "Coupures",
          danger: "Manipulation d'outils tranchants",
          gravity: "Moyenne" as const,
          frequency: "Hebdomadaire" as const,
          control: "Élevée" as const,
          finalRisk: "Faible" as const,
          measures: "Gants anti-coupures, formation"
        }
      ],
      usinage: [
        {
          id: crypto.randomUUID(),
          type: "Bruit",
          danger: "Exposition prolongée aux machines",
          gravity: "Moyenne" as const,
          frequency: "Quotidien" as const,
          control: "Élevée" as const,
          finalRisk: "Moyen" as const,
          measures: "Protections auditives, cabines isolées"
        },
        {
          id: crypto.randomUUID(),
          type: "Projection de copeaux",
          danger: "Particules métalliques volantes",
          gravity: "Moyenne" as const,
          frequency: "Quotidien" as const,
          control: "Élevée" as const,
          finalRisk: "Faible" as const,
          measures: "Lunettes de protection, écrans"
        },
        {
          id: crypto.randomUUID(),
          type: "Coincement",
          danger: "Pièces mobiles des machines",
          gravity: "Élevée" as const,
          frequency: "Rare" as const,
          control: "Élevée" as const,
          finalRisk: "Faible" as const,
          measures: "Protections machines, arrêts d'urgence"
        }
      ],
      office: [
        {
          id: crypto.randomUUID(),
          type: "Fatigue visuelle",
          danger: "Exposition prolongée aux écrans",
          gravity: "Faible" as const,
          frequency: "Quotidien" as const,
          control: "Moyenne" as const,
          finalRisk: "Faible" as const,
          measures: "Pauses régulières, éclairage adapté"
        },
        {
          id: crypto.randomUUID(),
          type: "TMS",
          danger: "Posture assise prolongée",
          gravity: "Moyenne" as const,
          frequency: "Quotidien" as const,
          control: "Élevée" as const,
          finalRisk: "Faible" as const,
          measures: "Sièges ergonomiques, bureaux réglables"
        }
      ],
      general: [
        {
          id: crypto.randomUUID(),
          type: "Chutes de plain-pied",
          danger: "Sols glissants ou encombrés",
          gravity: "Moyenne" as const,
          frequency: "Occasionnel" as const,
          control: "Moyenne" as const,
          finalRisk: "Moyen" as const,
          measures: "Signalisation, nettoyage régulier"
        },
        {
          id: crypto.randomUUID(),
          type: "Stress",
          danger: "Charge de travail excessive",
          gravity: "Moyenne" as const,
          frequency: "Hebdomadaire" as const,
          control: "Faible" as const,
          finalRisk: "Moyen" as const,
          measures: "Gestion du temps, soutien psychologique"
        }
      ]
    };
  }
}

export const storage = new DatabaseStorage();
