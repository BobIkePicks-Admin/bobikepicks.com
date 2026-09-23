/* POST /api/admin/track-delete — admin only. Body: { id }. Removes a track
   (and its stored file, if any). */

import { getAdminClient, requireAdmin, sendError, httpError, PICKS_BUCKET } from "../../lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw httpError(405, "POST only");
    await requireAdmin(req);

    const id = String(req.body?.id || "").trim();
    if (!id) throw httpError(400, "Missing track id.");

    const supa = getAdminClient();

    // Best-effort: remove the stored file too.
    const { data: track } = await supa.from("tracks").select("pdf_path").eq("id", id).maybeSingle();
    if (track?.pdf_path) {
      await supa.storage.from(PICKS_BUCKET).remove([track.pdf_path]).catch(() => {});
    }

    const { error } = await supa.from("tracks").delete().eq("id", id);
    if (error) throw error;

    res.status(200).json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
}
