/**
 * initRegistry.js — Auto-initializer for window.REGISTRY
 */
var REGISTRY = null;

(function () {
  const CACHE_KEY = "APP_REGISTRY";

  // Helper to ensure REGISTRY is always an Array so .find() works
  function normalizeRegistry(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
      return Object.keys(data).map(key => ({ [key]: data[key] }));
    }
    return [];
  }

  let resolveReady;
  window.registryReady = new Promise((resolve) => {
    resolveReady = resolve;
  });

  // 1. Load from sessionStorage
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const normalized = normalizeRegistry(parsed);
      window.REGISTRY = normalized;
      REGISTRY = normalized;
      resolveReady(normalized);
    }
  } catch (e) {
    sessionStorage.removeItem(CACHE_KEY);
  }

  // 2. Sync from Apps Script Gateway
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
        const normalized = normalizeRegistry(data.registry);
        window.REGISTRY = normalized;
        REGISTRY = normalized;
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(normalized));
        resolveReady(normalized);
      } else {
        throw new Error(data.error || "Invalid registry response");
      }
    } catch (err) {
      console.error("initRegistry: Failed to sync registry from Gateway:", err);
      resolveReady(window.REGISTRY || null);
    }
  }

  syncRegistry();
})();