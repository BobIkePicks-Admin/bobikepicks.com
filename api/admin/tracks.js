/* POST /api/admin/tracks — admin only. One endpoint for all track actions:
   { action: "add",    name }
   { action: "delete", id }
   { action: "clear",  id }
   { action: "upload", id, filename, contentBase64 } */

import { getAdminClient, requireAdmin, sendError, httpError, PICKS_BUCKET } from "../../lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw httpError(405, "POST only");
    await requireAdmin(req);
    const supa = getAdminClient();
    const action = req.body?.action;

    if (action === "add") {
      const name = String(req.body?.name || "").trim();
      if (!name) throw httpError(400, "Enter a track name.");
      if (name.length > 80) throw httpError(400, "That track name is too long.");
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
      return res.status(200).json({ track: data });
    }

    const id = String(req.body?.id || "").trim();
    if (!id) throw httpError(400, "Missing track id.");

    if (action === "delete") {
      const { data: track } = await supa.from("tracks").select("pdf_path").eq("id", id).maybeSingle();
      if (track?.pdf_path) {
        await supa.storage.from(PICKS_BUCKET).remove([track.pdf_path]).catch(() => {});
      }
      const { error } = await supa.from("tracks").delete().eq("id", id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === "clear") {
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
      return res.status(200).json({ track: data });
    }

    if (action === "upload") {
      const { filename, contentBase64 } = req.body || {};
      if (!filename || !contentBase64) throw httpError(400, "No file received.");
      const buffer = Buffer.from(contentBase64, "base64");
      if (!buffer.length) throw httpError(400, "The uploaded file was empty.");
      const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${id}/${Date.now()}-${safe}`;
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
      return res.status(200).json({ track: data });
    }

    throw httpError(400, "Unknown track action.");
  } catch (err) {
    sendError(res, err);
  }
}
