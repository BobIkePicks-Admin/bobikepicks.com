/* POST /api/admin/track-upload — admin only.
   Body: { id, filename, contentBase64 }. Stores a PDF for one track. */

import { getAdminClient, requireAdmin, sendError, httpError, PICKS_BUCKET } from "../../lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw httpError(405, "POST only");
    await requireAdmin(req);

    const { id, filename, contentBase64 } = req.body || {};
    if (!id) throw httpError(400, "Missing track id.");
    if (!filename || !contentBase64) throw httpError(400, "No file received.");

    const buffer = Buffer.from(contentBase64, "base64");
    if (!buffer.length) throw httpError(400, "The uploaded file was empty.");

    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${id}/${Date.now()}-${safe}`;

    const supa = getAdminClient();
    const { error: upErr } = await supa.storage
      .from(PICKS_BUCKET)
      .upload(path, buffer, { contentType: "application/pdf", upsert: false });
    if (upErr) throw upErr;

    const { data, error } = await supa
      .from("tracks")
      .update({ pdf_path: path, pdf_name: filename, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    res.status(200).json({ track: data });
  } catch (err) {
    sendError(res, err);
  }
}
