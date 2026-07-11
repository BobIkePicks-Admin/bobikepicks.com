/* POST /api/notify-signup — public. Adds an email to the notify list.
   Re-subscribes if the address had previously unsubscribed. */

import { randomBytes } from "node:crypto";
import { getAdminClient, sendError, httpError } from "../lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw httpError(405, "POST only");

    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email || !email.includes("@") || email.length > 200) {
      throw httpError(400, "Enter a valid email.");
    }

    const supa = getAdminClient();
    const token = randomBytes(16).toString("hex");

    const { error } = await supa
      .from("notify_list")
      .upsert({ email, token, unsubscribed_at: null }, { onConflict: "email" });
    if (error) throw error;

    res.status(200).json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
}
