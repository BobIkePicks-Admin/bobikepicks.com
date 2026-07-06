/* ===========================================================
   Storefront logic (live).
   Asks the backend (/api/status) whether picks are available and
   shows the buy box or the "not available" box accordingly.
   Auto-take-down is enforced server-side; we just re-poll.
   =========================================================== */

(function () {
  const $ = (id) => document.getElementById(id);

  function showToast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2800);
  }

  function render(state) {
    const live = state.status === "live";

    const badge = $("statusBadge");
    badge.className = "badge " + (live ? "live" : "off");
    badge.querySelector(".txt").textContent = live ? "Available now" : "No Picks Available";

    $("liveState").classList.toggle("hidden", !live);
    $("offState").classList.toggle("hidden", live);

    if (live) {
      $("priceVal").textContent = Math.round((state.priceCents || 1000) / 100);
      const d = state.publishedAt ? new Date(state.publishedAt) : new Date();
      $("liveDate").textContent =
        "Card for " +
        d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    }
  }

  async function refresh() {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) throw new Error("status " + res.status);
      render(await res.json());
    } catch (err) {
      // On error, fail safe to the closed state.
      render({ status: "off" });
    }
  }

  // --- buy button (PayPal wiring comes later) ---
  $("payBtn").addEventListener("click", () => {
    const email = $("email").value.trim();
    if (!email || !email.includes("@")) {
      showToast("Enter a valid email so we can send the PDF.");
      $("email").focus();
      return;
    }
    showToast("Checkout is being connected to PayPal — almost there!");
  });

  // --- notify-me capture (storefront closed) ---
  $("notifyBtn").addEventListener("click", () => {
    const email = $("notifyEmail").value.trim();
    if (!email || !email.includes("@")) {
      showToast("Enter a valid email to be notified.");
      return;
    }
    showToast("Thanks — we'll let you know the moment picks are posted.");
    $("notifyEmail").value = "";
  });

  refresh();
  // Re-check every 30s so the page reflects publish / auto-take-down.
  setInterval(refresh, 30000);
})();
