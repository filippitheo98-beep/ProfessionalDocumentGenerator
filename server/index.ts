import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

(async () => {
  try {
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err.message);
      res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const port = 5000;
    
    // Route de test simple
    app.get('/test', (req, res) => {
      res.sendFile(__dirname + '/../test.html');
    });
    
    // Route application simple
    app.get('/simple', (req, res) => {
      res.sendFile(__dirname + '/../simple.html');
    });
    
    server.listen(port, "0.0.0.0", () => {
      console.log(`🚀 DUERP Generator sur http://localhost:${port}`);
      console.log(`🧪 Test simple disponible sur: http://localhost:${port}/test`);
    });
  } catch (error) {
    console.error('Erreur démarrage:', error);
    process.exit(1);
  }
})();
