/* POST /api/admin/takedown — admin only. Closes the store. */

import { getAdminClient, requireAdmin, sendError, httpError } from "../../lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw httpError(405, "POST only");
    await requireAdmin(req);

    const supa = getAdminClient();
    const { data, error } = await supa
      .from("site_state")
      .update({
        status: "off",
        auto_takedown_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .select("*")
      .single();
    if (error) throw error;

    res.status(200).json({ state: data });
  } catch (err) {
    sendError(res, err);
  }
}
