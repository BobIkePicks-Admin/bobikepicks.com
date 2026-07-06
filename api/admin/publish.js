/* POST /api/admin/publish — admin only.
   Body: { autoTakedownAt } (ISO string or null).
   Puts the store LIVE. Requires a PDF to have been uploaded first. */

import { getAdminClient, getState, requireAdmin, sendError, httpError } from "../../lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw httpError(405, "POST only");
    await requireAdmin(req);

    const supa = getAdminClient();
    const state = await getState(supa);
    if (!state.pdf_path) throw httpError(400, "Upload today's PDF before publishing.");

    let autoTakedownAt = req.body?.autoTakedownAt || null;
    if (autoTakedownAt && isNaN(new Date(autoTakedownAt).getTime())) {
      autoTakedownAt = null;
    }

    const { data, error } = await supa
      .from("site_state")
      .update({
        status: "live",
        published_at: new Date().toISOString(),
        auto_takedown_at: autoTakedownAt,
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
