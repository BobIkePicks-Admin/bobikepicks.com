/* GET /api/admin/state — admin only.
   Returns the current site state + recent sales for the dashboard. */

import { getAdminClient, getState, requireAdmin, sendError } from "../../lib/supabase.js";

export default async function handler(req, res) {
  try {
    const user = await requireAdmin(req);
    const supa = getAdminClient();

    const state = await getState(supa);
    const { data: sales } = await supa
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);

    const { data: tracks } = await supa
      .from("tracks")
      .select("id, name, position, pdf_name")
      .order("position", { ascending: true });

    const { count: subscriberCount } = await supa
      .from("notify_list")
      .select("*", { count: "exact", head: true })
      .is("unsubscribed_at", null);

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      email: user.email,
      state,
      sales: sales || [],
      tracks: tracks || [],
      subscriberCount: subscriberCount || 0,
    });
  } catch (err) {
    sendError(res, err);
  }
}
