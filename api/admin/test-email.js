/* POST /api/admin/test-email — admin only.
   Sends a test email to the logged-in admin, attaching the first uploaded
   track PDF (if any). Lets Bob confirm delivery works before going live. */

import {
  getAdminClient,
  requireAdmin,
  sendError,
  httpError,
  downloadPdfByPath,
} from "../../lib/supabase.js";
import { sendEmail } from "../../lib/email.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw httpError(405, "POST only");
    const user = await requireAdmin(req);

    const supa = getAdminClient();

    // Grab the first track that has a file uploaded.
    const { data: track } = await supa
      .from("tracks")
      .select("name, pdf_path, pdf_name")
      .not("pdf_path", "is", null)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    const attachments = [];
    if (track) {
      const pdf = await downloadPdfByPath(supa, track.pdf_path, track.pdf_name);
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
            track
              ? `The picks file for <strong>${track.name}</strong> is attached — this is exactly what a buyer receives.`
              : "No track has a file uploaded right now, so nothing is attached."
          }</p>
        </div>`,
      attachments: attachments.length ? attachments : undefined,
    });

    res.status(200).json({ ok: true, sentTo: user.email });
  } catch (err) {
    sendError(res, err);
  }
}
