/* POST /api/admin/track-clear — admin only. Body: { id }.
   Removes a track's current file so it's no longer for sale (keeps the track). */

import { getAdminClient, requireAdmin, sendError, httpError, PICKS_BUCKET } from "../../lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw httpError(405, "POST only");
    await requireAdmin(req);

    const id = String(req.body?.id || "").trim();
    if (!id) throw httpError(400, "Missing track id.");

    const supa = getAdminClient();

    const { data: track } = await supa.from("tracks").select("pdf_path").eq("id", id).maybeSingle();
    if (track?.pdf_path) {
      await supa.storage.from(PICKS_BUCKET).remove([track.pdf_path]).catch(() => {});
    }

    const { data, error } = await supa
      .from("tracks")
      .update({ pdf_path: null, pdf_name: null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    res.status(200).json({ track: data });
  } catch (err) {
    sendError(res, err);
  }
}
