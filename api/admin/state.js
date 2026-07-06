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

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ email: user.email, state, sales: sales || [] });
  } catch (err) {
    sendError(res, err);
  }
}
