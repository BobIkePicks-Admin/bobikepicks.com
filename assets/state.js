/* ===========================================================
   Shared demo state (browser-only, no backend).
   In the real build this is replaced by Supabase + PayPal.
   We use localStorage so the storefront and the admin page
   stay in sync — publish in admin, storefront flips to live.
   =========================================================== */

const BIP = {
  KEY: "bip_demo_state_v1",

  defaults() {
    return {
      status: "off",            // "live" | "off"
      pdfName: "",              // name of uploaded picks file
      publishedAt: null,        // ISO timestamp
      autoTakedown: "",         // "HH:MM" local time, or "" for none
      price: 10,
      sales: [
        { email: "jthompson@gmail.com", time: "2:14 PM", delivered: true },
        { email: "mary.ellis@yahoo.com", time: "1:58 PM", delivered: true },
        { email: "dlowry88@outlook.com", time: "1:31 PM", delivered: true }
      ]
    };
  },

  get() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.defaults();
      return { ...this.defaults(), ...JSON.parse(raw) };
    } catch {
      return this.defaults();
    }
  },

  set(patch) {
    const next = { ...this.get(), ...patch };
    localStorage.setItem(this.KEY, JSON.stringify(next));
    // notify same-tab listeners (storage event only fires cross-tab)
    window.dispatchEvent(new CustomEvent("bip:change", { detail: next }));
    return next;
  },

  reset() {
    localStorage.removeItem(this.KEY);
    window.dispatchEvent(new CustomEvent("bip:change", { detail: this.get() }));
  },

  onChange(fn) {
    window.addEventListener("bip:change", (e) => fn(e.detail));
    window.addEventListener("storage", (e) => {
      if (e.key === this.KEY) fn(this.get());
    });
  }
};
