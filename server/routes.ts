import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
// Auth supprimé pour usage local
import { generateRisksRequestSchema, insertCompanySchema, duerpDocuments, companies } from "@shared/schema";
import { z } from "zod";
import { generateExcelFile, generatePDFFile } from './exportUtils';
import { db } from "./db";
import { eq, desc, count, lt, ne, sql } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Pas d'authentification pour usage local
  console.log("🔧 Application configurée pour usage local sans authentification");

  // Routes d'authentification simplifiées (pour compatibilité)
  app.get('/api/auth/user', async (req: any, res) => {
    res.json({
      id: "local-user",
      email: "user@localhost",
      firstName: "Utilisateur",
      lastName: "Local",
      profileImageUrl: null,
    });
  });

  // Dashboard routes
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      // Calculate real stats from database
      const [companiesCount] = await db.select({ count: count() }).from(companies);
      const [documentsCount] = await db.select({ count: count() }).from(duerpDocuments);
      
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

  app.get('/api/dashboard/activity', async (req, res) => {
    try {
      // Get recent activity from database
      const activities = await db
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

  app.get('/api/documents/expiring', async (req, res) => {
    try {
      // Get documents expiring within 30 days
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const expiring = await db
        .select({
          id: duerpDocuments.id,
          companyName: companies.name,
          nextReviewDate: duerpDocuments.nextReviewDate
        })
        .from(duerpDocuments)
        .leftJoin(companies, eq(duerpDocuments.companyId, companies.id))
        .where(lt(duerpDocuments.nextReviewDate, thirtyDaysFromNow))
        .orderBy(duerpDocuments.nextReviewDate);
      
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
  app.get("/api/companies/:id", async (req, res) => {
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
  app.put("/api/companies/:id", async (req, res) => {
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
      
      // Vérifier si c'est une erreur d'unicité du nom
      if (error.message.includes("existe déjà")) {
        return res.status(409).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Failed to save document' });
    }
  });

  app.get('/api/duerp/document/:id', async (req, res) => {
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
      res.json({
        ...document.duerp_documents,
        company: document.companies
      });
    } catch (error) {
      console.error('Error fetching DUERP document:', error);
      res.status(500).json({ message: 'Failed to fetch document' });
    }
  });

  app.put('/api/duerp/document/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title, locations, workStations, finalRisks, preventionMeasures } = req.body;
      
      const [updatedDocument] = await db
        .update(duerpDocuments)
        .set({
          title,
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
  app.delete('/api/duerp-documents/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
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

  // Export to PDF endpoint
  app.post('/api/export/pdf', async (req, res) => {
    try {
      const { risks, companyName, companyActivity, companyData, locations, workStations, preventionMeasures, chartImages } = req.body;
      
      if (!risks || !Array.isArray(risks)) {
        return res.status(400).json({ message: 'Risks data is required' });
      }

      const pdfBuffer = await generatePDFFile(
        risks, 
        companyName, 
        companyActivity, 
        companyData,
        locations || [],
        workStations || [],
        preventionMeasures || [],
        chartImages || {}
      );
      const fileName = `DUERP_${companyName || 'Export'}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(pdfBuffer);
      
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      res.status(500).json({ message: 'Failed to export to PDF' });
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

  // Revision tracking routes
  app.get("/api/revisions/needed", async (req, res) => {
    try {
      const documents = await storage.getDocumentsNeedingRevision();
      res.json(documents);
    } catch (error) {
      console.error('Error fetching documents needing revision:', error);
      res.status(500).json({ error: "Failed to fetch documents needing revision" });
    }
  });

  app.get("/api/revisions/notifications", async (req, res) => {
    try {
      const documents = await storage.getDocumentsNeedingNotification();
      res.json(documents);
    } catch (error) {
      console.error('Error fetching documents needing notification:', error);
      res.status(500).json({ error: "Failed to fetch documents needing notification" });
    }
  });

  app.post("/api/revisions/:id/notify", async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      await storage.markRevisionNotified(documentId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking revision as notified:', error);
      res.status(500).json({ error: "Failed to mark revision as notified" });
    }
  });

  app.post("/api/revisions/:id/update", async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.updateRevisionDate(documentId);
      res.json(document);
    } catch (error) {
      console.error('Error updating revision date:', error);
      res.status(500).json({ error: "Failed to update revision date" });
    }
  });

  // Documents API (non-archived)
  app.get('/api/documents', async (req, res) => {
    try {
      const documents = await db
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
  app.get('/api/reports', async (req, res) => {
    try {
      const [companiesCount] = await db.select({ count: count() }).from(companies);
      const [documentsCount] = await db.select({ count: count() }).from(duerpDocuments);
      
      const reportData = {
        totalRisks: 0,
        highRisks: 0,
        mediumRisks: 0,
        lowRisks: 0,
        completedActions: 0,
        pendingActions: 0,
        companiesAnalyzed: companiesCount?.count || 0,
        riskTrends: [],
        risksByCategory: [],
        performanceMetrics: {
          averageResolutionTime: 0,
          complianceRate: 0,
          preventionEffectiveness: 0,
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

  const httpServer = createServer(app);
  return httpServer;
}
