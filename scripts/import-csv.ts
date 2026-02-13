/**
 * Importe les CSV exportés de Replit vers la base PostgreSQL (Railway ou local).
 * Usage: npm run db:import-csv [dossier]
 * Par défaut: ./data (placez vos .csv dans ce dossier).
 *
 * Ordre d'import respectant les clés étrangères:
 * companies → sectors, risk_families, risk_library → users → duerp_documents → actions, comments, etc.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Charger .env en local (optionnel)
try {
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
} catch {
  // ignorer
}

import { parse } from "csv-parse/sync";

const DATA_DIR = process.argv[2] || join(process.cwd(), "data");

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function parseValue(val: string, key: string): unknown {
  if (val === "" || val === "\\N") return null;
  if (key === "id" || key.endsWith("Id") || key.endsWith("_id") || key === "employee_count" || key === "file_size") {
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
  }
  if (key === "is_active" || key === "revision_notified") {
    return val === "t" || val === "true" || val === "1";
  }
  if (
    key.includes("at") ||
    key === "due_date" ||
    key === "approved_at" ||
    key === "next_review_date" ||
    key === "last_revision_date" ||
    key === "completed_at" ||
    key === "uploaded_at"
  ) {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (key.endsWith("_data") || key.endsWith("measures") || key === "sites" || key === "locations" || key === "work_stations" || key === "final_risks" || key === "prevention_measures" || key === "work_units_data" || key === "global_prevention_measures" || key === "existing_prevention_measures") {
    try {
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  }
  return val;
}

function csvRowToRecord(row: Record<string, string>, tableColumns: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = snakeToCamel(k);
    if (!tableColumns.includes(camel)) continue;
    out[camel] = parseValue(v, k);
  }
  return out;
}

async function importTable(
  tableName: string,
  columns: string[],
  insert: (rows: Record<string, unknown>[]) => Promise<unknown>,
): Promise<number> {
  const path = join(DATA_DIR, `${tableName}.csv`);
  if (!existsSync(path)) {
    console.log(`  [skip] ${tableName}.csv absent`);
    return 0;
  }
  const raw = readFileSync(path, "utf-8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  if (rows.length === 0) {
    console.log(`  [skip] ${tableName}.csv vide`);
    return 0;
  }
  const records = rows.map((row: Record<string, string>) => csvRowToRecord(row, columns));
  await insert(records as Record<string, unknown>[]);
  console.log(`  [ok] ${tableName}: ${records.length} ligne(s)`);
  return records.length;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL doit être défini (ex: .env ou variables Railway).");
    process.exit(1);
  }
  if (!existsSync(DATA_DIR)) {
    console.error(`Dossier introuvable: ${DATA_DIR}`);
    console.log("Usage: npm run db:import-csv [dossier]   (défaut: ./data)");
    process.exit(1);
  }

  const { db, pool } = await import("../server/db");
  const schema = await import("../shared/schema");
  const sqlRaw = (q: string) => pool.query(q);

  console.log("Import depuis:", DATA_DIR);

  // Ordre respectant les FK
  await importTable("companies", ["id", "name", "activity", "description", "sector", "address", "siret", "phone", "email", "employeeCount", "logo", "existingPreventionMeasures", "createdAt", "updatedAt"], (rows) =>
    db.insert(schema.companies).values(rows as never[]),
  );
  await importTable("sectors", ["id", "code", "name", "description", "parentCode", "isActive"], (rows) =>
    db.insert(schema.sectors).values(rows as never[]),
  );
  await importTable("risk_families", ["id", "code", "name", "description", "icon", "color", "isActive"], (rows) =>
    db.insert(schema.riskFamilies).values(rows as never[]),
  );
  await importTable("risk_library", ["id", "family", "sector", "hierarchyLevel", "situation", "description", "defaultGravity", "defaultFrequency", "defaultControl", "measures", "source", "inrsCode", "keywords", "isActive"], (rows) =>
    db.insert(schema.riskLibrary).values(rows as never[]),
  );
  await importTable("users", ["id", "email", "firstName", "lastName", "role", "companyId", "createdAt", "isActive"], (rows) =>
    db.insert(schema.users).values(rows as never[]),
  );
  await importTable("duerp_documents", ["id", "companyId", "title", "version", "status", "workUnitsData", "sites", "globalPreventionMeasures", "locations", "workStations", "finalRisks", "preventionMeasures", "approvedBy", "approvedAt", "nextReviewDate", "lastRevisionDate", "revisionNotified", "createdAt", "updatedAt"], (rows) =>
    db.insert(schema.duerpDocuments).values(rows as never[]),
  );
  await importTable("actions", ["id", "duerpId", "title", "description", "priority", "status", "assignedTo", "dueDate", "completedAt", "createdAt", "updatedAt"], (rows) =>
    db.insert(schema.actions).values(rows as never[]),
  );
  await importTable("comments", ["id", "duerpId", "userId", "content", "locationId", "workUnitId", "createdAt"], (rows) =>
    db.insert(schema.comments).values(rows as never[]),
  );
  await importTable("risk_templates", ["id", "category", "sector", "type", "danger", "gravity", "frequency", "control", "finalRisk", "measures", "isActive"], (rows) =>
    db.insert(schema.riskTemplates).values(rows as never[]),
  );
  await importTable("custom_measures", ["id", "family", "measure", "createdAt"], (rows) =>
    db.insert(schema.customMeasures).values(rows as never[]),
  );
  await importTable("uploaded_documents", ["id", "companyId", "fileName", "fileType", "fileSize", "extractedText", "description", "uploadedAt"], (rows) =>
    db.insert(schema.uploadedDocuments).values(rows as never[]),
  );

  // Réinitialiser les séquences pour que les prochains INSERT aient les bons IDs
  const tables = ["companies", "sectors", "risk_families", "risk_library", "users", "duerp_documents", "actions", "comments", "risk_templates", "custom_measures", "uploaded_documents"];
  for (const t of tables) {
    try {
      await sqlRaw(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1))`);
    } catch {
      // table vide ou absente
    }
  }

  console.log("Import terminé.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
