/**
 * initRegistry.js — Auto-initializer for window.REGISTRY
 * Creates a global REGISTRY alias so legacy code in shared.js/admin.html continues working.
 */
var REGISTRY = null; // Defines global REGISTRY variable to prevent 'REGISTRY is not defined' errors

(function () {
  const CACHE_KEY = "APP_REGISTRY";
  
  let resolveReady;
  window.registryReady = new Promise((resolve) => {
    resolveReady = resolve;
  });

  // 1. Synchronous attempt from sessionStorage
  let cachedData = null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) cachedData = JSON.parse(raw);
  } catch (e) {
    sessionStorage.removeItem(CACHE_KEY);
  }

  if (cachedData) {
    window.REGISTRY = cachedData;
    REGISTRY = cachedData;
    resolveReady(window.REGISTRY);
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
        REGISTRY = data.registry; // Keep global alias in sync
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data.registry));
        resolveReady(window.REGISTRY);
      } else {
        throw new Error(data.error || "Invalid registry response from Gateway");
      }
    } catch (err) {
      console.error("initRegistry: Failed to sync registry from Gateway:", err);
      resolveReady(window.REGISTRY || null);
    }
  }

  syncRegistry();
})();