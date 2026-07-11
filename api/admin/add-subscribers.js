/* POST /api/admin/add-subscribers — admin only.
   Body: { emails } — one or many addresses separated by commas, spaces,
   semicolons, or new lines. Adds/reactivates them on the notify list. */

import { randomBytes } from "node:crypto";
import { getAdminClient, requireAdmin, sendError, httpError } from "../../lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw httpError(405, "POST only");
    await requireAdmin(req);

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

    const supa = getAdminClient();
    const { error } = await supa.from("notify_list").upsert(rows, { onConflict: "email" });
    if (error) throw error;

    res.status(200).json({ added: valid.length, invalid });
  } catch (err) {
    sendError(res, err);
  }
}
