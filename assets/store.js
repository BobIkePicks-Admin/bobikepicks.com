/* ===========================================================
   Storefront logic (live).
   Tabs let the buyer pick a track; the headline, bullets, and the
   PayPal buy button all update to the selected track. Only tracks
   with an uploaded file are shown (from /api/status).
   =========================================================== */

(function () {
  const $ = (id) => document.getElementById(id);

  // ---- Per-track card copy --------------------------------------------
  // KEY = the EXACT track name you type in the admin. Tracks not listed
  // here fall back to DEFAULT_BULLETS. To add copy for another track,
  // copy a block and change the name + bullet lines.
  const TRACK_CONTENT = {
    "Coast to Coast": [
      "Santa Anita/Gulfstream Park",
      "Low 15% takeout (retail bet only, no CAWs)",
      "Brief analysis of each race",
      "$1 Pick 5 ticket",
    ],
    "Breeders' Cup Day 1": [
      "Selections for BC races",
      "Best Plays",
      "Pick 5 ticket",
    ],
    "Breeders' Cup Day 2": [
      "Selections for BC races",
      "Best Plays",
      "Pick 5 ticket",
    ],
  };
  const DEFAULT_BULLETS = [
    "Full-card selections",
    "Best Play races with betting strategy",
    "Pick 5 ticket",
    "Emailed to you automatically after payment",
  ];
  // ---------------------------------------------------------------------

  let currentState = null;
  let selectedTrackId = null;
  let lastSig = "";

  function showToast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2800);
  }

  // Formatted date. Prefers the date Bob selected (parsed as a plain local
  // date to avoid off-by-one), else the publish date.
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

  // Look up a track's bullets forgivingly — a curly vs straight apostrophe,
  // extra spaces, or casing won't break the match; unknown tracks use default.
  function bulletsFor(name) {
    if (TRACK_CONTENT[name]) return TRACK_CONTENT[name];
    const norm = (s) => s.toLowerCase().replace(/[‘’']/g, "'").replace(/\s+/g, " ").trim();
    const key = Object.keys(TRACK_CONTENT).find((k) => norm(k) === norm(name));
    return key ? TRACK_CONTENT[key] : DEFAULT_BULLETS;
  }

  // Build one tab per available track. A single track shows no tab row
  // (the headline already names it).
  function renderTabs() {
    const tabs = $("trackTabs");
    tabs.innerHTML = "";
    const many = currentState.tracks.length > 1;
    tabs.style.display = many ? "flex" : "none";
    if (!many) return;

    currentState.tracks.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "track-tab" + (t.id === selectedTrackId ? " active" : "");
      b.textContent = t.name;
      b.dataset.id = t.id;
      b.addEventListener("click", () => {
        selectedTrackId = t.id;
        tabs.querySelectorAll(".track-tab").forEach((el) =>
          el.classList.toggle("active", el.dataset.id === t.id)
        );
        selectTrack(t.id);
      });
      tabs.appendChild(b);
    });
  }

  // Update the headline, bullets, and PayPal form for the chosen track.
  function selectTrack(id) {
    const state = currentState;
    const track = state.tracks.find((t) => t.id === id);
    if (!track) return;

    $("liveDate").textContent = track.name + " for " + cardDateLabel(state);

    const bullets = bulletsFor(track.name);
    $("trackBullets").innerHTML = bullets.map((b) => `<li>${attr(b)}</li>`).join("");

    const origin = window.location.origin;
    const dollars = Math.round((state.priceCents || 1000) / 100);
    $("ppItemName").value = "BobIkePicks — " + track.name;
    $("ppItemNumber").value = track.id;
    $("ppAmount").value = dollars.toFixed(2);
    $("ppNotify").value = origin + "/api/paypal-ipn";
    $("ppReturn").value = origin + "/thanks.html";
    $("ppCancel").value = origin + "/";
    $("payBtn").textContent = "Buy " + track.name + " — $" + dollars;
  }

  function render(state) {
    currentState = state;
    const hasTracks = Array.isArray(state.tracks) && state.tracks.length > 0;
    const live = state.status === "live" && hasTracks;

    const badge = $("statusBadge");
    badge.className = "badge " + (live ? "live" : "off");
    badge.querySelector(".txt").textContent = live ? "Available now" : "No Picks Available";

    $("liveState").classList.toggle("hidden", !live);
    $("offState").classList.toggle("hidden", live);

    if (!live) {
      lastSig = "off";
      return;
    }

    $("priceVal").textContent = Math.round((state.priceCents || 1000) / 100);

    // Only rebuild when the track set or date actually changes — so a 30s
    // poll doesn't yank the buyer off the tab they're looking at.
    const sig =
      "live:" + state.tracks.map((t) => t.id).join(",") + ":" + (state.picksDate || state.publishedAt || "");
    if (sig === lastSig) return;
    lastSig = sig;

    if (!state.tracks.some((t) => t.id === selectedTrackId)) {
      selectedTrackId = state.tracks[0].id;
    }
    renderTabs();
    selectTrack(selectedTrackId);
  }

  async function refresh() {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) throw new Error("status " + res.status);
      render(await res.json());
    } catch (err) {
      render({ status: "off" });
    }
  }

  // The buy button is a native PayPal form submit. Validate the shared
  // email and copy it into `custom` before it goes.
  $("buyForm").addEventListener("submit", (e) => {
    const email = $("email").value.trim();
    if (!email || !email.includes("@")) {
      e.preventDefault();
      showToast("Enter a valid email so we can send the PDF.");
      $("email").focus();
      return;
    }
    e.target.querySelector('input[name="custom"]').value = email;
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
