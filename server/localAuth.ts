/**
 * Authentification locale (email/mot de passe) pour usage hors Replit.
 * Utilise passport-local + bcrypt + session PostgreSQL.
 */
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import crypto from "crypto";
import type { Express, RequestHandler } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const SALT_ROUNDS = 12;

export interface LocalUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role?: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
}

export async function setupLocalAuth(app: Express): Promise<void> {
  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (emailOrUsername, password, done) => {
        try {
          const lookup = emailOrUsername.trim().toLowerCase();
          const rows = await db.execute(sql`
            SELECT id, email, password_hash, first_name, last_name, role, is_active
            FROM users
            WHERE LOWER(email) = ${lookup}
            LIMIT 1
          `);
          const row = Array.isArray(rows.rows) ? rows.rows[0] : (rows as { rows?: unknown[] }).rows?.[0];
          if (!row || !row.password_hash) {
            return done(null, false, { message: "Identifiants incorrects" });
          }
          const valid = await bcrypt.compare(password, row.password_hash as string);
          if (!valid) {
            return done(null, false, { message: "Identifiants incorrects" });
          }
          const isActive = row.is_active !== false && row.is_active !== null;
          if (!isActive) {
            return done(null, false, { message: "Compte désactivé" });
          }
          return done(null, {
            id: row.id as number,
            email: row.email as string,
            firstName: row.first_name ?? null,
            lastName: row.last_name ?? null,
            role: (row.role as string) ?? "user",
            isActive,
            mustChangePassword: false,
          });
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));
}

export async function createUser(data: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}): Promise<LocalUser> {
  const email = data.email.toLowerCase().trim();
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) {
    throw new Error("Un compte existe déjà avec cet email");
  }
  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      role: data.role ?? "user",
    })
    .returning();
  if (!user) throw new Error("Création utilisateur échouée");
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role ?? "user",
  };
}

export async function createPasswordResetToken(email: string): Promise<string | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
  if (!user) return null;
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
  await db
    .update(users)
    .set({
      passwordResetToken: token,
      passwordResetExpires: expires,
    })
    .where(eq(users.id, user.id));
  return token;
}

/** Crée l'utilisateur admin au démarrage : identifiant "admin", mot de passe par défaut "admin" (ou ADMIN_INITIAL_PASSWORD). Première connexion oblige au changement de mot de passe si la colonne must_change_password existe. */
export async function ensureAdminUser(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const check = await db.execute(sql`SELECT id FROM users WHERE email = 'admin' LIMIT 1`);
    const hasAdmin = Array.isArray(check.rows) ? check.rows.length > 0 : ((check as { rows?: unknown[] }).rows?.length ?? 0) > 0;
    if (hasAdmin) return;

    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD?.trim() || "admin";
    const passwordHash = await bcrypt.hash(initialPassword, SALT_ROUNDS);
    await db.execute(sql`
      INSERT INTO users (email, password_hash, role, is_active)
      VALUES ('admin', ${passwordHash}, 'admin', true)
    `);
    try {
      await db.execute(sql`UPDATE users SET must_change_password = true WHERE email = 'admin'`);
    } catch {
      // Colonne must_change_password absente : ignorer, le login fonctionnera quand même
    }
  } catch (err) {
    console.error("[auth] ensureAdminUser failed:", err);
  }
}

/** Change le mot de passe de l'utilisateur (pour première connexion admin ou changement volontaire). */
export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; message?: string }> {
  const rows = await db.execute(sql`SELECT password_hash FROM users WHERE id = ${userId} LIMIT 1`);
  const row = Array.isArray(rows.rows) ? rows.rows[0] : (rows as { rows?: unknown[] }).rows?.[0];
  if (!row || !row.password_hash) return { ok: false, message: "Utilisateur introuvable" };
  const valid = await bcrypt.compare(currentPassword, row.password_hash as string);
  if (!valid) return { ok: false, message: "Mot de passe actuel incorrect" };
  if (newPassword.length < 6) return { ok: false, message: "Le nouveau mot de passe doit faire au moins 6 caractères" };
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  try {
    await db.execute(sql`UPDATE users SET password_hash = ${passwordHash}, must_change_password = false WHERE id = ${userId}`);
  } catch {
    await db.execute(sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`);
  }
  return { ok: true };
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<boolean> {
  const all = await db
    .select()
    .from(users)
    .where(eq(users.passwordResetToken, token));
  const user = all[0];
  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    return false;
  }
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db
    .update(users)
    .set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    })
    .where(eq(users.id, user.id));
  return true;
}
