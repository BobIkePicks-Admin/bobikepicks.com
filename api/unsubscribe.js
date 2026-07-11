/* GET /api/unsubscribe?token=... — public. Removes an email from the
   notify list. Returns a simple HTML confirmation page (opened from an
   email link). */

import { getAdminClient } from "../lib/supabase.js";

function page(msg) {
  return `<!doctype html><html><head><meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Unsubscribe — BobIkePicks.com</title></head>
    <body style="font-family:Arial,Helvetica,sans-serif;background:#15240c;color:#fff;text-align:center;padding:70px 20px;">
      <h2 style="font-weight:600;">${msg}</h2>
      <p style="margin-top:18px;"><a href="/" style="color:#cbd0d6;">Back to BobIkePicks.com</a></p>
    </body></html>`;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  try {
    const token = req.query?.token;
    if (!token) {
      return res.status(400).send(page("That unsubscribe link is invalid."));
    }
    const supa = getAdminClient();
    const { data } = await supa
      .from("notify_list")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("token", token)
      .select("email")
      .maybeSingle();

    if (!data) {
      return res.status(200).send(page("You're unsubscribed (or that link was already used)."));
    }
    return res.status(200).send(page("You've been unsubscribed — you won't get posting alerts anymore."));
  } catch (err) {
    return res.status(200).send(page("You've been unsubscribed."));
  }
}
