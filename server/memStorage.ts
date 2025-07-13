import { 
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
} from "@shared/simpleSchema";
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

export class MemoryStorage implements IStorage {
  private companies: Map<number, Company> = new Map();
  private duerpDocuments: Map<number, DuerpDocument> = new Map();
  private riskTemplates: Map<number, RiskTemplate> = new Map();
  private actions: Map<number, Action> = new Map();
  private comments: Map<number, Comment> = new Map();
  private nextId = 1;

  constructor() {
    // Ajouter quelques données de test
    this.initializeTestData();
  }

  private initializeTestData() {
    // Données de test pour le développement
    const testCompany: Company = {
      id: 1,
      name: "Entreprise Test",
      activity: "Services",
      employeeCount: 25,
      address: "123 Rue de Test",
      phone: "01 23 45 67 89",
      email: "test@entreprise.com",
      locations: [],
      workStations: [],
      finalRisks: [],
      preventionMeasures: [],
      existingPreventionMeasures: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.companies.set(1, testCompany);
    this.nextId = 2;
  }

  // Company operations
  async getCompany(id: number): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const company: Company = {
      id: this.nextId++,
      ...insertCompany,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.companies.set(company.id, company);
    return company;
  }

  async updateCompany(id: number, updates: Partial<Company>): Promise<Company> {
    const existing = this.companies.get(id);
    if (!existing) throw new Error(`Company with id ${id} not found`);
    
    const updated: Company = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.companies.set(id, updated);
    return updated;
  }

  // DUERP document operations
  async getDuerpDocument(companyId: number): Promise<DuerpDocument | undefined> {
    return Array.from(this.duerpDocuments.values()).find(doc => doc.companyId === companyId);
  }

  async getDuerpDocuments(companyId: number): Promise<DuerpDocument[]> {
    return Array.from(this.duerpDocuments.values()).filter(doc => doc.companyId === companyId);
  }

  async createDuerpDocument(data: {
    companyId: number;
    title: string;
    locations: Location[];
    workStations: any[];
    finalRisks: Risk[];
    preventionMeasures: PreventionMeasure[];
  }): Promise<DuerpDocument> {
    const doc: DuerpDocument = {
      id: this.nextId++,
      ...data,
      nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 an
      lastRevisionDate: new Date().toISOString(),
      revisionNotified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.duerpDocuments.set(doc.id, doc);
    return doc;
  }

  async updateDuerpDocument(id: number, updates: Partial<DuerpDocument>): Promise<DuerpDocument> {
    const existing = this.duerpDocuments.get(id);
    if (!existing) throw new Error(`DUERP document with id ${id} not found`);
    
    const updated: DuerpDocument = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.duerpDocuments.set(id, updated);
    return updated;
  }

  // Risk operations
  async generateRisks(workUnitName: string, locationName: string, companyActivity: string): Promise<Risk[]> {
    try {
      return await this.generateAIRisks(workUnitName, locationName, companyActivity);
    } catch (error) {
      console.warn('Fallback to predefined risks:', error);
      return this.generateFallbackRisks(workUnitName, locationName, companyActivity);
    }
  }

  private async generateAIRisks(workUnitName: string, locationName: string, companyActivity: string): Promise<Risk[]> {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const prompt = `Tu es un expert en sécurité au travail. Génère une liste de risques professionnels pour:
    - Poste de travail: ${workUnitName}
    - Lieu: ${locationName}
    - Secteur d'activité: ${companyActivity}
    
    Retourne un JSON avec un tableau "risks" contenant des objets avec ces propriétés:
    - type: type de risque
    - danger: description du danger
    - gravity: "Faible", "Moyenne", ou "Élevée"
    - frequency: "Rare", "Occasionnel", "Hebdomadaire", ou "Quotidien"
    - control: "Faible", "Moyenne", ou "Élevée"
    - finalRisk: "Faible", "Moyen", ou "Important"
    - measures: mesures de prévention suggérées
    
    Limite-toi à 5-8 risques pertinents.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // le modèle OpenAI le plus récent
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{"risks": []}');
    return result.risks.map((risk: any) => ({
      ...risk,
      id: crypto.randomUUID()
    }));
  }

  private generateFallbackRisks(workUnitName: string, locationName: string, companyActivity: string): Risk[] {
    const baseRisks = [
      {
        type: "Physique",
        danger: "Chutes de plain-pied",
        gravity: "Moyenne" as const,
        frequency: "Occasionnel" as const,
        control: "Moyenne" as const,
        finalRisk: "Moyen" as const,
        measures: "Maintenir les sols propres et secs"
      },
      {
        type: "Ergonomique",
        danger: "Troubles musculo-squelettiques",
        gravity: "Élevée" as const,
        frequency: "Quotidien" as const,
        control: "Faible" as const,
        finalRisk: "Important" as const,
        measures: "Formation aux gestes et postures"
      }
    ];

    return baseRisks.map(risk => ({
      ...risk,
      id: crypto.randomUUID()
    }));
  }

  async getRiskTemplates(sector?: string): Promise<RiskTemplate[]> {
    const templates = Array.from(this.riskTemplates.values());
    return sector ? templates.filter(t => t.sector === sector) : templates;
  }

  async createRiskTemplate(template: Omit<RiskTemplate, 'id' | 'createdAt'>): Promise<RiskTemplate> {
    const riskTemplate: RiskTemplate = {
      id: this.nextId++,
      ...template,
      createdAt: new Date()
    };
    this.riskTemplates.set(riskTemplate.id, riskTemplate);
    return riskTemplate;
  }

  // Action operations
  async getActionsByDuerp(duerpId: number): Promise<Action[]> {
    return Array.from(this.actions.values()).filter(action => action.duerpId === duerpId);
  }

  async createAction(action: Omit<Action, 'id' | 'createdAt' | 'updatedAt'>): Promise<Action> {
    const newAction: Action = {
      id: this.nextId++,
      ...action,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.actions.set(newAction.id, newAction);
    return newAction;
  }

  async updateAction(id: number, updates: Partial<Action>): Promise<Action> {
    const existing = this.actions.get(id);
    if (!existing) throw new Error(`Action with id ${id} not found`);
    
    const updated: Action = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.actions.set(id, updated);
    return updated;
  }

  // Comment operations
  async getCommentsByDuerp(duerpId: number): Promise<Comment[]> {
    return Array.from(this.comments.values()).filter(comment => comment.duerpId === duerpId);
  }

  async createComment(comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
    const newComment: Comment = {
      id: this.nextId++,
      ...comment,
      createdAt: new Date()
    };
    this.comments.set(newComment.id, newComment);
    return newComment;
  }

  // Revision tracking operations
  async getDocumentsNeedingRevision(): Promise<DuerpDocument[]> {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    return Array.from(this.duerpDocuments.values())
      .filter(doc => new Date(doc.lastRevisionDate) <= oneYearAgo);
  }

  async getDocumentsNeedingNotification(): Promise<DuerpDocument[]> {
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return Array.from(this.duerpDocuments.values())
      .filter(doc => new Date(doc.nextReviewDate) <= thirtyDaysFromNow && !doc.revisionNotified);
  }

  async markRevisionNotified(documentId: number): Promise<void> {
    const doc = this.duerpDocuments.get(documentId);
    if (doc) {
      doc.revisionNotified = true;
      doc.updatedAt = new Date();
    }
  }

  async updateRevisionDate(documentId: number): Promise<DuerpDocument> {
    const doc = this.duerpDocuments.get(documentId);
    if (!doc) throw new Error(`Document with id ${documentId} not found`);
    
    const now = new Date();
    const updated: DuerpDocument = {
      ...doc,
      lastRevisionDate: now.toISOString(),
      nextReviewDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      revisionNotified: false,
      updatedAt: now
    };
    this.duerpDocuments.set(documentId, updated);
    return updated;
  }

  // Utility operations
  async generateUniqueDocumentTitle(baseTitle: string): Promise<string> {
    const existingTitles = Array.from(this.duerpDocuments.values()).map(doc => doc.title);
    
    if (!existingTitles.includes(baseTitle)) {
      return baseTitle;
    }
    
    let counter = 1;
    let newTitle = `${baseTitle} (${counter})`;
    while (existingTitles.includes(newTitle)) {
      counter++;
      newTitle = `${baseTitle} (${counter})`;
    }
    
    return newTitle;
  }
}

export const storage = new MemoryStorage();