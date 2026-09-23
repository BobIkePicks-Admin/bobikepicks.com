/* ===========================================================
   Admin logic (live).
   Magic-link login via Supabase Auth, then talks to the /api/admin
   endpoints to upload the PDF, publish / take down, and list sales.
   =========================================================== */

(function () {
  const $ = (id) => document.getElementById(id);
  const cfg = window.BIP_CONFIG;
  const supa = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

  let currentState = null;
  let appStarted = false;

  function showToast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 3200);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
  }

  // ---------- views ----------
  function showLogin() {
    $("loginView").classList.remove("hidden");
    $("appView").classList.add("hidden");
    $("logoutBtn").classList.add("hidden");
  }
  function showApp(email) {
    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    $("logoutBtn").classList.remove("hidden");
    $("whoami").textContent = email;
  }

  // ---------- authenticated fetch ----------
  async function authFetch(path, opts = {}) {
    const { data } = await supa.auth.getSession();
    const token = data.session ? data.session.access_token : null;
    const res = await fetch(path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        ...(opts.headers || {}),
      },
    });
    if (res.status === 401) {
      showLogin();
      throw new Error("Your session expired — sign in again.");
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Error " + res.status);
    return body;
  }

  // ---------- login ----------
  $("loginBtn").addEventListener("click", async () => {
    const email = $("loginEmail").value.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      showToast("Enter your email.");
      return;
    }
    if (cfg.ADMIN_EMAILS && !cfg.ADMIN_EMAILS.includes(email)) {
      showToast("That email isn't set up for admin access.");
      return;
    }
    $("loginBtn").disabled = true;
    try {
      const { error } = await supa.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + "/admin.html" },
      });
      if (error) throw error;
      $("loginMsg").textContent =
        "Check your email for a login link, then click it. You can close this tab afterward.";
    } catch (err) {
      showToast(err.message || "Could not send the link.");
    } finally {
      $("loginBtn").disabled = false;
    }
  });

  $("logoutBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    await supa.auth.signOut();
    showLogin();
  });

  // ---------- tracks ----------
  let uploadTargetTrackId = null;

  function renderTracks(tracks) {
    const body = $("tracksBody");
    body.innerHTML = "";
    (tracks || []).forEach((t) => {
      const tr = document.createElement("tr");
      const fileCell = t.pdf_name
        ? `<span class="pill">✓ ${esc(t.pdf_name)}</span> ` +
          `<button class="btn btn-ghost btn-sm" data-action="upload" data-id="${t.id}">Replace</button> ` +
          `<button class="btn btn-ghost btn-sm" data-action="clear" data-id="${t.id}">Remove</button>`
        : `<button class="btn btn-primary btn-sm" data-action="upload" data-id="${t.id}">Upload PDF</button>`;
      tr.innerHTML =
        `<td><strong>${esc(t.name)}</strong></td>` +
        `<td>${fileCell}</td>` +
        `<td style="text-align:right;"><button class="btn btn-ghost btn-sm" data-action="delete" data-id="${t.id}" title="Delete track">🗑</button></td>`;
      body.appendChild(tr);
    });
  }

  $("tracksBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const action = btn.getAttribute("data-action");

    if (action === "upload") {
      uploadTargetTrackId = id;
      $("trackFileInput").click();
      return;
    }
    if (action === "clear") {
      btn.disabled = true;
      try {
        await authFetch("/api/admin/track-clear", { method: "POST", body: JSON.stringify({ id }) });
        showToast("File removed — track is no longer for sale.");
        await loadState();
      } catch (err) {
        showToast(err.message);
        btn.disabled = false;
      }
      return;
    }
    if (action === "delete") {
      if (!window.confirm("Delete this track (and its file)?")) return;
      btn.disabled = true;
      try {
        await authFetch("/api/admin/track-delete", { method: "POST", body: JSON.stringify({ id }) });
        showToast("Track deleted.");
        await loadState();
      } catch (err) {
        showToast(err.message);
        btn.disabled = false;
      }
    }
  });

  $("trackFileInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    const id = uploadTargetTrackId;
    if (!file || !id) return;
    if (file.type !== "application/pdf") {
      showToast("Please choose a PDF file.");
      $("trackFileInput").value = "";
      return;
    }
    showToast("Uploading " + file.name + "…");
    try {
      const contentBase64 = await fileToBase64(file);
      await authFetch("/api/admin/track-upload", {
        method: "POST",
        body: JSON.stringify({ id, filename: file.name, contentBase64 }),
      });
      showToast("Uploaded: " + file.name);
      await loadState();
    } catch (err) {
      showToast(err.message);
    } finally {
      $("trackFileInput").value = "";
      uploadTargetTrackId = null;
    }
  });

  $("addTrackBtn").addEventListener("click", async () => {
    const name = $("newTrackName").value.trim();
    if (!name) {
      showToast("Enter a track name.");
      return;
    }
    $("addTrackBtn").disabled = true;
    try {
      await authFetch("/api/admin/track-add", { method: "POST", body: JSON.stringify({ name }) });
      showToast("Added " + name + ".");
      $("newTrackName").value = "";
      await loadState();
    } catch (err) {
      showToast(err.message);
    } finally {
      $("addTrackBtn").disabled = false;
    }
  });

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = () => reject(new Error("Could not read the file."));
      r.readAsDataURL(file);
    });
  }

  // ---------- publish / takedown ----------
  function computeAutoTakedown(hhmm) {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(":").map(Number);
    const cutoff = new Date();
    cutoff.setHours(h, m, 0, 0);
    if (cutoff <= new Date()) cutoff.setDate(cutoff.getDate() + 1);
    return cutoff.toISOString();
  }

  function todayYMD() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // Pre-fill the picks-date field once (uses the stored date, else today).
  function prefillPicksDate() {
    const input = $("picksDate");
    if (currentState && currentState.picks_date) input.value = currentState.picks_date;
    else if (!input.value) input.value = todayYMD();
  }

  $("publishBtn").addEventListener("click", async () => {
    $("publishBtn").disabled = true;
    try {
      const autoTakedownAt = computeAutoTakedown($("autoTime").value);
      const picksDate = $("picksDate").value || null;
      const { state } = await authFetch("/api/admin/publish", {
        method: "POST",
        body: JSON.stringify({ autoTakedownAt, picksDate }),
      });
      currentState = state;
      renderState();
      showToast("Picks are LIVE — buyers can purchase now.");
    } catch (err) {
      showToast(err.message);
    } finally {
      $("publishBtn").disabled = false;
    }
  });

  $("takedownBtn").addEventListener("click", async () => {
    $("takedownBtn").disabled = true;
    try {
      const { state } = await authFetch("/api/admin/takedown", { method: "POST" });
      currentState = state;
      renderState();
      showToast("Picks taken down — store is closed.");
    } catch (err) {
      showToast(err.message);
    } finally {
      $("takedownBtn").disabled = false;
    }
  });

  $("testBtn").addEventListener("click", async () => {
    $("testBtn").disabled = true;
    try {
      const { sentTo } = await authFetch("/api/admin/test-email", { method: "POST" });
      showToast("Test email sent to " + sentTo + " — check your inbox (and spam).");
    } catch (err) {
      showToast(err.message);
    } finally {
      $("testBtn").disabled = false;
    }
  });

  $("copyEmailsBtn").addEventListener("click", async () => {
    $("copyEmailsBtn").disabled = true;
    try {
      const { emails } = await authFetch("/api/admin/subscribers");
      if (!emails || !emails.length) {
        showToast("No subscribers yet.");
        return;
      }
      const text = emails.join("; ");
      try {
        await navigator.clipboard.writeText(text);
        showToast(`Copied ${emails.length} email${emails.length > 1 ? "s" : ""} to clipboard.`);
      } catch {
        window.prompt("Copy these emails:", text);
      }
    } catch (err) {
      showToast(err.message);
    } finally {
      $("copyEmailsBtn").disabled = false;
    }
  });

  $("addSubBtn").addEventListener("click", async () => {
    const emails = $("addEmails").value.trim();
    if (!emails) {
      showToast("Enter at least one email.");
      return;
    }
    $("addSubBtn").disabled = true;
    try {
      const { added, invalid } = await authFetch("/api/admin/add-subscribers", {
        method: "POST",
        body: JSON.stringify({ emails }),
      });
      let msg = `Added ${added} to the list.`;
      if (invalid && invalid.length) msg += ` (${invalid.length} skipped as invalid.)`;
      showToast(msg);
      $("addEmails").value = "";
      await loadState();
    } catch (err) {
      showToast(err.message);
    } finally {
      $("addSubBtn").disabled = false;
    }
  });

  // ---------- render ----------
  function renderState() {
    const s = currentState;
    if (!s) return;
    const live = s.status === "live";

    const banner = $("banner");
    banner.className = "status-banner " + (live ? "live" : "off");
    $("bannerDot").textContent = live ? "🟢" : "🔴";
    $("bannerText").textContent = live ? "Picks are LIVE" : "Picks are OFF";

    $("publishBtn").classList.toggle("hidden", live);
    $("takedownBtn").classList.toggle("hidden", !live);
    updateCountdown();
  }

  function updateCountdown() {
    const s = currentState;
    const el = $("bannerCountdown");
    if (!s || s.status !== "live" || !s.auto_takedown_at) {
      el.innerHTML = "";
      return;
    }
    const diff = Math.floor((new Date(s.auto_takedown_at) - new Date()) / 1000);
    if (diff <= 0) {
      el.innerHTML = "";
      loadState().catch(() => {});
      return;
    }
    const hrs = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;
    const pad = (n) => String(n).padStart(2, "0");
    el.innerHTML =
      '<span class="countdown">⏱ Auto-closes in ' +
      (hrs > 0 ? hrs + "h " : "") +
      pad(mins) + "m " + pad(secs) + "s</span>";
  }

  function renderSales(sales) {
    const body = $("salesBody");
    body.innerHTML = "";
    (sales || []).forEach((sale) => {
      const tr = document.createElement("tr");
      const t = new Date(sale.created_at).toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
      tr.innerHTML =
        "<td>" + esc(sale.email) + "</td>" +
        "<td>" + esc(sale.track_name || "—") + "</td>" +
        "<td>" + t + "</td>" +
        "<td>" +
        (sale.delivered
          ? '<span class="pill">delivered ✓</span>'
          : '<span class="muted">pending</span>') +
        "</td>" +
        '<td style="text-align:right;"><button class="btn btn-ghost btn-sm" disabled title="Available once email delivery is set up">resend</button></td>';
      body.appendChild(tr);
    });
    $("salesCount").textContent = (sales ? sales.length : 0) + " recent";
  }

  // ---------- load ----------
  async function loadState() {
    const data = await authFetch("/api/admin/state");
    currentState = data.state;
    renderSales(data.sales);
    renderTracks(data.tracks);
    $("subCount").textContent = (data.subscriberCount || 0) + " subscribers";
    renderState();
  }

  // ---------- init ----------
  async function enterApp(session) {
    const email = (session.user.email || "").toLowerCase();
    if (cfg.ADMIN_EMAILS && !cfg.ADMIN_EMAILS.includes(email)) {
      await supa.auth.signOut();
      showLogin();
      $("loginMsg").textContent = "That account isn't authorized for the admin.";
      return;
    }
    showApp(session.user.email);
    if (appStarted) {
      loadState().catch((err) => showToast(err.message));
      return;
    }
    appStarted = true;
    try {
      await loadState();
    } catch (err) {
      showToast(err.message);
    }
    prefillPicksDate();
    setInterval(updateCountdown, 1000);
    setInterval(() => loadState().catch(() => {}), 30000);
  }

  supa.auth.onAuthStateChange((_event, session) => {
    if (session && session.user) enterApp(session);
    else {
      appStarted = false;
      showLogin();
    }
  });

  (async function init() {
    const { data } = await supa.auth.getSession();
    if (data.session && data.session.user) enterApp(data.session);
    else showLogin();
  })();
})();
