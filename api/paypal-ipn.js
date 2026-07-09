/* POST /api/paypal-ipn — receives PayPal's IPN for a completed payment,
   verifies it with PayPal, records the sale, and emails the current PDF
   to the buyer's confirmation email (the form's `custom` field).

   Reused with Bob's classic "Buy Now" button (cmd=_xclick). */

import { getAdminClient, getState, downloadCurrentPdf } from "../lib/supabase.js";
import { sendPicksEmail } from "../lib/email.js";

const RECEIVER = (process.env.PAYPAL_RECEIVER_EMAIL || "bob@bobikepicks.com").toLowerCase();
const VERIFY_URL =
  process.env.PAYPAL_ENV === "sandbox"
    ? "https://ipnpb.sandbox.paypal.com/cgi-bin/webscr"
    : "https://ipnpb.paypal.com/cgi-bin/webscr";

// Normalize the request body into { params, rawBody } regardless of how
// Vercel presents it (parsed object, raw string, or Buffer).
function readBody(req) {
  const b = req.body;
  if (typeof b === "string") {
    return { params: Object.fromEntries(new URLSearchParams(b)), rawBody: b };
  }
  if (Buffer.isBuffer(b)) {
    const s = b.toString("utf8");
    return { params: Object.fromEntries(new URLSearchParams(s)), rawBody: s };
  }
  const params = b || {};
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) usp.append(k, v);
  return { params, rawBody: usp.toString() };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("POST only");

    const { params, rawBody } = readBody(req);

    // 1. Verify authenticity by posting the message back to PayPal.
    const verifyRes = await fetch(VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "BobIkePicks-IPN/1.0",
      },
      body: "cmd=_notify-validate&" + rawBody,
    });
    const verifyText = await verifyRes.text();
    if (verifyText !== "VERIFIED") {
      // Spoofed or invalid — acknowledge and ignore.
      return res.status(200).send("INVALID");
    }

    // 2. Only act on completed payments to Bob for the right amount.
    const status = params.payment_status;
    const receiver = (params.receiver_email || params.business || "").toLowerCase();
    const gross = parseFloat(params.mc_gross || "0");
    const currency = params.mc_currency;
    const txnId = params.txn_id;
    const buyerEmail = String(params.custom || params.payer_email || "").trim();

    if (status !== "Completed") return res.status(200).send("OK");
    if (receiver !== RECEIVER) return res.status(200).send("OK");
    if (!txnId) return res.status(200).send("OK");

    const supa = getAdminClient();
    const state = await getState(supa);
    const expected = (state.price_cents || 1000) / 100;
    if (currency !== "USD" || !(gross >= expected)) return res.status(200).send("OK");

    // 3. Dedupe: PayPal can send the same IPN more than once.
    const { data: existing } = await supa
      .from("sales")
      .select("id")
      .eq("paypal_order_id", txnId)
      .maybeSingle();
    if (existing) return res.status(200).send("ALREADY");

    // 4. Record the sale (delivered=false until the email succeeds).
    const { data: sale, error: insErr } = await supa
      .from("sales")
      .insert({
        email: buyerEmail,
        amount_cents: Math.round(gross * 100),
        paypal_order_id: txnId,
        pdf_name: state.pdf_name,
        delivered: false,
      })
      .select("id")
      .single();
    if (insErr) {
      if (insErr.code === "23505") return res.status(200).send("ALREADY"); // unique race
      throw insErr;
    }

    // 5. Deliver the PDF. If this fails, the sale stays "pending" so it's
    //    visible in the admin and can be re-sent later.
    try {
      const pdf = await downloadCurrentPdf(supa, state);
      if (pdf && buyerEmail.includes("@")) {
        await sendPicksEmail({ to: buyerEmail, pdfBuffer: pdf.buffer, pdfName: pdf.name });
        await supa
          .from("sales")
          .update({ delivered: true, delivered_at: new Date().toISOString() })
          .eq("id", sale.id);
      }
    } catch (deliverErr) {
      console.error("IPN delivery failed:", deliverErr.message);
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("IPN error:", err.message);
    // Non-200 tells PayPal to retry later (good for transient failures).
    return res.status(500).send("ERROR");
  }
}
