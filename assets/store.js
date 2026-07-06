/* ===========================================================
   Storefront logic (demo).
   Reads shared state and shows the LIVE buy box or the OFF
   "not posted yet" box. The auto-take-down time is honored
   here too, so the storefront closes itself on schedule.
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

  // Has the auto-take-down time passed today?
  function autoExpired(s) {
    if (s.status !== "live" || !s.autoTakedown) return false;
    const [h, m] = s.autoTakedown.split(":").map(Number);
    const now = new Date();
    const cutoff = new Date();
    cutoff.setHours(h, m, 0, 0);
    return now >= cutoff && s.publishedAt && new Date(s.publishedAt) < cutoff;
  }

  function render() {
    let s = BIP.get();

    // self-close if auto-take-down passed
    if (autoExpired(s)) {
      s = BIP.set({ status: "off" });
    }

    const live = s.status === "live";
    const badge = $("statusBadge");
    badge.className = "badge " + (live ? "live" : "off");
    badge.querySelector(".txt").textContent = live ? "Available now" : "No Picks Available";

    $("liveState").classList.toggle("hidden", !live);
    $("offState").classList.toggle("hidden", live);

    $("priceVal").textContent = s.price;
    if (live) {
      const d = s.publishedAt ? new Date(s.publishedAt) : new Date();
      $("liveDate").textContent =
        "Card for " + d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    }

    // demo bar
    $("demoStatusLabel").textContent = "Picks: " + (live ? "LIVE" : "OFF");
    $("demoToggle").textContent = live ? "Flip to OFF" : "Flip to LIVE";
  }

  // --- buy (mock) ---
  $("payBtn").addEventListener("click", () => {
    const email = $("email").value.trim();
    if (!email || !email.includes("@")) {
      showToast("Enter a valid email so we can send the PDF.");
      $("email").focus();
      return;
    }
    // record a mock sale
    const s = BIP.get();
    const sale = {
      email,
      time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      delivered: true
    };
    BIP.set({ sales: [sale, ...s.sales].slice(0, 12) });
    showToast("✅ Demo: payment captured — PDF emailed to " + email);
    $("email").value = "";
  });

  // --- notify capture (mock) ---
  $("notifyBtn").addEventListener("click", () => {
    const email = $("notifyEmail").value.trim();
    if (!email || !email.includes("@")) {
      showToast("Enter a valid email to be notified.");
      return;
    }
    showToast("👍 Demo: we'll email " + email + " when picks drop.");
    $("notifyEmail").value = "";
  });

  // --- demo toolbar toggle ---
  $("demoToggle").addEventListener("click", () => {
    const s = BIP.get();
    if (s.status === "live") {
      BIP.set({ status: "off" });
    } else {
      BIP.set({ status: "live", publishedAt: new Date().toISOString() });
    }
  });

  BIP.onChange(render);
  render();
  // re-check auto-take-down every 30s while page is open
  setInterval(render, 30000);
})();
