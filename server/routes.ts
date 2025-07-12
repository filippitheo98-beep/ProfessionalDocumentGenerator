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

  const httpServer = createServer(app);
  return httpServer;
}
