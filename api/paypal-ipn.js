/* POST /api/paypal-ipn — STUB (wired up when PayPal is ready).

   When live, this endpoint will:
     1. Receive PayPal's IPN (form-encoded body) for a completed payment.
     2. Verify it by posting it back to PayPal (cmd=_notify-validate) and
        confirming the reply is "VERIFIED".
     3. Check payment_status === "Completed", receiver is bob@bobikepicks.com,
        mc_gross === "10.00", mc_currency === "USD".
     4. Dedupe on txn_id, insert a row into `sales`, then email the current
        PDF (from the `picks` bucket) to the buyer address in the `custom` field.

   For now it just acknowledges so nothing errors while PayPal is disabled. */

export default async function handler(req, res) {
  // PayPal expects a fast 200 acknowledgement.
  res.status(200).send("OK");
}
