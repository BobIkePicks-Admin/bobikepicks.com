/* GET /api/status — public. Tells the storefront whether picks are live.
   Also enforces auto-take-down: if the scheduled time has passed, it
   flips the store to OFF on read. */

import { getAdminClient, getState } from "../lib/supabase.js";

export default async function handler(req, res) {
  try {
    const supa = getAdminClient();
    let state = await getState(supa);

    // Auto-take-down: close the store if the scheduled time has passed.
    if (
      state.status === "live" &&
      state.auto_takedown_at &&
      new Date(state.auto_takedown_at) <= new Date()
    ) {
      const { data, error } = await supa
        .from("site_state")
        .update({ status: "off", updated_at: new Date().toISOString() })
        .eq("id", 1)
        .select("*")
        .single();
      if (!error && data) state = data;
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      status: state.status,
      priceCents: state.price_cents,
      publishedAt: state.published_at,
      autoTakedownAt: state.auto_takedown_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
}
