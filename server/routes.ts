import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateRisksRequestSchema, insertCompanySchema } from "@shared/schema";
import { z } from "zod";

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

  // Export to Excel endpoint
  app.post('/api/export/excel', async (req, res) => {
    try {
      const { risks, companyName } = req.body;
      
      if (!risks || !Array.isArray(risks)) {
        return res.status(400).json({ message: 'Risks data is required' });
      }

      const XLSX = require('xlsx');
      
      // Prepare data for Excel
      const excelData = risks.map((risk: any, index: number) => ({
        'N°': index + 1,
        'Source': risk.source || '',
        'Type de source': risk.sourceType || '',
        'Type de risque': risk.type,
        'Danger': risk.danger,
        'Gravité': risk.gravity,
        'Fréquence': risk.frequency,
        'Maîtrise': risk.control,
        'Risque final': risk.finalRisk,
        'Mesures de prévention': risk.measures
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths
      const columnWidths = [
        { wch: 5 },  // N°
        { wch: 20 }, // Source
        { wch: 15 }, // Type de source
        { wch: 15 }, // Type de risque
        { wch: 40 }, // Danger
        { wch: 12 }, // Gravité
        { wch: 12 }, // Fréquence
        { wch: 12 }, // Maîtrise
        { wch: 15 }, // Risque final
        { wch: 50 }  // Mesures de prévention
      ];
      worksheet['!cols'] = columnWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Risques');
      
      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
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
      const { risks, companyName, companyActivity } = req.body;
      
      if (!risks || !Array.isArray(risks)) {
        return res.status(400).json({ message: 'Risks data is required' });
      }

      const { jsPDF } = require('jspdf');
      require('jspdf-autotable');
      
      const doc = new jsPDF('landscape', 'mm', 'a4');
      
      // Title
      doc.setFontSize(16);
      doc.text('Document Unique d\'Évaluation des Risques Professionnels', 20, 20);
      
      // Company info
      doc.setFontSize(12);
      doc.text(`Entreprise: ${companyName || 'Non renseigné'}`, 20, 30);
      doc.text(`Activité: ${companyActivity || 'Non renseigné'}`, 20, 38);
      doc.text(`Date d'export: ${new Date().toLocaleDateString('fr-FR')}`, 20, 46);
      
      // Table headers
      const headers = [
        'N°', 'Source', 'Type', 'Type de risque', 'Danger', 
        'Gravité', 'Fréquence', 'Maîtrise', 'Risque final', 'Mesures de prévention'
      ];
      
      // Table data
      const tableData = risks.map((risk: any, index: number) => [
        index + 1,
        risk.source || '',
        risk.sourceType || '',
        risk.type,
        risk.danger,
        risk.gravity,
        risk.frequency,
        risk.control,
        risk.finalRisk,
        risk.measures
      ]);
      
      // Generate table
      (doc as any).autoTable({
        head: [headers],
        body: tableData,
        startY: 55,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 8 },   // N°
          1: { cellWidth: 25 },  // Source
          2: { cellWidth: 15 },  // Type
          3: { cellWidth: 20 },  // Type de risque
          4: { cellWidth: 45 },  // Danger
          5: { cellWidth: 15 },  // Gravité
          6: { cellWidth: 15 },  // Fréquence
          7: { cellWidth: 15 },  // Maîtrise
          8: { cellWidth: 18 },  // Risque final
          9: { cellWidth: 50 }   // Mesures de prévention
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        }
      });
      
      const fileName = `DUERP_${companyName || 'Export'}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(Buffer.from(doc.output('arraybuffer')));
      
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      res.status(500).json({ message: 'Failed to export to PDF' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
