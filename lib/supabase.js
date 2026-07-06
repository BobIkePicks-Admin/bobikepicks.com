/* ===========================================================
   Server-side Supabase helpers (used by the /api functions).
   Uses the SECRET key, so it bypasses row-level security.
   Never import this into browser code.
   =========================================================== */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

// Comma-separated list of emails allowed into the admin.
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const PICKS_BUCKET = "picks";

/** Admin client (full access — server only). */
export function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables."
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Read the current site_state row (always id = 1). */
export async function getState(supa) {
  const { data, error } = await supa
    .from("site_state")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Verify the request carries a valid Supabase session belonging to an
 * allow-listed admin. Throws an error with .status on failure.
 * Returns the authenticated user on success.
 */
export async function requireAdmin(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw httpError(401, "Please sign in.");

  const supa = getAdminClient();
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data?.user) throw httpError(401, "Your session has expired — sign in again.");

  const email = (data.user.email || "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    throw httpError(403, "This account is not authorized for the admin.");
  }
  return data.user;
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export function sendError(res, err) {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Server error" });
}
