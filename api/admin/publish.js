/* POST /api/admin/publish — admin only.
   Body: { autoTakedownAt } (ISO string or null).
   Puts the store LIVE. Requires a PDF to have been uploaded first. */

import { getAdminClient, getState, requireAdmin, sendError, httpError } from "../../lib/supabase.js";
import { sendNotifyBatch } from "../../lib/email.js";

const NOTIFY_DEDUPE_MS = 6 * 60 * 60 * 1000; // don't re-blast within 6 hours

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

    // Notify the mailing list — once per posting (guard against quick re-publish).
    let notified = 0;
    try {
      const lastNotified = data.last_notified_at ? new Date(data.last_notified_at).getTime() : 0;
      if (Date.now() - lastNotified > NOTIFY_DEDUPE_MS) {
        const { data: subs } = await supa
          .from("notify_list")
          .select("email, token")
          .is("unsubscribed_at", null);
        if (subs && subs.length) {
          const base = "https://" + (req.headers.host || "bobikepicks-com.vercel.app");
          notified = await sendNotifyBatch(subs, { siteUrl: base });
          await supa
            .from("site_state")
            .update({ last_notified_at: new Date().toISOString() })
            .eq("id", 1);
        }
      }
    } catch (notifyErr) {
      console.error("Notify broadcast failed:", notifyErr.message);
    }

    res.status(200).json({ state: data, notified });
  } catch (err) {
    sendError(res, err);
  }
}
