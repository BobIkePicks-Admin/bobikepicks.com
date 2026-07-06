/* POST /api/admin/upload — admin only.
   Body: { filename, contentBase64 }.
   Stores the PDF in the private "picks" bucket and records it as the
   current file. Keep PDFs small (a few MB) — see note in README/setup. */

import { getAdminClient, requireAdmin, sendError, httpError, PICKS_BUCKET } from "../../lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw httpError(405, "POST only");
    await requireAdmin(req);

    const { filename, contentBase64 } = req.body || {};
    if (!filename || !contentBase64) throw httpError(400, "No file received.");

    const buffer = Buffer.from(contentBase64, "base64");
    if (!buffer.length) throw httpError(400, "The uploaded file was empty.");

    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}-${safe}`;

    const supa = getAdminClient();
    const { error: upErr } = await supa.storage
      .from(PICKS_BUCKET)
      .upload(path, buffer, { contentType: "application/pdf", upsert: false });
    if (upErr) throw upErr;

    const { error } = await supa
      .from("site_state")
      .update({ pdf_path: path, pdf_name: filename, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw error;

    res.status(200).json({ ok: true, pdfName: filename });
  } catch (err) {
    sendError(res, err);
  }
}
