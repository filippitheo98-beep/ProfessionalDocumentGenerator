import { companies, type Company, type InsertCompany, type Location, type WorkUnit, type Risk, type PreventionMeasure } from "@shared/schema";

export interface IStorage {
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<Company>): Promise<Company>;
  generateRisks(workUnitName: string, locationName: string, companyActivity: string): Promise<Risk[]>;
}

export class MemStorage implements IStorage {
  private companies: Map<number, Company>;
  private currentId: number;

  constructor() {
    this.companies = new Map();
    this.currentId = 1;
  }

  async getCompany(id: number): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const id = this.currentId++;
    const company: Company = { ...insertCompany, id };
    this.companies.set(id, company);
    return company;
  }

  async updateCompany(id: number, updates: Partial<Company>): Promise<Company> {
    const existing = this.companies.get(id);
    if (!existing) {
      throw new Error(`Company with id ${id} not found`);
    }
    const updated = { ...existing, ...updates };
    this.companies.set(id, updated);
    return updated;
  }

  async generateRisks(workUnitName: string, locationName: string, companyActivity: string): Promise<Risk[]> {
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

export const storage = new MemStorage();
