/* POST /api/admin/track-add — admin only. Body: { name }. Adds a track. */

import { getAdminClient, requireAdmin, sendError, httpError } from "../../lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw httpError(405, "POST only");
    await requireAdmin(req);

    const name = String(req.body?.name || "").trim();
    if (!name) throw httpError(400, "Enter a track name.");
    if (name.length > 80) throw httpError(400, "That track name is too long.");

    const supa = getAdminClient();

    // Next position = max + 1.
    const { data: last } = await supa
      .from("tracks")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = (last?.position || 0) + 1;

    const { data, error } = await supa
      .from("tracks")
      .insert({ name, position })
      .select("*")
      .single();
    if (error) throw error;

    res.status(200).json({ track: data });
  } catch (err) {
    sendError(res, err);
  }
}
