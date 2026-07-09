/* POST /api/admin/test-email — admin only.
   Sends a test email to the logged-in admin, attaching the current PDF
   if one is uploaded. Lets Bob confirm delivery works before going live. */

import {
  getAdminClient,
  getState,
  requireAdmin,
  sendError,
  httpError,
  downloadCurrentPdf,
} from "../../lib/supabase.js";
import { sendEmail } from "../../lib/email.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw httpError(405, "POST only");
    const user = await requireAdmin(req);

    const supa = getAdminClient();
    const state = await getState(supa);

    const attachments = [];
    if (state.pdf_path) {
      const pdf = await downloadCurrentPdf(supa, state);
      if (pdf) {
        attachments.push({ filename: pdf.name, content: pdf.buffer.toString("base64") });
      }
    }

    await sendEmail({
      to: user.email,
      subject: "Test — Bob Ike Picks delivery",
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2226;line-height:1.6;">
          <p>This is a test email from your Bob Ike Picks admin.</p>
          <p>${
            state.pdf_name
              ? "Your current picks PDF is attached — this is exactly what a buyer receives."
              : "No PDF is uploaded right now, so nothing is attached."
          }</p>
        </div>`,
      attachments: attachments.length ? attachments : undefined,
    });

    res.status(200).json({ ok: true, sentTo: user.email });
  } catch (err) {
    sendError(res, err);
  }
}
