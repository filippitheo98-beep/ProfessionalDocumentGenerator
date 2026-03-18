import { existsSync } from "fs";
import { join } from "path";
import dotenv from "dotenv";

// Charge les variables depuis .env en local.
// En production (Railway), les variables sont injectées par l'environnement.
const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

