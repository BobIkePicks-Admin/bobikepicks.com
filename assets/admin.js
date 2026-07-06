/* ===========================================================
   Admin logic (demo).
   Upload a PDF, set an optional auto-take-down time, publish,
   and watch the live countdown. All browser-only — in the
   real build this talks to Supabase + triggers the email flow.
   =========================================================== */

(function () {
  const $ = (id) => document.getElementById(id);

  function showToast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  // ---- upload ----
  $("uploadZone").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    BIP.set({ pdfName: file.name });
    showToast("File ready: " + file.name);
  });

  // ---- publish / takedown ----
  $("publishBtn").addEventListener("click", () => {
    const s = BIP.get();
    if (!s.pdfName) {
      showToast("Choose today's PDF first.");
      return;
    }
    BIP.set({
      status: "live",
      publishedAt: new Date().toISOString(),
      autoTakedown: $("autoTime").value || ""
    });
    showToast("🎉 Picks are LIVE — buyers can purchase now.");
  });

  $("takedownBtn").addEventListener("click", () => {
    BIP.set({ status: "off" });
    showToast("Picks taken down — store is closed.");
  });

  $("testBtn").addEventListener("click", () => {
    const s = BIP.get();
    if (!s.pdfName) { showToast("Choose a PDF first to test delivery."); return; }
    showToast("✉ Demo: test email with '" + s.pdfName + "' sent to you.");
  });

  $("autoTime").addEventListener("change", () => {
    if (BIP.get().status === "live") {
      BIP.set({ autoTakedown: $("autoTime").value || "" });
    }
  });

  $("resetLink").addEventListener("click", (e) => {
    e.preventDefault();
    BIP.reset();
    showToast("Demo reset.");
  });

  // ---- auto take-down check ----
  function autoExpired(s) {
    if (s.status !== "live" || !s.autoTakedown) return false;
    const [h, m] = s.autoTakedown.split(":").map(Number);
    const cutoff = new Date();
    cutoff.setHours(h, m, 0, 0);
    const now = new Date();
    return now >= cutoff && s.publishedAt && new Date(s.publishedAt) < cutoff;
  }

  function countdownText(s) {
    if (s.status !== "live" || !s.autoTakedown) return "";
    const [h, m] = s.autoTakedown.split(":").map(Number);
    let cutoff = new Date();
    cutoff.setHours(h, m, 0, 0);
    const now = new Date();
    let diff = Math.floor((cutoff - now) / 1000);
    if (diff <= 0) return "";
    const hrs = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return "⏱ Auto-closes in " + (hrs > 0 ? hrs + "h " : "") + pad(mins) + "m " + pad(secs) + "s";
  }

  // ---- render ----
  function render() {
    let s = BIP.get();
    if (autoExpired(s)) {
      s = BIP.set({ status: "off" });
      showToast("Auto take-down: picks closed on schedule.");
    }

    const live = s.status === "live";

    // banner
    const banner = $("banner");
    banner.className = "status-banner " + (live ? "live" : "off");
    $("bannerDot").textContent = live ? "🟢" : "🔴";
    $("bannerText").textContent = live ? "Picks are LIVE" : "Picks are OFF";
    $("bannerCountdown").innerHTML = live && countdownText(s)
      ? '<span class="countdown">' + countdownText(s) + "</span>"
      : "";

    // upload zone
    const zone = $("uploadZone");
    if (s.pdfName) {
      zone.classList.add("has-file");
      $("uploadLabel").innerHTML = "<strong>✓ File chosen</strong>";
      $("uploadHint").classList.add("hidden");
      const fn = $("fileName");
      fn.textContent = s.pdfName;
      fn.classList.remove("hidden");
    } else {
      zone.classList.remove("has-file");
      $("uploadLabel").innerHTML = "<strong>Click to choose today's PDF</strong>";
      $("uploadHint").classList.remove("hidden");
      $("fileName").classList.add("hidden");
    }

    // buttons
    $("publishBtn").classList.toggle("hidden", live);
    $("takedownBtn").classList.toggle("hidden", !live);
    if (s.autoTakedown) $("autoTime").value = s.autoTakedown;

    // sales
    const body = $("salesBody");
    body.innerHTML = "";
    s.sales.forEach((sale) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + sale.email + "</td>" +
        "<td>" + sale.time + "</td>" +
        "<td>" + (sale.delivered ? '<span class="pill">delivered ✓</span>' : "—") + "</td>" +
        '<td style="text-align:right;"><button class="btn btn-ghost btn-sm resend">resend</button></td>';
      tr.querySelector(".resend").addEventListener("click", () =>
        showToast("✉ Demo: re-sent the PDF to " + sale.email)
      );
      body.appendChild(tr);
    });
    $("salesCount").textContent = s.sales.length + " this week";
  }

  BIP.onChange(render);
  render();
  setInterval(render, 1000); // live countdown
})();
