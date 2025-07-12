import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateRisksRequestSchema, insertCompanySchema, duerpDocuments } from "@shared/schema";
import { z } from "zod";
import { generateExcelFile, generatePDFFile } from './exportUtils';
import { db } from "./db";
import { eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
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
  app.get('/api/dashboard/stats', isAuthenticated, async (req, res) => {
    try {
      // Mock data for now - in production, calculate from database
      const stats = {
        totalCompanies: 3,
        totalDocuments: 5,
        pendingActions: 12,
        expiringSoon: 2,
        completedActions: 8,
        riskScore: 75,
      };
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get('/api/dashboard/activity', isAuthenticated, async (req, res) => {
    try {
      // Mock data for now - in production, fetch from database
      const activities = [
        {
          id: "1",
          type: "document_created",
          title: "Nouveau DUERP créé",
          description: "Document pour l'entreprise TechCorp",
          timestamp: "Il y a 2 heures",
          priority: "medium"
        },
        {
          id: "2",
          type: "action_completed",
          title: "Action terminée",
          description: "Installation d'extincteurs supplémentaires",
          timestamp: "Il y a 4 heures",
          priority: "high"
        },
        {
          id: "3",
          type: "document_updated",
          title: "Document mis à jour",
          description: "Ajout d'une nouvelle unité de travail",
          timestamp: "Hier",
          priority: "low"
        }
      ];
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  app.get('/api/documents/expiring', isAuthenticated, async (req, res) => {
    try {
      // Mock data for now - in production, fetch from database
      const expiring = [
        {
          id: 1,
          companyName: "TechCorp",
          nextReviewDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 2,
          companyName: "InnovSolutions",
          nextReviewDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      res.json(expiring);
    } catch (error) {
      console.error("Error fetching expiring documents:", error);
      res.status(500).json({ message: "Failed to fetch expiring documents" });
    }
  });
  // Create or get company
  app.post("/api/companies", async (req, res) => {
    try {
      console.log("Creating company with data:", req.body);
      const validatedData = insertCompanySchema.parse(req.body);
      console.log("Validated data:", validatedData);
      const company = await storage.createCompany(validatedData);
      console.log("Created company:", company);
      res.json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(400).json({ 
        message: error instanceof z.ZodError ? "Données invalides" : "Erreur lors de la création de l'entreprise" 
      });
    }
  });

  // Get company by ID
  app.get("/api/companies/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.getCompany(id);
      if (!company) {
        res.status(404).json({ message: "Entreprise non trouvée" });
        return;
      }
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération de l'entreprise" });
    }
  });

  // Update company
  app.put("/api/companies/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const company = await storage.updateCompany(id, updates);
      res.json(company);
    } catch (error) {
      res.status(400).json({ message: "Erreur lors de la mise à jour de l'entreprise" });
    }
  });

  // Generate risks for a work unit
  app.post("/api/generate-risks", async (req, res) => {
    try {
      const validatedData = generateRisksRequestSchema.parse(req.body);
      const risks = await storage.generateRisks(
        validatedData.workUnitName,
        validatedData.locationName,
        validatedData.companyActivity
      );
      res.json({ risks });
    } catch (error) {
      res.status(400).json({ 
        message: error instanceof z.ZodError ? "Données invalides" : "Erreur lors de la génération des risques" 
      });
    }
  });

  // DUERP Documents API
  app.get('/api/duerp/:companyId', async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const documents = await storage.getDuerpDocuments(companyId);
      res.json(documents);
    } catch (error) {
      console.error('Error fetching DUERP documents:', error);
      res.status(500).json({ message: 'Failed to fetch documents' });
    }
  });

  app.post('/api/duerp/save', async (req, res) => {
    try {
      const { companyId, title, locations, workStations, finalRisks, preventionMeasures } = req.body;
      
      if (!companyId || !title) {
        return res.status(400).json({ message: 'Company ID and title are required' });
      }

      const document = await storage.createDuerpDocument({
        companyId,
        title,
        locations: locations || [],
        workStations: workStations || [],
        finalRisks: finalRisks || [],
        preventionMeasures: preventionMeasures || []
      });
      
      res.json(document);
    } catch (error) {
      console.error('Error saving DUERP document:', error);
      res.status(500).json({ message: 'Failed to save document' });
    }
  });

  app.get('/api/duerp/document/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const documents = await db.select().from(duerpDocuments).where(eq(duerpDocuments.id, id));
      if (!documents.length) {
        return res.status(404).json({ message: 'Document not found' });
      }
      res.json(documents[0]);
    } catch (error) {
      console.error('Error fetching DUERP document:', error);
      res.status(500).json({ message: 'Failed to fetch document' });
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

  // Temporarily disabled PDF export
  // app.post('/api/export/pdf', async (req, res) => {
  //   res.status(503).json({ message: 'PDF export temporarily disabled' });
  // });

  // Documents API
  app.get('/api/documents', (req, res) => {
    const mockDocuments = [
      {
        id: 1,
        companyName: 'TechCorp',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-02-01T14:30:00Z',
        status: 'active',
        nextReviewDate: '2024-12-15T10:00:00Z',
        riskCount: 23
      },
      {
        id: 2,
        companyName: 'BuildingCorp',
        createdAt: '2024-02-10T09:15:00Z',
        updatedAt: '2024-02-20T16:45:00Z',
        status: 'expired',
        nextReviewDate: '2024-01-10T09:15:00Z',
        riskCount: 45
      },
      {
        id: 3,
        companyName: 'HealthCorp',
        createdAt: '2024-03-05T11:30:00Z',
        updatedAt: '2024-03-15T13:20:00Z',
        status: 'draft',
        nextReviewDate: '2024-06-05T11:30:00Z',
        riskCount: 12
      }
    ];
    res.json(mockDocuments);
  });

  // Collaborators API
  app.get('/api/collaborators', (req, res) => {
    const mockCollaborators = [
      {
        id: 1,
        name: 'Marie Dupont',
        email: 'marie.dupont@entreprise.com',
        role: 'admin',
        status: 'active',
        lastLogin: '2024-03-15T10:30:00Z',
        joinedAt: '2024-01-10T09:00:00Z'
      },
      {
        id: 2,
        name: 'Jean Martin',
        email: 'jean.martin@entreprise.com',
        role: 'editor',
        status: 'active',
        lastLogin: '2024-03-14T16:45:00Z',
        joinedAt: '2024-02-01T14:00:00Z'
      },
      {
        id: 3,
        name: 'Sophie Bernard',
        email: 'sophie.bernard@entreprise.com',
        role: 'viewer',
        status: 'pending',
        lastLogin: '2024-03-10T08:15:00Z',
        joinedAt: '2024-03-01T10:30:00Z'
      }
    ];
    res.json(mockCollaborators);
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
  app.get('/api/reports', (req, res) => {
    const mockReportData = {
      totalRisks: 247,
      highRisks: 23,
      mediumRisks: 89,
      lowRisks: 135,
      completedActions: 156,
      pendingActions: 34,
      companiesAnalyzed: 12,
      riskTrends: [
        { month: 'Jan', risks: 45, actions: 32 },
        { month: 'Fév', risks: 52, actions: 38 },
        { month: 'Mar', risks: 48, actions: 45 },
        { month: 'Avr', risks: 61, actions: 52 },
        { month: 'Mai', risks: 58, actions: 48 },
        { month: 'Jun', risks: 67, actions: 59 },
      ],
      risksByCategory: [
        { category: 'Chutes', count: 45, percentage: 18.2 },
        { category: 'Électrique', count: 38, percentage: 15.4 },
        { category: 'Chimique', count: 32, percentage: 13.0 },
        { category: 'Ergonomique', count: 41, percentage: 16.6 },
        { category: 'Mécanique', count: 29, percentage: 11.7 },
        { category: 'Autres', count: 62, percentage: 25.1 },
      ],
      performanceMetrics: {
        averageResolutionTime: 12.5,
        complianceRate: 94.2,
        preventionEffectiveness: 87.8,
      }
    };
    res.json(mockReportData);
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

  const httpServer = createServer(app);
  return httpServer;
}
