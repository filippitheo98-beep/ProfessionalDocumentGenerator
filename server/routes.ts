import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateRisksRequestSchema, insertCompanySchema, duerpDocuments, companies, type Risk } from "@shared/schema";
import { z } from "zod";
import { generateExcelFile, generatePDFFile, generateWordFile } from './exportUtils';
import { db } from "./db";
import { eq, desc, count, lt, ne, sql } from "drizzle-orm";

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

  app.get('/api/dashboard/activity', isAuthenticated, async (req, res) => {
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

  app.get('/api/documents/expiring', isAuthenticated, async (req, res) => {
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

  // Uploaded documents for AI context
  app.get("/api/companies/:companyId/documents", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const documents = await storage.getUploadedDocuments(companyId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching uploaded documents:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des documents" });
    }
  });

  app.post("/api/companies/:companyId/documents", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
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

  app.patch("/api/companies/:companyId/documents/:documentId", isAuthenticated, async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const { description } = req.body;
      
      const document = await storage.updateUploadedDocument(documentId, { description });
      res.json(document);
    } catch (error) {
      console.error("Error updating uploaded document:", error);
      res.status(500).json({ message: "Erreur lors de la mise à jour du document" });
    }
  });

  app.delete("/api/companies/:companyId/documents/:documentId", isAuthenticated, async (req, res) => {
    try {
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
      res.status(400).json({ 
        message: error instanceof z.ZodError ? "Données invalides" : "Erreur lors de la génération des risques" 
      });
    }
  });

  // Generate hierarchical risks for specific level (Site, Zone, Unité, Activité)
  app.post("/api/generate-hierarchical-risks", async (req, res) => {
    try {
      const { level, elementName, elementDescription, companyActivity, companyDescription, companyId, siteName, zoneName, workUnitName, inheritedRisks, uploadedDocumentsContext } = req.body;
      
      if (!level || !elementName || !companyActivity) {
        return res.status(400).json({ message: "Level, element name, and company activity are required" });
      }

      // Build hierarchical context for AI
      let context = companyDescription || '';
      
      // Add hierarchical path context
      let hierarchyContext = `\nNiveau hiérarchique: ${level}`;
      if (siteName) hierarchyContext += `\nSite: ${siteName}`;
      if (zoneName) hierarchyContext += `\nZone: ${zoneName}`;
      if (workUnitName) hierarchyContext += `\nUnité de travail: ${workUnitName}`;
      
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
      console.error("Error generating hierarchical risks:", error);
      res.status(500).json({ 
        message: "Erreur lors de la génération des risques" 
      });
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
      const docData = { ...document.duerp_documents, company: document.companies };
      
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

  // Revision tracking routes
  app.get("/api/revisions/needed", async (req, res) => {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      // Get documents that need revision (past due or due soon)
      const documents = await db
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

  app.get("/api/revisions/notifications", async (req, res) => {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      // Get documents that need notification (due within 30 days and not yet notified)
      const documents = await db
        .select({
          id: duerpDocuments.id,
          title: duerpDocuments.title,
          companyName: companies.name,
          nextReviewDate: duerpDocuments.nextReviewDate
        })
        .from(duerpDocuments)
        .leftJoin(companies, eq(duerpDocuments.companyId, companies.id))
        .where(ne(duerpDocuments.status, 'archived'));

      const notifications = documents.filter(doc => {
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
  app.get('/api/reports/:period?', async (req, res) => {
    try {
      const period = req.params.period || 'month';
      
      // Get all documents with their risks
      const documents = await db
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

  const httpServer = createServer(app);
  return httpServer;
}
