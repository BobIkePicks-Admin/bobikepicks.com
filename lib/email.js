/* ===========================================================
   Email delivery via Resend (REST API — no SDK dependency).
   FROM defaults to Bob's address; override with RESEND_FROM.
   =========================================================== */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || "Bob Ike Picks <bob@bobikepicks.com>";

/** Low-level send. attachments: [{ filename, content(base64) }]. */
export async function sendEmail({ to, subject, html, attachments }) {
  if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY environment variable.");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html, attachments }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message || `Resend error ${res.status}`);
  }
  return body; // { id }
}

/** Deliver the picks PDF to a buyer. */
export async function sendPicksEmail({ to, pdfBuffer, pdfName }) {
  return sendEmail({
    to,
    subject: "BobIkePicks Selection Sheet",
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2226;line-height:1.6;">
        <p>Thank you, and good luck today.</p><br>
        <p>Bob</p>
        <p style="color:#6b7280;font-size:13px;margin-top:24px;">— BobIkePicks · bobikepicks.com</p>
      </div>`,
    attachments: [
      { filename: pdfName || "BobIkePicks_Selections.pdf", content: pdfBuffer.toString("base64") },
    ],
  });
}
