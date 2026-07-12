/* GET /api/admin/subscribers — admin only.
   Returns the active subscriber emails so Bob can notify them manually. */

import { getAdminClient, requireAdmin, sendError } from "../../lib/supabase.js";

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    const supa = getAdminClient();
    const { data } = await supa
      .from("notify_list")
      .select("email")
      .is("unsubscribed_at", null)
      .order("created_at", { ascending: true });

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ emails: (data || []).map((r) => r.email) });
  } catch (err) {
    sendError(res, err);
  }
}
