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
import { eq, desc, and, lt, asc, ne } from "drizzle-orm";
import crypto from 'crypto';
import OpenAI from 'openai';

export interface IStorage {
  // Company operations
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<Company>): Promise<Company>;
  
  // DUERP document operations
  getDuerpDocument(companyId: number): Promise<DuerpDocument | undefined>;
  getDuerpDocuments(companyId: number): Promise<DuerpDocument[]>;
  createDuerpDocument(data: {
    companyId: number;
    title: string;
    locations: Location[];
    workStations: any[];
    finalRisks: Risk[];
    preventionMeasures: PreventionMeasure[];
  }): Promise<DuerpDocument>;
  updateDuerpDocument(id: number, updates: Partial<DuerpDocument>): Promise<DuerpDocument>;
  updateDuerpDocumentPartial(id: number, updates: {
    title?: string;
    locations?: Location[];
    workStations?: any[];
    finalRisks?: Risk[];
    preventionMeasures?: PreventionMeasure[];
    addRisks?: Risk[];
    removeRisks?: string[];
    updateRisks?: Array<{ id: string; updates: Partial<Risk> }>;
  }): Promise<DuerpDocument>;
  
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
  
  // Revision tracking operations
  getDocumentsNeedingRevision(): Promise<DuerpDocument[]>;
  getDocumentsNeedingNotification(): Promise<DuerpDocument[]>;
  markRevisionNotified(documentId: number): Promise<void>;
  updateRevisionDate(documentId: number): Promise<DuerpDocument>;
  
  // Utility operations
  generateUniqueDocumentTitle(baseTitle: string): Promise<string>;
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
      .values(insertCompany)
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

  async getDuerpDocuments(companyId: number): Promise<DuerpDocument[]> {
    const documents = await db
      .select()
      .from(duerpDocuments)
      .where(eq(duerpDocuments.companyId, companyId))
      .orderBy(desc(duerpDocuments.createdAt));
    return documents;
  }

  async createDuerpDocument(data: {
    companyId: number;
    title: string;
    locations: Location[];
    workStations: any[];
    finalRisks: Risk[];
    preventionMeasures: PreventionMeasure[];
  }): Promise<DuerpDocument> {
    // Vérifier si un document avec le même titre existe déjà
    const existingDocument = await db
      .select()
      .from(duerpDocuments)
      .where(
        and(
          eq(duerpDocuments.title, data.title),
          ne(duerpDocuments.status, 'archived')
        )
      )
      .limit(1);

    if (existingDocument.length > 0) {
      throw new Error(`Un document avec le titre "${data.title}" existe déjà. Veuillez choisir un autre nom.`);
    }

    const [document] = await db
      .insert(duerpDocuments)
      .values({
        companyId: data.companyId,
        title: data.title,
        version: "1.0",
        locations: data.locations,
        workStations: data.workStations,
        finalRisks: data.finalRisks,
        preventionMeasures: data.preventionMeasures,
        status: "draft",
        nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        lastRevisionDate: new Date(),
        revisionNotified: false,
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
    // Use OpenAI to generate contextual risks
    try {
      const aiRisks = await this.generateAIRisks(workUnitName, locationName, companyActivity);
      if (aiRisks.length > 0) {
        return aiRisks;
      }
    } catch (error) {
      console.error('Error generating AI risks:', error);
    }

    // Fallback to template-based system if AI fails
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

  private async generateAIRisks(workUnitName: string, locationName: string, companyActivity: string): Promise<Risk[]> {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const prompt = `En tant qu'expert en santé et sécurité au travail français, analysez le poste "${workUnitName}" dans le lieu "${locationName}" d'une entreprise de "${companyActivity}".

Identifiez TOUS les risques professionnels pertinents selon la réglementation française. Soyez exhaustif mais restez cohérent avec le contexte. Pour chaque risque identifié, indiquez :
- type: Type de risque (TMS, Chute, Bruit, Incendie, Chimique, Électrique, etc.)
- danger: Description précise du danger
- gravity: "Faible", "Moyenne", ou "Élevée"  
- frequency: "Rare", "Occasionnel", "Hebdomadaire", ou "Quotidien"
- control: "Faible", "Moyenne", ou "Élevée"
- finalRisk: "Faible", "Moyen", ou "Important" (calculé selon gravity × frequency ÷ control)
- measures: Mesures de prévention spécifiques

Répondez uniquement avec un JSON valide contenant un tableau "risks" avec tous les risques identifiés.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: "Vous êtes un expert en évaluation des risques professionnels français. Répondez uniquement avec du JSON valide." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2000
      });

      const result = JSON.parse(response.choices[0].message.content || '{"risks": []}');
      
      return result.risks.map((risk: any) => ({
        id: crypto.randomUUID(),
        type: risk.type || 'Risque général',
        danger: risk.danger || 'Danger non spécifié',
        gravity: risk.gravity || 'Moyenne',
        frequency: risk.frequency || 'Occasionnel',
        control: risk.control || 'Moyenne',
        finalRisk: risk.finalRisk || 'Moyen',
        measures: risk.measures || 'Mesures de prévention à définir'
      }));
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      return [];
    }
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

  // Revision tracking operations
  async getDocumentsNeedingRevision(): Promise<DuerpDocument[]> {
    const now = new Date();
    const documents = await db
      .select()
      .from(duerpDocuments)
      .where(
        and(
          eq(duerpDocuments.status, 'approved'),
          lt(duerpDocuments.nextReviewDate, now)
        )
      )
      .orderBy(asc(duerpDocuments.nextReviewDate));
    return documents;
  }

  async getDocumentsNeedingNotification(): Promise<DuerpDocument[]> {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const documents = await db
      .select()
      .from(duerpDocuments)
      .where(
        and(
          eq(duerpDocuments.status, 'approved'),
          eq(duerpDocuments.revisionNotified, false),
          lt(duerpDocuments.nextReviewDate, thirtyDaysFromNow)
        )
      )
      .orderBy(asc(duerpDocuments.nextReviewDate));
    return documents;
  }

  async markRevisionNotified(documentId: number): Promise<void> {
    await db
      .update(duerpDocuments)
      .set({ revisionNotified: true })
      .where(eq(duerpDocuments.id, documentId));
  }

  async updateRevisionDate(documentId: number): Promise<DuerpDocument> {
    const now = new Date();
    const nextReviewDate = new Date(now);
    nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1);
    
    const [document] = await db
      .update(duerpDocuments)
      .set({
        lastRevisionDate: now,
        nextReviewDate: nextReviewDate,
        revisionNotified: false,
        updatedAt: now
      })
      .where(eq(duerpDocuments.id, documentId))
      .returning();
    
    if (!document) {
      throw new Error(`DUERP document with id ${documentId} not found`);
    }
    return document;
  }

  async updateDuerpDocumentPartial(id: number, updates: {
    title?: string;
    locations?: Location[];
    workStations?: any[];
    finalRisks?: Risk[];
    preventionMeasures?: PreventionMeasure[];
    addRisks?: Risk[];
    removeRisks?: string[];
    updateRisks?: Array<{ id: string; updates: Partial<Risk> }>;
  }): Promise<DuerpDocument> {
    // Récupérer le document existant
    const [existingDoc] = await db
      .select()
      .from(duerpDocuments)
      .where(eq(duerpDocuments.id, id))
      .limit(1);

    if (!existingDoc) {
      throw new Error(`Document DUERP avec l'ID ${id} non trouvé`);
    }

    let finalRisks = existingDoc.finalRisks as Risk[];

    // Gérer les modifications de risques
    if (updates.addRisks) {
      finalRisks = [...finalRisks, ...updates.addRisks];
    }

    if (updates.removeRisks) {
      finalRisks = finalRisks.filter(risk => !updates.removeRisks!.includes(risk.id));
    }

    if (updates.updateRisks) {
      finalRisks = finalRisks.map(risk => {
        const update = updates.updateRisks!.find(u => u.id === risk.id);
        return update ? { ...risk, ...update.updates } : risk;
      });
    }

    // Remplacer complètement les risques si spécifié
    if (updates.finalRisks) {
      finalRisks = updates.finalRisks;
    }

    // Préparer les données de mise à jour
    const updateData: any = {
      updatedAt: new Date()
    };

    if (updates.title) updateData.title = updates.title;
    if (updates.locations) updateData.locations = updates.locations;
    if (updates.workStations) updateData.workStations = updates.workStations;
    if (updates.preventionMeasures) updateData.preventionMeasures = updates.preventionMeasures;
    
    updateData.finalRisks = finalRisks;

    // Effectuer la mise à jour
    const [document] = await db
      .update(duerpDocuments)
      .set(updateData)
      .where(eq(duerpDocuments.id, id))
      .returning();

    if (!document) {
      throw new Error(`Impossible de mettre à jour le document DUERP avec l'ID ${id}`);
    }

    return document;
  }

  // Utility operations
  async generateUniqueDocumentTitle(baseTitle: string): Promise<string> {
    let counter = 1;
    let uniqueTitle = baseTitle;

    while (true) {
      const existingDocument = await db
        .select()
        .from(duerpDocuments)
        .where(
          and(
            eq(duerpDocuments.title, uniqueTitle),
            ne(duerpDocuments.status, 'archived')
          )
        )
        .limit(1);

      if (existingDocument.length === 0) {
        return uniqueTitle;
      }

      counter++;
      uniqueTitle = `${baseTitle} (${counter})`;
    }
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
