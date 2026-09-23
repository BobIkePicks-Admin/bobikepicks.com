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

  function attr(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
  }

  // Build a PayPal "Buy Now" form for each available track. item_number
  // carries the track id so the IPN knows which PDF to deliver; the shared
  // email field is copied into `custom` on submit.
  function renderTracks(state) {
    const origin = window.location.origin;
    const dollars = Math.round((state.priceCents || 1000) / 100);
    const amount = dollars.toFixed(2);
    const list = $("trackList");
    list.innerHTML = "";
    (state.tracks || []).forEach((t) => {
      const form = document.createElement("form");
      form.className = "track-buy";
      form.action = "https://www.paypal.com/cgi-bin/webscr";
      form.method = "post";
      form.innerHTML =
        '<input type="hidden" name="cmd" value="_xclick" />' +
        '<input type="hidden" name="business" value="bob@bobikepicks.com" />' +
        `<input type="hidden" name="item_name" value="BobIkePicks — ${attr(t.name)}" />` +
        `<input type="hidden" name="item_number" value="${attr(t.id)}" />` +
        '<input type="hidden" name="currency_code" value="USD" />' +
        '<input type="hidden" name="no_shipping" value="1" />' +
        `<input type="hidden" name="amount" value="${amount}" />` +
        `<input type="hidden" name="notify_url" value="${origin}/api/paypal-ipn" />` +
        `<input type="hidden" name="return" value="${origin}/thanks.html" />` +
        `<input type="hidden" name="cancel_return" value="${origin}/" />` +
        '<input type="hidden" name="custom" value="" />' +
        `<button type="submit" class="btn btn-paypal">${attr(t.name)} — Pay $${dollars}</button>`;
      list.appendChild(form);
    });
  }

  function render(state) {
    const hasTracks = Array.isArray(state.tracks) && state.tracks.length > 0;
    const live = state.status === "live" && hasTracks;

    const badge = $("statusBadge");
    badge.className = "badge " + (live ? "live" : "off");
    badge.querySelector(".txt").textContent = live ? "Available now" : "No Picks Available";

    $("liveState").classList.toggle("hidden", !live);
    $("offState").classList.toggle("hidden", live);

    if (live) {
      $("priceVal").textContent = Math.round((state.priceCents || 1000) / 100);
      $("liveDate").textContent = "Card for " + cardDateLabel(state);
      renderTracks(state);
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

  // Each track button is a native PayPal form submit. Validate the shared
  // email and copy it into that form's `custom` field before it goes.
  $("trackList").addEventListener("submit", (e) => {
    const email = $("email").value.trim();
    if (!email || !email.includes("@")) {
      e.preventDefault();
      showToast("Enter a valid email so we can send the PDF.");
      $("email").focus();
      return;
    }
    const custom = e.target.querySelector('input[name="custom"]');
    if (custom) custom.value = email;
  });

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
