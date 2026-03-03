import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isReplitEnv } from "./replitAuth";
import { createUser, createPasswordResetToken, resetPasswordWithToken } from "./localAuth";
import type { RequestHandler } from "express";
import bcrypt from "bcrypt";
import passport from "passport";
import { generateRisksRequestSchema, insertCompanySchema, duerpDocuments, companies, users, riskLibrary, sectors, riskFamilies, customMeasures, type Risk, type Site, type WorkUnit } from "@shared/schema";
import { z } from "zod";
import { generateExcelFile, generatePDFFile, generateWordFile, generateRisksExportExcel } from './exportUtils';
import { db } from "./db";
import { eq, desc, count, lt, ne, sql, ilike, or, and, inArray } from "drizzle-orm";

// Helper function to extract risks from hierarchical structure with full metadata
interface HierarchicalRisk extends Risk {
  siteName?: string;
  workUnitName?: string;
  hierarchyPath?: string;
}

function extractHierarchicalRisks(sites: Site[]): HierarchicalRisk[] {
  const allRisks: HierarchicalRisk[] = [];

  for (const site of sites) {
    for (const risk of (site.risks || []).filter((r: Risk) => r.isValidated)) {
      allRisks.push({
        ...risk,
        siteName: site.name,
        workUnitName: '-',
        hierarchyPath: site.name,
        danger: `[${site.name}] ${risk.danger}`,
        source: site.name
      });
    }

    for (const unit of site.workUnits || []) {
      for (const risk of (unit.risks || []).filter((r: Risk) => r.isValidated)) {
        allRisks.push({
          ...risk,
          siteName: site.name,
          workUnitName: unit.name,
          hierarchyPath: `${site.name} > ${unit.name}`,
          danger: `[${site.name} > ${unit.name}] ${risk.danger}`,
          source: `${site.name} > ${unit.name}`
        });
      }
    }
  }

  return allRisks.sort((a, b) => (a.hierarchyPath || '').localeCompare(b.hierarchyPath || ''));
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth locale : routes publiques (register, login, forgot, reset, logout)
  if (!isReplitEnv) {
    app.post("/api/auth/register", async (req, res) => {
      try {
        const { email, password, firstName, lastName } = req.body;
        if (!email || !password) {
          return res.status(400).json({ message: "Email et mot de passe requis" });
        }
        const user = await createUser({ email, password, firstName, lastName });
        req.login(user, (err) => {
          if (err) return res.status(500).json({ message: "Erreur de session" });
          res.json(user);
        });
      } catch (e) {
        res.status(400).json({ message: e instanceof Error ? e.message : "Erreur" });
      }
    });

    app.post("/api/auth/login", (req, res, next) => {
      passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) return res.status(500).json({ message: "Erreur serveur" });
        if (!user) return res.status(401).json({ message: info?.message || "Identifiants incorrects" });
        req.login(user, (e) => {
          if (e) return res.status(500).json({ message: "Erreur de session" });
          res.json(user);
        });
      })(req, res, next);
    });

    app.get("/api/auth/logout", (req, res) => {
      req.logout(() => res.redirect("/login"));
    });
    app.get("/api/logout", (req, res) => {
      req.logout(() => res.redirect("/login"));
    });

    app.post("/api/auth/forgot-password", async (req, res) => {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email requis" });
      const token = await createPasswordResetToken(email);
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const resetUrl = token ? `${baseUrl}/reset-password?token=${token}` : null;
      if (resetUrl) console.log("[auth] Reset link (dev):", resetUrl);
      res.json({
        message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.",
        resetUrl: process.env.NODE_ENV === "development" && resetUrl ? resetUrl : undefined,
      });
    });

    app.post("/api/auth/reset-password", async (req, res) => {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ message: "Token et mot de passe requis" });
      const ok = await resetPasswordWithToken(token, password);
      if (!ok) return res.status(400).json({ message: "Lien invalide ou expiré" });
      res.json({ message: "Mot de passe réinitialisé" });
    });
  }

  const isAdmin: RequestHandler = (req: any, res, next) => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Accès réservé aux administrateurs" });
    }
    next();
  };

  // Admin routes (auth locale uniquement)
  if (!isReplitEnv) {
    app.get("/api/admin/users", isAuthenticated, isAdmin, async (_req: any, res) => {
      try {
        const all = await db.select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
        }).from(users).orderBy(users.createdAt);
        res.json(all);
      } catch (e) {
        res.status(500).json({ message: "Erreur serveur" });
      }
    });

    app.post("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res) => {
      try {
        const { email, password, firstName, lastName, role } = req.body;
        if (!email || !password) return res.status(400).json({ message: "Email et mot de passe requis" });
        const user = await createUser({ email, password, firstName, lastName, role: role || "user" });
        res.status(201).json(user);
      } catch (e) {
        res.status(400).json({ message: e instanceof Error ? e.message : "Erreur" });
      }
    });

    app.put("/api/admin/users/:id", isAuthenticated, isAdmin, async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        const { role, isActive, firstName, lastName } = req.body;
        const updates: Record<string, unknown> = {};
        if (typeof role === "string") updates.role = role;
        if (typeof isActive === "boolean") updates.isActive = isActive;
        if (typeof firstName === "string") updates.firstName = firstName;
        if (typeof lastName === "string") updates.lastName = lastName;
        const [u] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
        if (!u) return res.status(404).json({ message: "Utilisateur introuvable" });
        res.json({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role, isActive: u.isActive });
      } catch (e) {
        res.status(500).json({ message: "Erreur serveur" });
      }
    });

    app.post("/api/admin/users/:id/reset-password", isAuthenticated, isAdmin, async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        const { password } = req.body;
        if (!password || password.length < 6) return res.status(400).json({ message: "Mot de passe requis (min. 6 caractères)" });
        const [u] = await db.select().from(users).where(eq(users.id, id));
        if (!u) return res.status(404).json({ message: "Utilisateur introuvable" });
        const passwordHash = await bcrypt.hash(password, 12);
        await db.update(users).set({ passwordHash }).where(eq(users.id, id));
        res.json({ message: "Mot de passe réinitialisé" });
      } catch (e) {
        res.status(500).json({ message: "Erreur serveur" });
      }
    });
  }

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      if (!isReplitEnv) {
        return res.json(req.user);
      }

      const userClaims = req.user?.claims;
      if (!userClaims) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = {
        id: userClaims.sub,
        email: userClaims.email,
        firstName: userClaims.first_name,
        lastName: userClaims.last_name,
        profileImageUrl: userClaims.profile_image_url,
      };
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/stats', isAuthenticated, async (req: any, res) => {
    try {
      let companiesCount = { count: 0 };
      let documentsCount = { count: 0 };
      if (!isReplitEnv && req.user?.id) {
        const userCompanies = await storage.getCompaniesByOwner(req.user.id);
        const ids = userCompanies.map((c: { id: number }) => c.id);
        if (ids.length > 0) {
          const [cc] = await db.select({ count: count() }).from(companies).where(eq(companies.ownerId, req.user.id));
          const [dc] = await db.select({ count: count() }).from(duerpDocuments).where(inArray(duerpDocuments.companyId, ids));
          companiesCount = cc || { count: 0 };
          documentsCount = dc || { count: 0 };
        }
      } else {
        const [cc] = await db.select({ count: count() }).from(companies);
        const [dc] = await db.select({ count: count() }).from(duerpDocuments);
        companiesCount = cc || { count: 0 };
        documentsCount = dc || { count: 0 };
      }
      
      const stats = {
        totalCompanies: companiesCount?.count || 0,
        totalDocuments: documentsCount?.count || 0,
        pendingActions: 0,
        expiringSoon: 0,
        completedActions: 0,
        riskScore: 0,
      };
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get('/api/dashboard/activity', isAuthenticated, async (req: any, res) => {
    try {
      let activities;
      if (!isReplitEnv && req.user?.id) {
        const userCompanies = await storage.getCompaniesByOwner(req.user.id);
        const ids = userCompanies.map((c: { id: number }) => c.id);
        if (ids.length === 0) {
          activities = [];
        } else {
          activities = await db
            .select({
              id: duerpDocuments.id,
              title: duerpDocuments.title,
              companyName: companies.name,
              timestamp: duerpDocuments.updatedAt
            })
            .from(duerpDocuments)
            .leftJoin(companies, eq(duerpDocuments.companyId, companies.id))
            .where(inArray(duerpDocuments.companyId, ids))
            .orderBy(desc(duerpDocuments.updatedAt))
            .limit(5);
        }
      } else {
        activities = await db
          .select({
            id: duerpDocuments.id,
            title: duerpDocuments.title,
            companyName: companies.name,
            timestamp: duerpDocuments.updatedAt
          })
          .from(duerpDocuments)
          .leftJoin(companies, eq(duerpDocuments.companyId, companies.id))
          .orderBy(desc(duerpDocuments.updatedAt))
          .limit(5);
      }
      
      const formattedActivities = activities.map(activity => ({
        id: activity.id.toString(),
        type: "document_created",
        title: activity.title,
        description: `Document pour l'entreprise ${activity.companyName}`,
        timestamp: activity.timestamp ? new Date(activity.timestamp).toLocaleDateString() : "Récemment",
        priority: "medium"
      }));
      
      res.json(formattedActivities);
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  app.get('/api/documents/expiring', isAuthenticated, async (req: any, res) => {
    try {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      let expiring;
      if (!isReplitEnv && req.user?.id) {
        const userCompanies = await storage.getCompaniesByOwner(req.user.id);
        const ids = userCompanies.map((c: { id: number }) => c.id);
        if (ids.length === 0) expiring = [];
        else {
          expiring = await db
            .select({
              id: duerpDocuments.id,
              companyName: companies.name,
              nextReviewDate: duerpDocuments.nextReviewDate
            })
            .from(duerpDocuments)
            .leftJoin(companies, eq(duerpDocuments.companyId, companies.id))
            .where(and(lt(duerpDocuments.nextReviewDate, thirtyDaysFromNow), inArray(duerpDocuments.companyId, ids)))
            .orderBy(duerpDocuments.nextReviewDate);
        }
      } else {
        expiring = await db
          .select({
            id: duerpDocuments.id,
            companyName: companies.name,
            nextReviewDate: duerpDocuments.nextReviewDate
          })
          .from(duerpDocuments)
          .leftJoin(companies, eq(duerpDocuments.companyId, companies.id))
          .where(lt(duerpDocuments.nextReviewDate, thirtyDaysFromNow))
          .orderBy(duerpDocuments.nextReviewDate);
      }
      
      res.json(expiring);
    } catch (error) {
      console.error("Error fetching expiring documents:", error);
      res.status(500).json({ message: "Failed to fetch expiring documents" });
    }
  });
  // List companies (pour l'utilisateur connecté en mode local)
  if (!isReplitEnv) {
    app.get("/api/companies", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Non authentifié" });
        const list = await storage.getCompaniesByOwner(userId);
        res.json(list);
      } catch (error) {
        res.status(500).json({ message: "Erreur lors de la récupération des entreprises" });
      }
    });
  }

  // Create or get company
  app.post("/api/companies", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertCompanySchema.parse(req.body);
      const ownerId = !isReplitEnv ? req.user?.id : undefined;
      const company = await storage.createCompany({ ...validatedData, ownerId: ownerId ?? undefined });
      res.json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(400).json({ 
        message: error instanceof z.ZodError ? "Données invalides" : "Erreur lors de la création de l'entreprise" 
      });
    }
  });

  // Helper: vérifier qu'une company appartient à l'utilisateur (hors Replit)
  function canAccessCompany(company: { ownerId: number | null } | undefined, userId: number | undefined): boolean {
    if (isReplitEnv) return true;
    if (!company || userId == null) return false;
    return company.ownerId === userId;
  }

  // Get company by ID
  app.get("/api/companies/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.getCompany(id);
      if (!company) {
        res.status(404).json({ message: "Entreprise non trouvée" });
        return;
      }
      if (!canAccessCompany(company, req.user?.id)) {
        return res.status(403).json({ message: "Accès refusé" });
      }
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération de l'entreprise" });
    }
  });

  // Update company
  app.put("/api/companies/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.getCompany(id);
      if (!company) return res.status(404).json({ message: "Entreprise non trouvée" });
      if (!canAccessCompany(company, req.user?.id)) return res.status(403).json({ message: "Accès refusé" });
      const updates = req.body;
      const updated = await storage.updateCompany(id, updates);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: "Erreur lors de la mise à jour de l'entreprise" });
    }
  });

  // Uploaded documents for AI context
  app.get("/api/companies/:companyId/documents", isAuthenticated, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const company = await storage.getCompany(companyId);
      if (!company || !canAccessCompany(company, req.user?.id)) return res.status(403).json({ message: "Accès refusé" });
      const documents = await storage.getUploadedDocuments(companyId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching uploaded documents:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des documents" });
    }
  });

  app.post("/api/companies/:companyId/documents", isAuthenticated, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const company = await storage.getCompany(companyId);
      if (!company || !canAccessCompany(company, req.user?.id)) return res.status(403).json({ message: "Accès refusé" });
      const { fileName, fileType, fileSize, extractedText, description } = req.body;
      
      const document = await storage.createUploadedDocument({
        companyId,
        fileName,
        fileType,
        fileSize,
        extractedText,
        description,
      });
      
      res.json(document);
    } catch (error) {
      console.error("Error creating uploaded document:", error);
      res.status(500).json({ message: "Erreur lors de l'ajout du document" });
    }
  });

  app.patch("/api/companies/:companyId/documents/:documentId", isAuthenticated, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const company = await storage.getCompany(companyId);
      if (!company || !canAccessCompany(company, req.user?.id)) return res.status(403).json({ message: "Accès refusé" });
      const documentId = parseInt(req.params.documentId);
      const { description } = req.body;
      const document = await storage.updateUploadedDocument(documentId, { description });
      res.json(document);
    } catch (error) {
      console.error("Error updating uploaded document:", error);
      res.status(500).json({ message: "Erreur lors de la mise à jour du document" });
    }
  });

  app.delete("/api/companies/:companyId/documents/:documentId", isAuthenticated, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const company = await storage.getCompany(companyId);
      if (!company || !canAccessCompany(company, req.user?.id)) return res.status(403).json({ message: "Accès refusé" });
      const documentId = parseInt(req.params.documentId);
      await storage.deleteUploadedDocument(documentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting uploaded document:", error);
      res.status(500).json({ message: "Erreur lors de la suppression du document" });
    }
  });

  // Generate risks for a work unit
  app.post("/api/generate-risks", async (req, res) => {
    try {
      const validatedData = generateRisksRequestSchema.parse(req.body);
      
      // Build full context including uploaded documents
      let fullDescription = validatedData.companyDescription || '';
      
      // Add uploaded documents context if company ID is provided
      if (validatedData.companyId) {
        const uploadedDocs = await storage.getUploadedDocuments(validatedData.companyId);
        if (uploadedDocs.length > 0) {
          const docsContext = uploadedDocs.map(doc => {
            let context = `\n\n--- Document de référence: ${doc.fileName} ---`;
            if (doc.description) {
              context += `\nDescription: ${doc.description}`;
            }
            if (doc.extractedText) {
              context += `\nContenu: ${doc.extractedText}`;
            }
            return context;
          }).join('');
          
          fullDescription += `\n\n=== DOCUMENTS DE RÉFÉRENCE ===` + docsContext;
        }
      }
      
      // Also add any explicitly passed document context
      if (validatedData.uploadedDocumentsContext) {
        fullDescription += `\n\n${validatedData.uploadedDocumentsContext}`;
      }
      
      const risks = await storage.generateRisks(
        validatedData.workUnitName,
        validatedData.locationName,
        validatedData.companyActivity,
        fullDescription || undefined
      );
      res.json({ risks });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('OPENAI_API_KEY')) {
        return res.status(503).json({ message: msg });
      }
      res.status(400).json({ 
        message: error instanceof z.ZodError ? "Données invalides" : "Erreur lors de la génération des risques" 
      });
    }
  });

  // Generate hierarchical risks for specific level (Site, Zone, Unité, Activité)
  app.post("/api/generate-hierarchical-risks", async (req, res) => {
    try {
      const { level, elementName, elementDescription, companyActivity, companyDescription, companyId, siteName, workstationNames, inheritedRisks, uploadedDocumentsContext } = req.body;
      
      if (!level || !elementName || !companyActivity) {
        return res.status(400).json({ message: "Level, element name, and company activity are required" });
      }

      // Build hierarchical context for AI
      let context = companyDescription || '';
      
      // Add hierarchical path context
      let hierarchyContext = `\nNiveau hiérarchique: ${level}`;
      if (siteName) hierarchyContext += `\nSite: ${siteName}`;
      if (level === 'Unité') {
        hierarchyContext += `\nUnité de travail: ${elementName}`;
        if (workstationNames && workstationNames.length > 0) {
          hierarchyContext += `\nPostes de travail inclus: ${workstationNames.join(', ')}`;
        }
      }
      
      context += hierarchyContext;
      
      // Add inherited risks context
      if (inheritedRisks && inheritedRisks.length > 0) {
        context += `\n\n=== RISQUES HÉRITÉS DU NIVEAU SUPÉRIEUR ===`;
        inheritedRisks.forEach((risk: { type: string; danger: string }) => {
          context += `\n- ${risk.type}: ${risk.danger}`;
        });
      }
      
      // Add uploaded documents context
      if (companyId) {
        const uploadedDocs = await storage.getUploadedDocuments(companyId);
        if (uploadedDocs.length > 0) {
          const docsContext = uploadedDocs.map(doc => {
            let docCtx = `\n\n--- Document: ${doc.fileName} ---`;
            if (doc.extractedText) docCtx += `\n${doc.extractedText}`;
            return docCtx;
          }).join('');
          context += `\n\n=== DOCUMENTS DE RÉFÉRENCE ===${docsContext}`;
        }
      }
      
      if (uploadedDocumentsContext) {
        context += `\n\n${uploadedDocumentsContext}`;
      }

      const risks = await storage.generateHierarchicalRisks(
        level,
        elementName,
        elementDescription || '',
        companyActivity,
        context
      );
      
      res.json({ risks });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('OPENAI_API_KEY')) {
        return res.status(503).json({ message: msg });
      }
      console.error("Error generating hierarchical risks:", error);
      res.status(500).json({ 
        message: "Erreur lors de la génération des risques" 
      });
    }
  });

  // Group workstations into work units using AI
  app.post("/api/group-workstations", async (req, res) => {
    try {
      const { workstations, companyActivity, companyDescription, siteName } = req.body;
      
      if (!workstations || workstations.length === 0 || !companyActivity) {
        return res.status(400).json({ message: "Workstations and company activity are required" });
      }

      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        return res.status(503).json({
          message: "OPENAI_API_KEY non configurée. Ajoutez-la dans .env ou dans les variables d'environnement (ex. Railway) pour activer le regroupement par IA."
        });
      }
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey });

      const prompt = `Tu es un expert en santé et sécurité au travail. Tu dois regrouper intelligemment des postes de travail en unités de travail cohérentes pour un DUERP.

Contexte:
- Activité de l'entreprise: ${companyActivity}
${companyDescription ? `- Description: ${companyDescription}` : ''}
${siteName ? `- Site: ${siteName}` : ''}

Postes de travail à regrouper:
${workstations.map((ws: string, i: number) => `${i + 1}. ${ws}`).join('\n')}

Règles de regroupement:
1. Regrouper les postes qui partagent des risques similaires ou un environnement de travail commun
2. Chaque unité de travail doit avoir un nom clair et descriptif
3. Un poste peut appartenir à une seule unité
4. Si un poste est très spécifique, il peut constituer sa propre unité
5. Créer entre 2 et ${Math.max(3, Math.ceil(workstations.length / 2))} unités de travail

Réponds en JSON valide: { "groups": [{ "name": "Nom de l'unité", "workstations": ["poste1", "poste2"] }] }`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Expert en prévention des risques professionnels français. Réponses conformes aux exigences DUERP. JSON uniquement." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: 2000
      });

      const result = JSON.parse(response.choices[0].message.content || '{"groups": []}');
      res.json(result);
    } catch (error) {
      console.error("Error grouping workstations:", error);
      res.status(500).json({ message: "Erreur lors du regroupement des postes" });
    }
  });

  // Generate prevention recommendations
  app.post("/api/generate-prevention-recommendations", async (req, res) => {
    try {
      const { companyActivity, risks, locations, workStations } = req.body;
      
      if (!companyActivity || !risks) {
        return res.status(400).json({ message: "Company activity and risks are required" });
      }

      const recommendations = await storage.generatePreventionRecommendations(
        companyActivity,
        risks,
        locations,
        workStations
      );
      
      res.json({ recommendations });
    } catch (error) {
      console.error("Error generating prevention recommendations:", error);
      res.status(500).json({ 
        message: "Erreur lors de la génération des recommandations de prévention" 
      });
    }
  });

  // DUERP Documents API
  app.get('/api/duerp/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const company = await storage.getCompany(companyId);
      if (!company || !canAccessCompany(company, req.user?.id)) return res.status(403).json({ message: "Accès refusé" });
      const documents = await storage.getDuerpDocuments(companyId);
      res.json(documents);
    } catch (error) {
      console.error('Error fetching DUERP documents:', error);
      res.status(500).json({ message: 'Failed to fetch documents' });
    }
  });

  app.post('/api/duerp/save', isAuthenticated, async (req: any, res) => {
    try {
      const { companyId, title, workUnitsData, sites, locations, workStations, finalRisks, preventionMeasures } = req.body;
      console.log(`[SAVE POST] companyId=${companyId} title=${title} workUnitsData=${(workUnitsData||[]).length} finalRisks=${(finalRisks||[]).length}`);
      
      if (!companyId || !title) {
        return res.status(400).json({ message: 'Company ID and title are required' });
      }
      const company = await storage.getCompany(companyId);
      if (!company || !canAccessCompany(company, req.user?.id)) return res.status(403).json({ message: "Accès refusé" });

      const document = await storage.createDuerpDocument({
        companyId,
        title,
        workUnitsData: workUnitsData || [],
        sites: sites || [],
        locations: locations || [],
        workStations: workStations || [],
        finalRisks: finalRisks || [],
        preventionMeasures: preventionMeasures || []
      });
      
      res.json(document);
    } catch (error) {
      console.error('Error saving DUERP document:', error);
      
      // Vérifier si c'est une erreur d'unicité du nom
      if (error.message.includes("existe déjà")) {
        return res.status(409).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Failed to save document' });
    }
  });

  app.get('/api/duerp/document/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const documents = await db
        .select()
        .from(duerpDocuments)
        .leftJoin(companies, eq(duerpDocuments.companyId, companies.id))
        .where(eq(duerpDocuments.id, id));
      
      if (!documents.length) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      const document = documents[0];
      // Drizzle join result uses table variable names: duerpDocuments, companies (not SQL names)
      const docRow = document.duerpDocuments ?? (document as any).duerp_documents;
      const companyRow = document.companies;
      if (!canAccessCompany(companyRow, req.user?.id)) return res.status(403).json({ message: "Accès refusé" });
      const docData = { ...docRow, company: companyRow };
      
      // Recalculer les valeurs numériques et la priorité pour tous les risques
      if (docData.finalRisks) {
        docData.finalRisks = (docData.finalRisks as Risk[]).map(risk => {
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
        });
      }
      
      res.json(docData);
    } catch (error) {
      console.error('Error fetching DUERP document:', error);
      res.status(500).json({ message: 'Failed to fetch document' });
    }
  });

  app.put('/api/duerp/document/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title, workUnitsData, sites, locations, workStations, finalRisks, preventionMeasures } = req.body;
      console.log(`[SAVE PUT] id=${id} workUnitsData=${(workUnitsData||[]).length} finalRisks=${(finalRisks||[]).length} sites=${(sites||[]).length}`);
      
      const [updatedDocument] = await db
        .update(duerpDocuments)
        .set({
          title,
          workUnitsData: workUnitsData || [],
          sites: sites || [],
          locations,
          workStations,
          finalRisks,
          preventionMeasures,
          updatedAt: new Date()
        })
        .where(eq(duerpDocuments.id, id))
        .returning();
      
      if (!updatedDocument) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      res.json(updatedDocument);
    } catch (error) {
      console.error('Error updating DUERP document:', error);
      res.status(500).json({ message: 'Failed to update document' });
    }
  });

  // Archive document
  app.post('/api/duerp-documents/:id/archive', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const [archivedDocument] = await db
        .update(duerpDocuments)
        .set({
          status: 'archived',
          updatedAt: new Date()
        })
        .where(eq(duerpDocuments.id, id))
        .returning();
      
      if (!archivedDocument) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      res.json(archivedDocument);
    } catch (error) {
      console.error('Error archiving DUERP document:', error);
      res.status(500).json({ message: 'Failed to archive document' });
    }
  });

  // Unarchive document
  app.post('/api/duerp-documents/:id/unarchive', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const [unarchivedDocument] = await db
        .update(duerpDocuments)
        .set({
          status: 'active',
          updatedAt: new Date()
        })
        .where(eq(duerpDocuments.id, id))
        .returning();
      
      if (!unarchivedDocument) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      res.json(unarchivedDocument);
    } catch (error) {
      console.error('Error unarchiving document:', error);
      res.status(500).json({ message: 'Failed to unarchive document' });
    }
  });

  // Get archived documents
  app.get('/api/archived-documents', async (req, res) => {
    try {
      const documents = await db
        .select({
          id: duerpDocuments.id,
          title: duerpDocuments.title,
          companyName: companies.name,
          createdAt: duerpDocuments.createdAt,
          archivedAt: duerpDocuments.updatedAt,
          status: duerpDocuments.status,
          riskCount: duerpDocuments.finalRisks
        })
        .from(duerpDocuments)
        .leftJoin(companies, eq(duerpDocuments.companyId, companies.id))
        .where(eq(duerpDocuments.status, 'archived'))
        .orderBy(desc(duerpDocuments.updatedAt));
      
      // Calculate risk count on server side
      const documentsWithRiskCount = documents.map(doc => ({
        ...doc,
        riskCount: Array.isArray(doc.riskCount) ? doc.riskCount.length : 0
      }));
      
      res.json(documentsWithRiskCount);
    } catch (error) {
      console.error('Error fetching archived documents:', error);
      res.status(500).json({ message: 'Failed to fetch archived documents' });
    }
  });

  // Delete document permanently
  app.delete('/api/duerp-documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!isReplitEnv && req.user?.id) {
        const doc = await storage.getDuerpDocumentById(id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const company = await storage.getCompany(doc.companyId);
        if (!company || !canAccessCompany(company, req.user.id)) {
          return res.status(403).json({ error: "Accès non autorisé" });
        }
      }
      
      const [deletedDocument] = await db
        .delete(duerpDocuments)
        .where(eq(duerpDocuments.id, id))
        .returning();
      
      if (!deletedDocument) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting document:', error);
      res.status(500).json({ message: 'Failed to delete document' });
    }
  });



  // Export to Excel endpoint
  app.post('/api/export/excel', async (req, res) => {
    try {
      const { risks, companyName } = req.body;
      
      if (!risks || !Array.isArray(risks)) {
        return res.status(400).json({ message: 'Risks data is required' });
      }

      const excelBuffer = await generateExcelFile(risks, companyName);
      const fileName = `DUERP_${companyName || 'Export'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(excelBuffer);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      res.status(500).json({ message: 'Failed to export to Excel' });
    }
  });

  // Export to Word endpoint
  app.post('/api/export/word', async (req, res) => {
    try {
      const { risks, companyName, companyActivity, companyData, locations, workStations, preventionMeasures } = req.body;
      
      if (!risks || !Array.isArray(risks)) {
        return res.status(400).json({ message: 'Risks data is required' });
      }

      const wordBuffer = await generateWordFile(
        risks, 
        companyName, 
        companyActivity, 
        companyData,
        locations || [],
        workStations || [],
        preventionMeasures || []
      );
      const fileName = `DUERP_${companyName || 'Export'}_${new Date().toISOString().split('T')[0]}.docx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(wordBuffer);
      
    } catch (error) {
      console.error('Error exporting to Word:', error);
      res.status(500).json({ message: 'Failed to export to Word' });
    }
  });

  // Export hierarchical Excel
  app.post('/api/export/excel-hierarchical', async (req, res) => {
    try {
      const { sites, companyName, companyActivity } = req.body;
      
      if (!sites || !Array.isArray(sites)) {
        return res.status(400).json({ message: 'Sites data is required' });
      }

      // Extract all risks from hierarchical structure
      const flattenedRisks = extractHierarchicalRisks(sites);
      
      const excelBuffer = await generateExcelFile(flattenedRisks, companyName);
      const fileName = `DUERP_${companyName || 'Export'}_Hierarchique_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(excelBuffer);
      
    } catch (error) {
      console.error('Error exporting hierarchical Excel:', error);
      res.status(500).json({ message: 'Failed to export hierarchical Excel' });
    }
  });

  // Export hierarchical Word
  app.post('/api/export/word-hierarchical', async (req, res) => {
    try {
      const { sites, companyName, companyActivity, preventionMeasures } = req.body;
      
      if (!sites || !Array.isArray(sites)) {
        return res.status(400).json({ message: 'Sites data is required' });
      }

      // Extract all risks from hierarchical structure
      const flattenedRisks = extractHierarchicalRisks(sites);
      
      const wordBuffer = await generateWordFile(
        flattenedRisks, 
        companyName, 
        companyActivity, 
        {},
        [],
        [],
        preventionMeasures || []
      );
      const fileName = `DUERP_${companyName || 'Export'}_Hierarchique_${new Date().toISOString().split('T')[0]}.docx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(wordBuffer);
      
    } catch (error) {
      console.error('Error exporting hierarchical Word:', error);
      res.status(500).json({ message: 'Failed to export hierarchical Word' });
    }
  });

  // Generate unique document title
  app.post('/api/duerp/generate-title', async (req, res) => {
    try {
      const { baseTitle } = req.body;
      
      if (!baseTitle) {
        return res.status(400).json({ message: 'Base title is required' });
      }

      const uniqueTitle = await storage.generateUniqueDocumentTitle(baseTitle);
      res.json({ title: uniqueTitle });
    } catch (error) {
      console.error('Error generating unique title:', error);
      res.status(500).json({ message: 'Failed to generate unique title' });
    }
  });

  // Update document partially (selective updates)
  app.put('/api/duerp/document/:id/partial', async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const { 
        title, 
        locations, 
        workStations, 
        finalRisks, 
        preventionMeasures,
        addRisks,
        removeRisks,
        updateRisks
      } = req.body;

      const document = await storage.updateDuerpDocumentPartial(documentId, {
        title,
        locations,
        workStations,
        finalRisks,
        preventionMeasures,
        addRisks,
        removeRisks,
        updateRisks
      });

      res.json(document);
    } catch (error) {
      console.error('Error updating document partially:', error);
      res.status(500).json({ message: error.message || 'Failed to update document' });
    }
  });

  // Add risks to existing document
  app.post('/api/duerp/document/:id/risks', async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const { risks } = req.body;

      if (!risks || !Array.isArray(risks)) {
        return res.status(400).json({ message: 'Risks array is required' });
      }

      const document = await storage.updateDuerpDocumentPartial(documentId, {
        addRisks: risks
      });

      res.json(document);
    } catch (error) {
      console.error('Error adding risks to document:', error);
      res.status(500).json({ message: error.message || 'Failed to add risks' });
    }
  });

  // Remove risks from existing document
  app.delete('/api/duerp/document/:id/risks', async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const { riskIds } = req.body;

      if (!riskIds || !Array.isArray(riskIds)) {
        return res.status(400).json({ message: 'Risk IDs array is required' });
      }

      const document = await storage.updateDuerpDocumentPartial(documentId, {
        removeRisks: riskIds
      });

      res.json(document);
    } catch (error) {
      console.error('Error removing risks from document:', error);
      res.status(500).json({ message: error.message || 'Failed to remove risks' });
    }
  });

  // Export risks to Excel (GET, document-based)
  app.get('/api/duerp/document/:id/risks/export.xlsx', async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const { risks, documentId: docId } = await storage.getRisksForExport(documentId);
      const buffer = await generateRisksExportExcel(risks, docId);
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `duerp_risques_${docId}_${dateStr}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error('Error exporting risks to Excel:', error);
      if (error.message?.includes('non trouvé')) {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: 'Erreur lors de l\'export Excel' });
    }
  });

  // Update specific risks in existing document
  app.put('/api/duerp/document/:id/risks', async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const { updates } = req.body;

      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ message: 'Updates array is required' });
      }

      const document = await storage.updateDuerpDocumentPartial(documentId, {
        updateRisks: updates
      });

      res.json(document);
    } catch (error) {
      console.error('Error updating risks in document:', error);
      res.status(500).json({ message: error.message || 'Failed to update risks' });
    }
  });

  app.post("/api/duerp-documents/:id/finalize", async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const now = new Date();
      const nextReview = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

      const [updated] = await db
        .update(duerpDocuments)
        .set({
          status: 'active',
          lastRevisionDate: now,
          nextReviewDate: nextReview,
          revisionNotified: false,
          updatedAt: now,
        })
        .where(eq(duerpDocuments.id, documentId))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: 'Document non trouvé' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error finalizing document:', error);
      res.status(500).json({ message: 'Failed to finalize document' });
    }
  });

  app.post("/api/duerp-documents/:id/annual-update", async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const now = new Date();
      const nextReview = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

      const [updated] = await db
        .update(duerpDocuments)
        .set({
          status: 'active',
          lastRevisionDate: now,
          nextReviewDate: nextReview,
          revisionNotified: false,
          updatedAt: now,
          version: sql`CAST(CAST(COALESCE(${duerpDocuments.version}, '1.0') AS DECIMAL) + 1.0 AS TEXT)`,
        })
        .where(eq(duerpDocuments.id, documentId))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: 'Document non trouvé' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error performing annual update:', error);
      res.status(500).json({ message: 'Failed to perform annual update' });
    }
  });

  // Revision tracking routes
  app.get("/api/revisions/needed", isAuthenticated, async (req: any, res) => {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      let documents;
      if (!isReplitEnv && req.user?.id) {
        const userCompanies = await storage.getCompaniesByOwner(req.user.id);
        const ids = userCompanies.map((c: { id: number }) => c.id);
        if (ids.length === 0) documents = [];
        else {
          documents = await db
            .select({
              id: duerpDocuments.id,
              title: duerpDocuments.title,
              companyName: companies.name,
              nextReviewDate: duerpDocuments.nextReviewDate,
              status: duerpDocuments.status,
              createdAt: duerpDocuments.createdAt,
              updatedAt: duerpDocuments.updatedAt
            })
            .from(duerpDocuments)
            .leftJoin(companies, eq(duerpDocuments.companyId, companies.id))
            .where(and(ne(duerpDocuments.status, 'archived'), inArray(duerpDocuments.companyId, ids)));
        }
      } else {
        documents = await db
          .select({
            id: duerpDocuments.id,
            title: duerpDocuments.title,
            companyName: companies.name,
            nextReviewDate: duerpDocuments.nextReviewDate,
            status: duerpDocuments.status,
            createdAt: duerpDocuments.createdAt,
            updatedAt: duerpDocuments.updatedAt
          })
          .from(duerpDocuments)
          .leftJoin(companies, eq(duerpDocuments.companyId, companies.id))
          .where(ne(duerpDocuments.status, 'archived'));
      }

      // Filter and categorize documents
      const overdue = [];
      const dueSoon = [];
      const upToDate = [];
      
      documents.forEach(doc => {
        if (doc.nextReviewDate) {
          const reviewDate = new Date(doc.nextReviewDate);
          if (reviewDate < today) {
            overdue.push(doc);
          } else if (reviewDate <= thirtyDaysFromNow) {
            dueSoon.push(doc);
          } else {
            upToDate.push(doc);
          }
        } else {
          // If no review date, consider it needing revision after 1 year
          const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
          const docDate = new Date(doc.createdAt || doc.updatedAt || '');
          if (docDate < oneYearAgo) {
            overdue.push(doc);
          } else {
            upToDate.push(doc);
          }
        }
      });

      res.json({
        overdue,
        dueSoon,
        upToDate,
        stats: {
          overdue: overdue.length,
          dueSoon: dueSoon.length,
          upToDate: upToDate.length,
          total: documents.length
        }
      });
    } catch (error) {
      console.error('Error fetching documents needing revision:', error);
      res.status(500).json({ error: "Failed to fetch documents needing revision" });
    }
  });

  app.get("/api/revisions/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      let documents;
      if (!isReplitEnv && req.user?.id) {
        const userCompanies = await storage.getCompaniesByOwner(req.user.id);
        const ids = userCompanies.map((c: { id: number }) => c.id);
        if (ids.length === 0) documents = [];
        else {
          documents = await db
            .select({
              id: duerpDocuments.id,
              title: duerpDocuments.title,
              companyName: companies.name,
              nextReviewDate: duerpDocuments.nextReviewDate
            })
            .from(duerpDocuments)
            .leftJoin(companies, eq(duerpDocuments.companyId, companies.id))
            .where(and(ne(duerpDocuments.status, 'archived'), inArray(duerpDocuments.companyId, ids)));
        }
      } else {
        documents = await db
          .select({
            id: duerpDocuments.id,
            title: duerpDocuments.title,
            companyName: companies.name,
            nextReviewDate: duerpDocuments.nextReviewDate
          })
          .from(duerpDocuments)
          .leftJoin(companies, eq(duerpDocuments.companyId, companies.id))
          .where(ne(duerpDocuments.status, 'archived'));
      }

      const notifications = documents.filter((doc: { nextReviewDate: string | null }) => {
        if (!doc.nextReviewDate) return false;
        const reviewDate = new Date(doc.nextReviewDate);
        return reviewDate <= thirtyDaysFromNow && reviewDate >= today;
      });

      res.json(notifications);
    } catch (error) {
      console.error('Error fetching documents needing notification:', error);
      res.status(500).json({ error: "Failed to fetch documents needing notification" });
    }
  });

  app.post("/api/revisions/:id/notify", isAuthenticated, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      if (!isReplitEnv && req.user?.id) {
        const doc = await storage.getDuerpDocumentById(documentId);
        if (!doc) return res.status(404).json({ error: "Document introuvable" });
        const company = await storage.getCompany(doc.companyId);
        if (!company || !canAccessCompany(company, req.user.id)) {
          return res.status(403).json({ error: "Accès non autorisé" });
        }
      }
      await storage.markRevisionNotified(documentId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking revision as notified:', error);
      res.status(500).json({ error: "Failed to mark revision as notified" });
    }
  });

  app.post("/api/revisions/:id/update", isAuthenticated, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      if (!isReplitEnv && req.user?.id) {
        const doc = await storage.getDuerpDocumentById(documentId);
        if (!doc) return res.status(404).json({ error: "Document introuvable" });
        const company = await storage.getCompany(doc.companyId);
        if (!company || !canAccessCompany(company, req.user.id)) {
          return res.status(403).json({ error: "Accès non autorisé" });
        }
      }
      const document = await storage.updateRevisionDate(documentId);
      res.json(document);
    } catch (error) {
      console.error('Error updating revision date:', error);
      res.status(500).json({ error: "Failed to update revision date" });
    }
  });

  // Documents API (non-archived)
  app.get('/api/documents', isAuthenticated, async (req: any, res) => {
    try {
      let documents;
      if (!isReplitEnv && req.user?.id) {
        const userCompanies = await storage.getCompaniesByOwner(req.user.id);
        const ids = userCompanies.map((c: { id: number }) => c.id);
        if (ids.length === 0) documents = [];
        else {
          documents = await db
            .select({
              id: duerpDocuments.id,
              companyName: companies.name,
              title: duerpDocuments.title,
              createdAt: duerpDocuments.createdAt,
              updatedAt: duerpDocuments.updatedAt,
              status: duerpDocuments.status,
              nextReviewDate: duerpDocuments.nextReviewDate,
              riskCount: duerpDocuments.finalRisks
            })
            .from(duerpDocuments)
            .leftJoin(companies, eq(duerpDocuments.companyId, companies.id))
            .where(and(ne(duerpDocuments.status, 'archived'), inArray(duerpDocuments.companyId, ids)))
            .orderBy(desc(duerpDocuments.updatedAt));
        }
      } else {
        documents = await db
          .select({
            id: duerpDocuments.id,
            companyName: companies.name,
            title: duerpDocuments.title,
            createdAt: duerpDocuments.createdAt,
            updatedAt: duerpDocuments.updatedAt,
            status: duerpDocuments.status,
            nextReviewDate: duerpDocuments.nextReviewDate,
            riskCount: duerpDocuments.finalRisks
          })
          .from(duerpDocuments)
          .leftJoin(companies, eq(duerpDocuments.companyId, companies.id))
          .where(ne(duerpDocuments.status, 'archived'))
          .orderBy(desc(duerpDocuments.updatedAt));
      }
      
      const formattedDocuments = documents.map(doc => ({
        ...doc,
        riskCount: Array.isArray(doc.riskCount) ? doc.riskCount.length : 0
      }));
      
      res.json(formattedDocuments);
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ message: 'Failed to fetch documents' });
    }
  });

  // Collaborators API
  app.get('/api/collaborators', (req, res) => {
    res.json([]);
  });

  app.post('/api/collaborators/invite', (req, res) => {
    const { email, role } = req.body;
    res.json({ 
      success: true, 
      message: 'Invitation envoyée',
      invitedEmail: email,
      role: role
    });
  });

  // Reports API
  app.get('/api/reports/:period?', isAuthenticated, async (req: any, res) => {
    try {
      const period = req.params.period || 'month';
      
      let documents;
      if (!isReplitEnv && req.user?.id) {
        const userCompanies = await storage.getCompaniesByOwner(req.user.id);
        const ids = userCompanies.map((c: { id: number }) => c.id);
        if (ids.length === 0) documents = [];
        else {
          documents = await db
            .select({
              id: duerpDocuments.id,
              title: duerpDocuments.title,
              companyName: companies.name,
              finalRisks: duerpDocuments.finalRisks,
              createdAt: duerpDocuments.createdAt,
              updatedAt: duerpDocuments.updatedAt,
              status: duerpDocuments.status
            })
            .from(duerpDocuments)
            .leftJoin(companies, eq(duerpDocuments.companyId, companies.id))
            .where(and(ne(duerpDocuments.status, 'archived'), inArray(duerpDocuments.companyId, ids)));
        }
      } else {
        documents = await db
          .select({
            id: duerpDocuments.id,
            title: duerpDocuments.title,
            companyName: companies.name,
            finalRisks: duerpDocuments.finalRisks,
            createdAt: duerpDocuments.createdAt,
            updatedAt: duerpDocuments.updatedAt,
            status: duerpDocuments.status
          })
          .from(duerpDocuments)
          .leftJoin(companies, eq(duerpDocuments.companyId, companies.id))
          .where(ne(duerpDocuments.status, 'archived'));
      }

      // Calculate real statistics from actual risks
      let totalRisks = 0;
      let highRisks = 0;
      let mediumRisks = 0;
      let lowRisks = 0;
      const risksByCategory: { [key: string]: number } = {};
      
      documents.forEach(doc => {
        if (Array.isArray(doc.finalRisks)) {
          doc.finalRisks.forEach((risk: any) => {
            totalRisks++;
            
            // Count by priority
            if (risk.priority === 'Priorité 1 (Forte)') {
              highRisks++;
            } else if (risk.priority === 'Priorité 2 (Moyenne)') {
              mediumRisks++;
            } else {
              lowRisks++;
            }
            
            // Count by category
            const category = risk.category || 'Autres';
            risksByCategory[category] = (risksByCategory[category] || 0) + 1;
          });
        }
      });

      // Generate risk trends for last 6 months
      const riskTrends = [];
      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
      const currentDate = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const month = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthStr = monthNames[month.getMonth()];
        const docsInMonth = documents.filter(doc => {
          const docDate = new Date(doc.createdAt || '');
          return docDate.getMonth() === month.getMonth() && docDate.getFullYear() === month.getFullYear();
        });
        
        const risksInMonth = docsInMonth.reduce((sum, doc) => {
          return sum + (Array.isArray(doc.finalRisks) ? doc.finalRisks.length : 0);
        }, 0);
        
        riskTrends.push({
          month: monthStr,
          risks: risksInMonth,
          actions: Math.floor(risksInMonth * 0.7) // Estimation des actions complétées
        });
      }

      // Convert risksByCategory to array format
      const risksByCategoryArray = Object.entries(risksByCategory).map(([category, count]) => ({
        category,
        count,
        percentage: totalRisks > 0 ? Math.round((count / totalRisks) * 100) : 0
      }));

      const [companiesCount] = await db.select({ count: count() }).from(companies);
      
      const reportData = {
        totalRisks,
        highRisks,
        mediumRisks,
        lowRisks,
        completedActions: Math.floor(totalRisks * 0.6),
        pendingActions: Math.floor(totalRisks * 0.4),
        companiesAnalyzed: companiesCount?.count || 0,
        riskTrends,
        risksByCategory: risksByCategoryArray,
        performanceMetrics: {
          averageResolutionTime: 15, // jours
          complianceRate: totalRisks > 0 ? Math.round((highRisks / totalRisks) * 100) : 100,
          preventionEffectiveness: totalRisks > 0 ? Math.round(((totalRisks - highRisks) / totalRisks) * 100) : 100,
        }
      };
      
      res.json(reportData);
    } catch (error) {
      console.error('Error fetching reports:', error);
      res.status(500).json({ message: 'Failed to fetch reports' });
    }
  });

  app.get('/api/reports/export', (req, res) => {
    const { format, period } = req.query;
    // Simuler un export
    res.json({ 
      success: true, 
      message: `Export ${format} pour la période ${period} généré`,
      downloadUrl: `/api/download/report_${period}.${format}`
    });
  });

  // ============================================
  // BIBLIOTHÈQUE DE RISQUES INRS/ARS
  // ============================================

  // Récupérer toutes les familles de risques
  app.get('/api/risk-library/families', async (req, res) => {
    try {
      const families = await db.select().from(riskFamilies).where(eq(riskFamilies.isActive, true));
      res.json(families);
    } catch (error) {
      console.error('Error fetching risk families:', error);
      res.status(500).json({ message: 'Failed to fetch risk families' });
    }
  });

  // Récupérer tous les secteurs
  app.get('/api/risk-library/sectors', async (req, res) => {
    try {
      const allSectors = await db.select().from(sectors).where(eq(sectors.isActive, true));
      res.json(allSectors);
    } catch (error) {
      console.error('Error fetching sectors:', error);
      res.status(500).json({ message: 'Failed to fetch sectors' });
    }
  });

  // Récupérer les risques avec filtres
  app.get('/api/risk-library/risks', async (req, res) => {
    try {
      const { family, sector, level, search } = req.query;
      
      let conditions: any[] = [eq(riskLibrary.isActive, true)];
      
      if (family && family !== 'all') {
        conditions.push(eq(riskLibrary.family, family as string));
      }
      
      if (sector && sector !== 'all') {
        if (sector === 'TOUS') {
          // When specifically requesting generic risks only
          conditions.push(eq(riskLibrary.sector, 'TOUS'));
        } else {
          // Include both sector-specific risks and generic risks (TOUS)
          conditions.push(or(
            eq(riskLibrary.sector, sector as string),
            eq(riskLibrary.sector, 'TOUS')
          ));
        }
      }
      
      if (level && level !== 'all') {
        conditions.push(eq(riskLibrary.hierarchyLevel, level as string));
      }
      
      if (search) {
        const searchPattern = `%${search}%`;
        conditions.push(or(
          ilike(riskLibrary.situation, searchPattern),
          ilike(riskLibrary.description, searchPattern),
          ilike(riskLibrary.keywords, searchPattern)
        ));
      }
      
      const risks = await db.select().from(riskLibrary).where(and(...conditions));
      res.json(risks);
    } catch (error) {
      console.error('Error fetching risk library:', error);
      res.status(500).json({ message: 'Failed to fetch risk library' });
    }
  });

  // Récupérer les statistiques de la bibliothèque
  app.get('/api/risk-library/stats', async (req, res) => {
    try {
      const [totalCount] = await db.select({ count: count() }).from(riskLibrary).where(eq(riskLibrary.isActive, true));
      const [familiesCount] = await db.select({ count: count() }).from(riskFamilies).where(eq(riskFamilies.isActive, true));
      const [sectorsCount] = await db.select({ count: count() }).from(sectors).where(eq(sectors.isActive, true));
      
      // Count by hierarchy level
      const levelCounts = await db.select({
        level: riskLibrary.hierarchyLevel,
        count: count()
      }).from(riskLibrary)
        .where(eq(riskLibrary.isActive, true))
        .groupBy(riskLibrary.hierarchyLevel);
      
      res.json({
        totalRisks: totalCount?.count || 0,
        totalFamilies: familiesCount?.count || 0,
        totalSectors: sectorsCount?.count || 0,
        byLevel: levelCounts
      });
    } catch (error) {
      console.error('Error fetching risk library stats:', error);
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  });

  // Récupérer un risque spécifique par ID
  app.get('/api/risk-library/risks/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [risk] = await db.select().from(riskLibrary).where(eq(riskLibrary.id, id));
      
      if (!risk) {
        return res.status(404).json({ message: 'Risk not found' });
      }
      
      res.json(risk);
    } catch (error) {
      console.error('Error fetching risk:', error);
      res.status(500).json({ message: 'Failed to fetch risk' });
    }
  });

  // Créer un nouveau risque dans la bibliothèque (authentification requise)
  app.post('/api/risk-library/risks', async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
      const { family, sector, hierarchyLevel, situation, description, defaultGravity, defaultFrequency, defaultControl, measures, source, inrsCode, keywords } = req.body;
      
      // Validation des champs obligatoires
      if (!family || !sector || !hierarchyLevel || !situation || !description || !defaultGravity || !defaultFrequency || !defaultControl || !measures) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Validation des enums
      const validGravity = ['Faible', 'Moyenne', 'Grave', 'Très Grave'];
      const validFrequency = ['Annuelle', 'Mensuelle', 'Hebdomadaire', 'Journalière'];
      const validControl = ['Très élevée', 'Élevée', 'Moyenne', 'Absente'];
      const validLevels = ['Site', 'Zone', 'Unité', 'Activité'];
      
      if (!validGravity.includes(defaultGravity)) {
        return res.status(400).json({ message: 'Invalid gravity value' });
      }
      if (!validFrequency.includes(defaultFrequency)) {
        return res.status(400).json({ message: 'Invalid frequency value' });
      }
      if (!validControl.includes(defaultControl)) {
        return res.status(400).json({ message: 'Invalid control value' });
      }
      if (!validLevels.includes(hierarchyLevel)) {
        return res.status(400).json({ message: 'Invalid hierarchy level' });
      }
      
      const [newRisk] = await db.insert(riskLibrary).values({
        family,
        sector,
        hierarchyLevel,
        situation,
        description,
        defaultGravity,
        defaultFrequency,
        defaultControl,
        measures,
        source: source || 'Manuel',
        inrsCode: inrsCode || null,
        keywords: keywords || null,
        isActive: true,
      }).returning();
      
      res.status(201).json(newRisk);
    } catch (error) {
      console.error('Error creating risk:', error);
      res.status(500).json({ message: 'Failed to create risk' });
    }
  });

  // Mettre à jour un risque existant (authentification requise)
  app.put('/api/risk-library/risks/:id', async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
      const id = parseInt(req.params.id);
      const { family, sector, hierarchyLevel, situation, description, defaultGravity, defaultFrequency, defaultControl, measures, source, inrsCode, keywords, isActive } = req.body;
      
      // Build update object with only provided fields
      const updateData: Record<string, any> = {};
      if (family !== undefined) updateData.family = family;
      if (sector !== undefined) updateData.sector = sector;
      if (hierarchyLevel !== undefined) updateData.hierarchyLevel = hierarchyLevel;
      if (situation !== undefined) updateData.situation = situation;
      if (description !== undefined) updateData.description = description;
      if (defaultGravity !== undefined) updateData.defaultGravity = defaultGravity;
      if (defaultFrequency !== undefined) updateData.defaultFrequency = defaultFrequency;
      if (defaultControl !== undefined) updateData.defaultControl = defaultControl;
      if (measures !== undefined) updateData.measures = measures;
      if (source !== undefined) updateData.source = source;
      if (inrsCode !== undefined) updateData.inrsCode = inrsCode;
      if (keywords !== undefined) updateData.keywords = keywords;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      // Validation des enums si fournis
      const validGravity = ['Faible', 'Moyenne', 'Grave', 'Très Grave'];
      const validFrequency = ['Annuelle', 'Mensuelle', 'Hebdomadaire', 'Journalière'];
      const validControl = ['Très élevée', 'Élevée', 'Moyenne', 'Absente'];
      const validLevels = ['Site', 'Zone', 'Unité', 'Activité'];
      
      if (updateData.defaultGravity && !validGravity.includes(updateData.defaultGravity)) {
        return res.status(400).json({ message: 'Invalid gravity value' });
      }
      if (updateData.defaultFrequency && !validFrequency.includes(updateData.defaultFrequency)) {
        return res.status(400).json({ message: 'Invalid frequency value' });
      }
      if (updateData.defaultControl && !validControl.includes(updateData.defaultControl)) {
        return res.status(400).json({ message: 'Invalid control value' });
      }
      if (updateData.hierarchyLevel && !validLevels.includes(updateData.hierarchyLevel)) {
        return res.status(400).json({ message: 'Invalid hierarchy level' });
      }
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No fields to update' });
      }
      
      const [updatedRisk] = await db.update(riskLibrary)
        .set(updateData)
        .where(eq(riskLibrary.id, id))
        .returning();
      
      if (!updatedRisk) {
        return res.status(404).json({ message: 'Risk not found' });
      }
      
      res.json(updatedRisk);
    } catch (error) {
      console.error('Error updating risk:', error);
      res.status(500).json({ message: 'Failed to update risk' });
    }
  });

  // Supprimer un risque (authentification requise)
  app.delete('/api/risk-library/risks/:id', async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
      const id = parseInt(req.params.id);
      
      const [deletedRisk] = await db.delete(riskLibrary)
        .where(eq(riskLibrary.id, id))
        .returning();
      
      if (!deletedRisk) {
        return res.status(404).json({ message: 'Risk not found' });
      }
      
      res.json({ message: 'Risk deleted successfully', id });
    } catch (error) {
      console.error('Error deleting risk:', error);
      res.status(500).json({ message: 'Failed to delete risk' });
    }
  });

  // Récupérer les risques suggérés pour un contexte donné
  app.post('/api/risk-library/suggest', async (req, res) => {
    try {
      const { sector, hierarchyLevel, activityType } = req.body;
      
      let conditions: any[] = [eq(riskLibrary.isActive, true)];
      
      // Filter by hierarchy level
      if (hierarchyLevel) {
        conditions.push(eq(riskLibrary.hierarchyLevel, hierarchyLevel));
      }
      
      // Include sector-specific and generic risks
      if (sector) {
        conditions.push(or(
          eq(riskLibrary.sector, sector),
          eq(riskLibrary.sector, 'TOUS')
        ));
      }
      
      // Optional: search by activity type in keywords
      if (activityType) {
        conditions.push(or(
          ilike(riskLibrary.keywords, `%${activityType}%`),
          ilike(riskLibrary.situation, `%${activityType}%`)
        ));
      }
      
      const suggestedRisks = await db.select().from(riskLibrary).where(and(...conditions));
      res.json(suggestedRisks);
    } catch (error) {
      console.error('Error suggesting risks:', error);
      res.status(500).json({ message: 'Failed to suggest risks' });
    }
  });

  // ===== Custom risk creation (save to risk_library) =====
  app.post('/api/risk-library/custom', async (req, res) => {
    try {
      const { family, sector, hierarchyLevel, situation, description, defaultGravity, defaultFrequency, defaultControl, measures, keywords } = req.body;
      
      if (!family || !situation || !description) {
        return res.status(400).json({ message: 'Famille, situation et description sont requis' });
      }

      const [newRisk] = await db.insert(riskLibrary).values({
        family,
        sector: sector || 'TOUS',
        hierarchyLevel: hierarchyLevel || 'Unité',
        situation,
        description,
        defaultGravity: defaultGravity || 'Moyenne',
        defaultFrequency: defaultFrequency || 'Mensuelle',
        defaultControl: defaultControl || 'Moyenne',
        measures: measures || '',
        source: 'Personnalisé',
        keywords: keywords || '',
        isActive: true,
      }).returning();

      res.json(newRisk);
    } catch (error) {
      console.error('Error creating custom risk:', error);
      res.status(500).json({ message: 'Failed to create custom risk' });
    }
  });

  // ===== Custom measures =====
  app.get('/api/custom-measures', async (req, res) => {
    try {
      const { family } = req.query;
      let results;
      if (family && family !== 'all') {
        results = await db.select().from(customMeasures).where(eq(customMeasures.family, String(family))).orderBy(desc(customMeasures.createdAt));
      } else {
        results = await db.select().from(customMeasures).orderBy(desc(customMeasures.createdAt));
      }
      res.json(results);
    } catch (error) {
      console.error('Error fetching custom measures:', error);
      res.status(500).json({ message: 'Failed to fetch custom measures' });
    }
  });

  app.post('/api/custom-measures', async (req, res) => {
    try {
      const { family, measure } = req.body;
      if (!family || !measure) {
        return res.status(400).json({ message: 'Famille et mesure sont requis' });
      }

      const existing = await db.select().from(customMeasures)
        .where(and(eq(customMeasures.family, family), eq(customMeasures.measure, measure)))
        .limit(1);

      if (existing.length > 0) {
        return res.json(existing[0]);
      }

      const [newMeasure] = await db.insert(customMeasures).values({
        family,
        measure,
      }).returning();

      res.json(newMeasure);
    } catch (error) {
      console.error('Error creating custom measure:', error);
      res.status(500).json({ message: 'Failed to create custom measure' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
