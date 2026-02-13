import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig(async ({ command }) => {
  const plugins = [react(), runtimeErrorOverlay()];

  // Le plugin Cartographer de Replit suppose une racine de projet spécifique
  // et peut casser le build de production lorsque la racine est "client".
  // On ne l'active donc que pour le serveur de dev sur Replit.
  if (command === "serve" && process.env.REPL_ID !== undefined) {
    const m = await import("@replit/vite-plugin-cartographer");
    plugins.push(m.cartographer());
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
-});
