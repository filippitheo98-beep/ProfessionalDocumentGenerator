import { 
  companies, 
  duerpDocuments, 
  riskTemplates, 
  actions, 
  comments,
  uploadedDocuments,
  type Company, 
  type InsertCompany, 
  type Location, 
  type WorkUnit, 
  type Risk, 
  type PreventionMeasure, 
  type DuerpDocument,
  type RiskTemplate,
  type Action,
  type Comment,
  type UploadedDocument,
  type InsertUploadedDocument
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, desc, and, lt, asc, ne } from "drizzle-orm";

function rowToCompany(row: Record<string, unknown>): Company {
  return {
    id: row.id as number,
    name: row.name as string,
    activity: row.activity as string,
    description: (row.description as string) ?? null,
    sector: (row.sector as string) ?? null,
    address: (row.address as string) ?? null,
    siret: (row.siret as string) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    employeeCount: (row.employee_count as number) ?? null,
    logo: (row.logo as string) ?? null,
    existingPreventionMeasures: (row.existing_prevention_measures as Company["existingPreventionMeasures"]) ?? [],
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}
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
    workUnitsData?: any[];
    sites?: any[];
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
  generateRisks(workUnitName: string, locationName: string, companyActivity: string, companyDescription?: string): Promise<Risk[]>;
  getRiskTemplates(sector?: string): Promise<RiskTemplate[]>;
  createRiskTemplate(template: Omit<RiskTemplate, 'id' | 'createdAt'>): Promise<RiskTemplate>;
  
  // Prevention measures operations
  generatePreventionRecommendations(companyActivity: string, risks: Risk[], locations: any[], workStations: any[]): Promise<any[]>;
  
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
  
  // Uploaded document operations
  getUploadedDocuments(companyId: number): Promise<UploadedDocument[]>;
  createUploadedDocument(data: InsertUploadedDocument): Promise<UploadedDocument>;
  updateUploadedDocument(id: number, updates: Partial<UploadedDocument>): Promise<UploadedDocument>;
  deleteUploadedDocument(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Company operations
  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    // INSERT avec id explicite (SELECT MAX(id)+1) pour ne pas dépendre de la séquence (désynchronisée après import CSV)
    const params = [
      insertCompany.name,
      insertCompany.activity,
      insertCompany.description ?? null,
      insertCompany.sector ?? null,
      insertCompany.address ?? null,
      insertCompany.siret ?? null,
      insertCompany.phone ?? null,
      insertCompany.email ?? null,
      insertCompany.employeeCount ?? null,
      insertCompany.logo ?? null,
      JSON.stringify(insertCompany.existingPreventionMeasures ?? []),
    ];
    const doInsert = async () => {
      // Requête brute (pas Drizzle) pour éviter la séquence désynchronisée après import CSV
      const { rows } = await pool.query(
        `INSERT INTO companies (id, name, activity, description, sector, address, siret, phone, email, employee_count, logo, existing_prevention_measures, created_at, updated_at)
         SELECT n.id, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW(), NOW()
         FROM (SELECT COALESCE(MAX(id), 0) + 1 AS id FROM companies) n
         RETURNING *`,
        params,
      );
      if (!rows[0]) throw new Error("Insert company failed");
      return rowToCompany(rows[0]);
    };
    try {
      return await doInsert();
    } catch (err: unknown) {
      const isDuplicate = err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505";
      if (isDuplicate) return await doInsert();
      throw err;
    }
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
    
    if (document && document.finalRisks) {
      // Recalculer les valeurs numériques et la priorité pour tous les risques
      document.finalRisks = (document.finalRisks as Risk[]).map(risk => this.recalculateRiskValues(risk));
    }
    
    return document;
  }

  async getDuerpDocuments(companyId: number): Promise<DuerpDocument[]> {
    const documents = await db
      .select()
      .from(duerpDocuments)
      .where(eq(duerpDocuments.companyId, companyId))
      .orderBy(desc(duerpDocuments.createdAt));
    
    // Recalculer les valeurs numériques et la priorité pour tous les risques de tous les documents
    return documents.map(doc => {
      if (doc.finalRisks) {
        doc.finalRisks = (doc.finalRisks as Risk[]).map(risk => this.recalculateRiskValues(risk));
      }
      return doc;
    });
  }

  async createDuerpDocument(data: {
    companyId: number;
    title: string;
    workUnitsData?: any[];
    sites?: any[];
    locations: Location[];
    workStations: any[];
    finalRisks: Risk[];
    preventionMeasures: PreventionMeasure[];
  }): Promise<DuerpDocument> {
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
        workUnitsData: data.workUnitsData || [],
        sites: data.sites || [],
        locations: data.locations,
        workStations: data.workStations,
        finalRisks: data.finalRisks,
        preventionMeasures: data.preventionMeasures,
        status: "draft",
        nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
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

  async generateRisks(workUnitName: string, locationName: string, companyActivity: string, companyDescription?: string): Promise<Risk[]> {
    // Use OpenAI to generate contextual risks
    try {
      const aiRisks = await this.generateAIRisks(workUnitName, locationName, companyActivity, companyDescription);
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

  private async generateAIRisks(workUnitName: string, locationName: string, companyActivity: string, companyDescription?: string): Promise<Risk[]> {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const descriptionContext = companyDescription ? `

Description détaillée de l'entreprise : ${companyDescription}

Utilisez cette description pour mieux comprendre le contexte spécifique de l'entreprise et identifier des risques plus précis et pertinents.` : '';
    
    const prompt = `En tant qu'expert en santé et sécurité au travail français, analysez le poste "${workUnitName}" dans le lieu "${locationName}" d'une entreprise de "${companyActivity}".${descriptionContext}

Identifiez TOUS les risques professionnels pertinents selon la réglementation française. Soyez exhaustif mais restez cohérent avec le contexte. Pour chaque risque identifié, indiquez :
- type: Type de risque (TMS, Chute, Bruit, Incendie, Chimique, Électrique, etc.)
- danger: Description précise du danger
- gravity: "Faible", "Moyenne", "Grave", ou "Très Grave"
- frequency: "Annuelle", "Mensuelle", "Hebdomadaire", ou "Journalière"
- control: "Très élevée", "Élevée", "Moyenne", ou "Absente"
- measures: Mesures de prévention spécifiques

IMPORTANT : Utilisez exactement ces valeurs pour gravity, frequency et control.

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
      
      return result.risks.map((risk: any) => {
        const gravity = risk.gravity || 'Moyenne';
        const frequency = risk.frequency || 'Mensuelle';
        const control = risk.control || 'Moyenne';
        
        // Calcul du score de risque selon votre méthode
        const gravityValue = gravity === 'Faible' ? 1 : gravity === 'Moyenne' ? 4 : gravity === 'Grave' ? 20 : 100;
        const frequencyValue = frequency === 'Annuelle' ? 1 : frequency === 'Mensuelle' ? 4 : frequency === 'Hebdomadaire' ? 10 : 50;
        const controlValue = control === 'Très élevée' ? 0.05 : control === 'Élevée' ? 0.2 : control === 'Moyenne' ? 0.5 : 1;
        
        const riskScore = gravityValue * frequencyValue * controlValue;
        const priority = riskScore >= 500 ? 'Priorité 1 (Forte)' : riskScore >= 100 ? 'Priorité 2 (Moyenne)' : riskScore >= 10 ? 'Priorité 3 (Modéré)' : 'Priorité 4 (Faible)';
        
        return {
          id: crypto.randomUUID(),
          type: risk.type || 'Risque général',
          danger: risk.danger || 'Danger non spécifié',
          gravity: gravity as 'Faible' | 'Moyenne' | 'Grave' | 'Très Grave',
          gravityValue: gravityValue as 1 | 4 | 20 | 100,
          frequency: frequency as 'Annuelle' | 'Mensuelle' | 'Hebdomadaire' | 'Journalière',
          frequencyValue: frequencyValue as 1 | 4 | 10 | 50,
          control: control as 'Très élevée' | 'Élevée' | 'Moyenne' | 'Absente',
          controlValue: controlValue as 0.05 | 0.2 | 0.5 | 1,
          riskScore: riskScore,
          priority: priority as 'Priorité 1 (Forte)' | 'Priorité 2 (Moyenne)' | 'Priorité 3 (Modéré)' | 'Priorité 4 (Faible)',
          measures: risk.measures || 'Mesures de prévention à définir'
        };
      });
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      return [];
    }
  }

  async generateHierarchicalRisks(
    level: 'Site' | 'Unité',
    elementName: string,
    elementDescription: string,
    companyActivity: string,
    context: string
  ): Promise<Risk[]> {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const levelRules: Record<string, { allowed: string; forbidden: string }> = {
      'Site': {
        allowed: 'Incendie/Explosion, Circulation interne/externe, Environnement de travail général, Organisation globale, Sécurité des locaux',
        forbidden: 'Gestes individuels, Postures, Utilisation d\'outils spécifiques'
      },
      'Unité': {
        allowed: 'Manutentions, Postures de travail, Utilisation d\'équipements, Produits et substances, Organisation du travail, Gestes répétitifs, Ergonomie, Ambiance de travail, Risques spécifiques aux postes de travail inclus',
        forbidden: 'Aucune restriction spécifique'
      }
    };

    const familyList = [
      'Mécanique', 'Physique', 'Chimique', 'Biologique', 'Radiologique',
      'Incendie-Explosion', 'Électrique', 'Ergonomique', 'Psychosocial',
      'Routier', 'Environnemental', 'Organisationnel'
    ];
    
    const prompt = `Tu interviens pour générer des SITUATIONS DE RISQUES PROFESSIONNELLES pour une application DUERP.

🧱 CONTEXTE

Niveau : ${level}
Nom de l'élément : ${elementName}
Secteur d'activité : ${companyActivity}
Environnement de travail : ${elementDescription || 'Non précisé'}
${context ? `\nInformations complémentaires:\n${context}` : ''}

🎯 OBJECTIF IMPÉRATIF

👉 Générer PLUSIEURS SITUATIONS DE RISQUE DISTINCTES PAR FAMILLE DE RISQUE, lorsque pertinent.

Une famille de risque peut comporter 2 à 5 situations différentes.
Chaque situation doit être indépendante, exploitable dans un tableau DUERP.

📌 RÈGLES ESSENTIELLES

1️⃣ FAMILLE ≠ RISQUE
- La famille de risque est un regroupement
- Le risque réel est la SITUATION D'EXPOSITION

Exemple attendu :
- Famille: Ergonomique → Situation 1: Travail prolongé sur écran
- Famille: Ergonomique → Situation 2: Postures statiques prolongées  
- Famille: Ergonomique → Situation 3: Mobilier inadapté

2️⃣ FILTRAGE PAR NIVEAU "${level}"
AUTORISÉ : ${levelRules[level].allowed}
INTERDIT : ${levelRules[level].forbidden}

3️⃣ STRUCTURE OBLIGATOIRE de chaque situation :
{
  "family": "Famille (parmi: ${familyList.join(', ')})",
  "situation": "Situation d'exposition (courte et précise)",
  "danger": "Description de la situation de danger",
  "gravity": "Faible | Moyenne | Grave | Très Grave",
  "frequency": "Annuelle | Mensuelle | Hebdomadaire | Journalière",
  "control": "Très élevée | Élevée | Moyenne | Absente",
  "measures": "Mesures de prévention recommandées (génériques, non pédagogiques)",
  "existingMeasures": ["Mesure existante 1", "Mesure existante 2"]
}

4️⃣ QUANTITÉ ATTENDUE
- Entre 5 et 12 situations de risque AU TOTAL
- Réparties sur PLUSIEURS familles
- Ne jamais forcer une famille non pertinente

5️⃣ QUALITÉ ATTENDUE
- Langage strictement DUERP
- Exploitable tel quel dans un tableau INRS/EvRP
- Pas de doublons
- Pas de généralités vagues
- Pas d'explications réglementaires

🎯 RÉSULTAT ATTENDU
Le résultat doit être directement transposable dans un tableau DUERP avec :
- Plusieurs lignes pour une même famille de risque
- Une logique identique à un tableau EvRP professionnel

Répondez en JSON valide: { "risks": [...] }`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Expert en prévention des risques professionnels français. Réponses conformes aux exigences DUERP et recommandations INRS. JSON uniquement." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 3000
      });

      const result = JSON.parse(response.choices[0].message.content || '{"risks": []}');
      
      return result.risks.map((risk: any) => {
        const gravity = risk.gravity || 'Moyenne';
        const frequency = risk.frequency || 'Mensuelle';
        const control = risk.control || 'Moyenne';
        
        const gravityValue = gravity === 'Faible' ? 1 : gravity === 'Moyenne' ? 4 : gravity === 'Grave' ? 20 : 100;
        const frequencyValue = frequency === 'Annuelle' ? 1 : frequency === 'Mensuelle' ? 4 : frequency === 'Hebdomadaire' ? 10 : 50;
        const controlValue = control === 'Très élevée' ? 0.05 : control === 'Élevée' ? 0.2 : control === 'Moyenne' ? 0.5 : 1;
        
        const riskScore = gravityValue * frequencyValue * controlValue;
        const priority = riskScore >= 500 ? 'Priorité 1 (Forte)' : riskScore >= 100 ? 'Priorité 2 (Moyenne)' : riskScore >= 10 ? 'Priorité 3 (Modéré)' : 'Priorité 4 (Faible)';
        
        // Utiliser "situation" si présent, sinon "danger" pour rétrocompatibilité
        const situationText = risk.situation || risk.type || 'Situation non spécifiée';
        const dangerText = risk.danger || situationText;
        
        return {
          id: crypto.randomUUID(),
          type: situationText,
          family: risk.family || 'Autre',
          situation: situationText,
          danger: dangerText,
          gravity: gravity as 'Faible' | 'Moyenne' | 'Grave' | 'Très Grave',
          gravityValue: gravityValue as 1 | 4 | 20 | 100,
          frequency: frequency as 'Annuelle' | 'Mensuelle' | 'Hebdomadaire' | 'Journalière',
          frequencyValue: frequencyValue as 1 | 4 | 10 | 50,
          control: control as 'Très élevée' | 'Élevée' | 'Moyenne' | 'Absente',
          controlValue: controlValue as 0.05 | 0.2 | 0.5 | 1,
          riskScore,
          priority: priority as 'Priorité 1 (Forte)' | 'Priorité 2 (Moyenne)' | 'Priorité 3 (Modéré)' | 'Priorité 4 (Faible)',
          measures: risk.measures || 'Mesures de prévention à définir',
          existingMeasures: Array.isArray(risk.existingMeasures) ? risk.existingMeasures : [],
          originLevel: level,
          isValidated: false,
          isAIGenerated: true,
          isInherited: false,
          userModified: false
        };
      });
    } catch (error) {
      console.error('Error generating hierarchical risks:', error);
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

  async generatePreventionRecommendations(companyActivity: string, risks: Risk[], locations: any[], workStations: any[]): Promise<any[]> {
    // Analyse des risques pour générer des recommandations
    const recommendations = [];
    
    // Recommandations générales basées sur l'activité de l'entreprise
    const generalRecommendations = this.getGeneralRecommendations(companyActivity);
    recommendations.push(...generalRecommendations);
    
    // Recommandations spécifiques aux risques identifiés
    for (const risk of risks) {
      const riskSpecificRecommendations = this.getRiskSpecificRecommendations(risk);
      recommendations.push(...riskSpecificRecommendations);
    }
    
    // Recommandations par lieu
    for (const location of locations) {
      const locationRecommendations = this.getLocationRecommendations(location);
      recommendations.push(...locationRecommendations);
    }
    
    // Recommandations par poste de travail
    for (const workStation of workStations) {
      const workStationRecommendations = this.getWorkStationRecommendations(workStation);
      recommendations.push(...workStationRecommendations);
    }
    
    // Déduplication et priorisation
    return this.deduplicateAndPrioritize(recommendations);
  }

  private getGeneralRecommendations(companyActivity: string): any[] {
    const recommendations = [
      {
        description: "Mettre en place un système de management de la sécurité et santé au travail",
        level: "Général",
        category: "Organisationnel",
        priority: "Élevée",
        cost: "Moyenne",
        effectiveness: "Élevée"
      },
      {
        description: "Organiser des formations régulières sur les risques professionnels",
        level: "Général",
        category: "Humain",
        priority: "Élevée",
        cost: "Moyenne",
        effectiveness: "Élevée"
      },
      {
        description: "Établir des procédures d'urgence et d'évacuation",
        level: "Général",
        category: "Organisationnel",
        priority: "Élevée",
        cost: "Faible",
        effectiveness: "Élevée"
      }
    ];

    // Recommandations spécifiques selon l'activité
    if (companyActivity.toLowerCase().includes('bureau')) {
      recommendations.push({
        description: "Aménager les postes de travail informatiques selon les normes ergonomiques",
        level: "Général",
        category: "Technique",
        priority: "Moyenne",
        cost: "Moyenne",
        effectiveness: "Élevée"
      });
    }

    if (companyActivity.toLowerCase().includes('industrie') || companyActivity.toLowerCase().includes('production')) {
      recommendations.push({
        description: "Mettre en place une maintenance préventive des équipements",
        level: "Général",
        category: "Technique",
        priority: "Élevée",
        cost: "Élevée",
        effectiveness: "Élevée"
      });
    }

    return recommendations;
  }

  private getRiskSpecificRecommendations(risk: Risk): any[] {
    const recommendations = [];
    
    if (risk.type.toLowerCase().includes('tms') || risk.type.toLowerCase().includes('musculo')) {
      recommendations.push({
        description: "Formation aux gestes et postures pour prévenir les TMS",
        level: "Général",
        category: "Humain",
        priority: "Élevée",
        cost: "Faible",
        effectiveness: "Élevée",
        targetRiskIds: [risk.id]
      });
    }

    if (risk.type.toLowerCase().includes('chute')) {
      recommendations.push({
        description: "Installer des revêtements antidérapants et améliorer l'éclairage",
        level: "Lieu",
        category: "Technique",
        priority: "Élevée",
        cost: "Moyenne",
        effectiveness: "Élevée",
        targetRiskIds: [risk.id]
      });
    }

    if (risk.type.toLowerCase().includes('chimique')) {
      recommendations.push({
        description: "Fournir des équipements de protection individuelle adaptés",
        level: "Poste",
        category: "EPI",
        priority: "Élevée",
        cost: "Moyenne",
        effectiveness: "Élevée",
        targetRiskIds: [risk.id]
      });
    }

    if (risk.type.toLowerCase().includes('bruit')) {
      recommendations.push({
        description: "Mettre en place des protections auditives et réduire le bruit à la source",
        level: "Lieu",
        category: "Technique",
        priority: "Élevée",
        cost: "Élevée",
        effectiveness: "Élevée",
        targetRiskIds: [risk.id]
      });
    }

    return recommendations;
  }

  private getLocationRecommendations(location: any): any[] {
    return [
      {
        description: `Améliorer la signalisation de sécurité dans ${location.name}`,
        level: "Lieu",
        category: "Technique",
        priority: "Moyenne",
        cost: "Faible",
        effectiveness: "Moyenne",
        locationId: location.id
      },
      {
        description: `Maintenir l'ordre et la propreté dans ${location.name}`,
        level: "Lieu",
        category: "Organisationnel",
        priority: "Moyenne",
        cost: "Faible",
        effectiveness: "Moyenne",
        locationId: location.id
      }
    ];
  }

  private getWorkStationRecommendations(workStation: any): any[] {
    return [
      {
        description: `Adapter le poste de travail ${workStation.name} aux spécificités des tâches`,
        level: "Poste",
        category: "Technique",
        priority: "Moyenne",
        cost: "Moyenne",
        effectiveness: "Élevée",
        workStationId: workStation.id
      },
      {
        description: `Former spécifiquement les opérateurs du poste ${workStation.name}`,
        level: "Poste",
        category: "Humain",
        priority: "Élevée",
        cost: "Faible",
        effectiveness: "Élevée",
        workStationId: workStation.id
      }
    ];
  }

  private deduplicateAndPrioritize(recommendations: any[]): any[] {
    // Supprimer les doublons basés sur la description
    const uniqueRecommendations = recommendations.filter((rec, index, arr) => 
      index === arr.findIndex(r => r.description === rec.description)
    );

    // Trier par priorité (Élevée > Moyenne > Faible)
    const priorityOrder = { 'Élevée': 3, 'Moyenne': 2, 'Faible': 1 };
    return uniqueRecommendations.sort((a, b) => 
      priorityOrder[b.priority] - priorityOrder[a.priority]
    );
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

  // Fonction utilitaire pour recalculer les valeurs numériques et la priorité
  private recalculateRiskValues(risk: Risk): Risk {
    const gravityValue = risk.gravity === 'Faible' ? 1 : risk.gravity === 'Moyenne' ? 4 : risk.gravity === 'Grave' ? 20 : 100;
    const frequencyValue = risk.frequency === 'Annuelle' ? 1 : risk.frequency === 'Mensuelle' ? 4 : risk.frequency === 'Hebdomadaire' ? 10 : 50;
    const controlValue = risk.control === 'Très élevée' ? 0.05 : risk.control === 'Élevée' ? 0.2 : risk.control === 'Moyenne' ? 0.5 : 1;
    
    const riskScore = gravityValue * frequencyValue * controlValue;
    const priority = riskScore >= 500 ? 'Priorité 1 (Forte)' : riskScore >= 100 ? 'Priorité 2 (Moyenne)' : riskScore >= 10 ? 'Priorité 3 (Modéré)' : 'Priorité 4 (Faible)';
    
    return {
      ...risk,
      gravityValue: gravityValue as 1 | 4 | 20 | 100,
      frequencyValue: frequencyValue as 1 | 4 | 10 | 50,
      controlValue: controlValue as 0.05 | 0.2 | 0.5 | 1,
      riskScore: riskScore,
      priority: priority as 'Priorité 1 (Forte)' | 'Priorité 2 (Moyenne)' | 'Priorité 3 (Modéré)' | 'Priorité 4 (Faible)'
    };
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

    let finalRisks = (existingDoc.finalRisks as Risk[]).map(risk => this.recalculateRiskValues(risk));

    // Gérer les modifications de risques
    if (updates.addRisks) {
      finalRisks = [...finalRisks, ...updates.addRisks.map(risk => this.recalculateRiskValues(risk))];
    }

    if (updates.removeRisks) {
      finalRisks = finalRisks.filter(risk => !updates.removeRisks!.includes(risk.id));
    }

    if (updates.updateRisks) {
      finalRisks = finalRisks.map(risk => {
        const update = updates.updateRisks!.find(u => u.id === risk.id);
        return update ? this.recalculateRiskValues({ ...risk, ...update.updates }) : risk;
      });
    }

    // Remplacer complètement les risques si spécifié
    if (updates.finalRisks) {
      finalRisks = updates.finalRisks.map(risk => this.recalculateRiskValues(risk));
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

  // Uploaded document operations
  async getUploadedDocuments(companyId: number): Promise<UploadedDocument[]> {
    const documents = await db
      .select()
      .from(uploadedDocuments)
      .where(eq(uploadedDocuments.companyId, companyId))
      .orderBy(desc(uploadedDocuments.uploadedAt));
    return documents;
  }

  async createUploadedDocument(data: InsertUploadedDocument): Promise<UploadedDocument> {
    const [document] = await db
      .insert(uploadedDocuments)
      .values(data)
      .returning();
    return document;
  }

  async updateUploadedDocument(id: number, updates: Partial<UploadedDocument>): Promise<UploadedDocument> {
    const [document] = await db
      .update(uploadedDocuments)
      .set(updates)
      .where(eq(uploadedDocuments.id, id))
      .returning();
    
    if (!document) {
      throw new Error(`Uploaded document with id ${id} not found`);
    }
    return document;
  }

  async deleteUploadedDocument(id: number): Promise<void> {
    await db.delete(uploadedDocuments).where(eq(uploadedDocuments.id, id));
  }
}

export const storage = new DatabaseStorage();
