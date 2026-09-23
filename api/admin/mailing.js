/* POST /api/admin/mailing — admin only. Notify-list actions:
   { action: "list" }            -> { emails: [...] }
   { action: "add", emails }     -> { added, invalid } */

import { randomBytes } from "node:crypto";
import { getAdminClient, requireAdmin, sendError, httpError } from "../../lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw httpError(405, "POST only");
    await requireAdmin(req);
    const supa = getAdminClient();
    const action = req.body?.action;

    if (action === "list") {
      const { data } = await supa
        .from("notify_list")
        .select("email")
        .is("unsubscribed_at", null)
        .order("created_at", { ascending: true });
      return res.status(200).json({ emails: (data || []).map((r) => r.email) });
    }

    if (action === "add") {
      const raw = String(req.body?.emails || "");
      const candidates = raw
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const isValid = (e) => e.includes("@") && e.length <= 200;
      const valid = [...new Set(candidates.filter(isValid))];
      const invalid = candidates.filter((e) => !isValid(e));
      if (!valid.length) throw httpError(400, "No valid email addresses found.");

      const rows = valid.map((email) => ({
        email,
        token: randomBytes(16).toString("hex"),
        unsubscribed_at: null,
      }));
      const { error } = await supa.from("notify_list").upsert(rows, { onConflict: "email" });
      if (error) throw error;
      return res.status(200).json({ added: valid.length, invalid });
    }

    throw httpError(400, "Unknown mailing action.");
  } catch (err) {
    sendError(res, err);
  }
}
