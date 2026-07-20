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

  // Nicely formatted date for the live card. Prefers the date Bob selected
  // (parsed as a plain local date to avoid off-by-one), else the publish date.
  function cardDateLabel(state) {
    const opts = { weekday: "long", month: "long", day: "numeric" };
    if (state.picksDate && /^\d{4}-\d{2}-\d{2}$/.test(state.picksDate)) {
      const [y, m, d] = state.picksDate.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
    }
    const d = state.publishedAt ? new Date(state.publishedAt) : new Date();
    return d.toLocaleDateString(undefined, opts);
  }

  function render(state) {
    const live = state.status === "live";

    const badge = $("statusBadge");
    badge.className = "badge " + (live ? "live" : "off");
    badge.querySelector(".txt").textContent = live ? "Available now" : "No Picks Available";

    $("liveState").classList.toggle("hidden", !live);
    $("offState").classList.toggle("hidden", live);

    if (live) {
      const dollars = Math.round((state.priceCents || 1000) / 100);
      $("priceVal").textContent = dollars;
      $("btnPrice").textContent = "$" + dollars;

      $("liveDate").textContent = "Card for " + cardDateLabel(state);

      // Fill the PayPal form so it targets THIS origin (works on vercel.app
      // now and on bobikepicks.com after the domain cutover — no edits needed).
      const origin = window.location.origin;
      $("ppAmount").value = (Math.round(state.priceCents || 1000) / 100).toFixed(2);
      $("ppNotify").value = origin + "/api/paypal-ipn";
      $("ppReturn").value = origin + "/thanks.html";
      $("ppCancel").value = origin + "/";
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

  // The buy button is a native PayPal form submit (see index.html #buyForm).
  // The email field is `custom`, carried through PayPal and returned in the IPN.

  // --- notify-me signup (storefront closed) ---
  $("notifyBtn").addEventListener("click", async () => {
    const email = $("notifyEmail").value.trim();
    if (!email || !email.includes("@")) {
      showToast("Enter a valid email to be notified.");
      return;
    }
    $("notifyBtn").disabled = true;
    try {
      const res = await fetch("/api/notify-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong.");
      showToast("You're on the list — we'll email you the moment picks are posted.");
      $("notifyEmail").value = "";
    } catch (err) {
      showToast(err.message);
    } finally {
      $("notifyBtn").disabled = false;
    }
  });

  refresh();
  // Re-check every 30s so the page reflects publish / auto-take-down.
  setInterval(refresh, 30000);
})();
