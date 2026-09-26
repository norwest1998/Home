/**
 * initRegistry.js — Auto-initializer for window.REGISTRY
 * Instantly populates window.REGISTRY from sessionStorage if available,
 * and background-syncs or fetches from the Gateway endpoint.
 */
(function () {
  const CACHE_KEY = "APP_REGISTRY";
  
  let resolveReady;
  window.registryReady = new Promise((resolve) => {
    resolveReady = resolve;
  });

  // 1. Synchronous attempt: Populate window.REGISTRY immediately on script load
  let cachedData = null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) cachedData = JSON.parse(raw);
  } catch (e) {
    sessionStorage.removeItem(CACHE_KEY);
  }

  if (cachedData) {
    window.REGISTRY = cachedData;
    resolveReady(window.REGISTRY); // Unblocks any await window.registryReady calls instantly
  }

  // 2. Fetch fresh registry from Apps Script Gateway
  async function syncRegistry() {
    if (typeof GATEWAY_URL === "undefined") {
      console.warn("initRegistry: GATEWAY_URL is undefined. Ensure config.js is loaded first.");
      if (!window.REGISTRY) resolveReady(null);
      return;
    }

    try {
      const res = await fetch(`${GATEWAY_URL}?action=getRegistry`);
      const data = await res.json();

      if (data && data.registry) {
        window.REGISTRY = data.registry;
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data.registry));
        resolveReady(window.REGISTRY);
      } else {
        throw new Error(data.error || "Invalid registry response");
      }
    } catch (err) {
      console.error("initRegistry: Failed to sync registry from Gateway:", err);
      // Resolve promise with whatever cache we had (or null) so waiting scripts don't hang indefinitely
      resolveReady(window.REGISTRY || null);
    }
  }

  // Execute network sync (background update if cached, primary fetch if cold start)
  syncRegistry();
})();