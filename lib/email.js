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
export async function sendPicksEmail({ to, pdfBuffer, pdfName, firstName }) {
  const name = String(firstName || "").trim().replace(/[<>&"]/g, "");
  const greeting = name ? `Hi ${name},` : "Hi there,";
  return sendEmail({
    to,
    subject: "BobIkePicks Selection Sheet",
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2226;line-height:1.6;">
        <p>${greeting}</p>
        <p>Thank you and good luck today.</p><br>
        <p>Bob</p>
        <p style="color:#6b7280;font-size:13px;margin-top:24px;">— BobIkePicks · bobikepicks.com</p>
      </div>`,
    attachments: [
      { filename: pdfName || "BobIkePicks_Selections.pdf", content: pdfBuffer.toString("base64") },
    ],
  });
}

/** Broadcast a "picks are posted" email to the notify list (batched by 100). */
export async function sendNotifyBatch(subscribers, { siteUrl }) {
  if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY environment variable.");
  let sent = 0;
  for (let i = 0; i < subscribers.length; i += 100) {
    const chunk = subscribers.slice(i, i + 100);
    const emails = chunk.map((s) => ({
      from: FROM,
      to: s.email,
      subject: "Selections Available - BobIkePicks.com",
      html: notifyHtml(siteUrl, s.token),
    }));
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emails),
    });
    if (res.ok) sent += chunk.length;
    else console.error("Notify batch failed:", await res.text().catch(() => ""));
  }
  return sent;
}

function notifyHtml(siteUrl, token) {
  const unsub = `${siteUrl}/api/unsubscribe?token=${encodeURIComponent(token)}`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2226;line-height:1.6;">
      <p>Bob Ike's selections for today are now posted.</p>
      <p style="margin:22px 0;">
        <a href="${siteUrl}" style="background:#15240c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;">Get today's picks →</a>
      </p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">
        You're receiving this email because you asked to be notified at bobikepicks.com.
        <a href="${unsub}" style="color:#6b7280;">Unsubscribe</a>.
      </p>
    </div>`;
}
