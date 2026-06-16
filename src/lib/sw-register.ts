// Lightweight inline service worker just for the /tools/emergency offline cache.
// Avoids vite-plugin-pwa to stay friendly with the Lovable preview iframe.

const SW_PATH = "/emergency-sw.js";

export function isPreviewOrIframe() {
  if (typeof window === "undefined") return true;
  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }
  const host = window.location.hostname;
  const isPreview =
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovable.app") ||
    host === "localhost";
  return inIframe || isPreview;
}

export async function registerEmergencySW() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (isPreviewOrIframe()) {
    // Aggressively unregister anything that might already be registered in preview
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    // Scope at root so it can also cache /guides/* pages.
    await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  } catch {
    /* silent - offline is a progressive enhancement */
  }
}
