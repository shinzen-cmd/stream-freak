/**
 * Stream Token Interceptor (NetflixAPI-inspired)
 * Listens to active network requests, iframe messages, and resource timings
 * to extract active .m3u8 stream URLs and dynamic session tokens (e.g., token=...).
 * Formats proxy-compatible stream URLs mirroring the handshake session context.
 */

export interface InterceptedStreamResult {
  streamUrl: string; // Formatted proxy URL: /api/proxy/stream?url=...&referer=...&sessionToken=...
  tokenizedM3u8: string;
  sessionToken: string;
  referer: string;
  userAgent: string;
  cookies?: string;
}

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Extracts session token from query parameters of a candidate stream URL
 */
export function extractSessionTokenFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.get("token") ||
      parsed.searchParams.get("sessionToken") ||
      parsed.searchParams.get("t") ||
      parsed.searchParams.get("key") ||
      parsed.searchParams.get("sig") ||
      parsed.searchParams.get("token2") ||
      parsed.searchParams.get("auth") ||
      ""
    );
  } catch {
    const match = url.match(/[?&](?:token|sessionToken|t|key|sig|token2)=([^&#\s]+)/i);
    return match ? decodeURIComponent(match[1]) : "";
  }
}

/**
 * Formats a clean proxy-compatible stream URL with encoded query parameters
 */
export function formatProxyStreamUrl(
  tokenizedM3u8: string,
  referer: string,
  sessionToken?: string
): string {
  const token = sessionToken || extractSessionTokenFromUrl(tokenizedM3u8);
  let proxy = `/api/proxy/stream?url=${encodeURIComponent(tokenizedM3u8)}&referer=${encodeURIComponent(referer)}`;
  if (token) {
    proxy += `&sessionToken=${encodeURIComponent(token)}`;
  }
  return proxy;
}

/**
 * Checks if a URL string looks like a valid active HLS playlist
 */
function isM3u8Url(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase();
  return (
    (lower.includes(".m3u8") || lower.includes("/hls/") || lower.includes("/master")) &&
    !lower.includes("google") &&
    !lower.includes("analytics") &&
    !lower.includes("tracking")
  );
}

/**
 * Scans browser performance resource entries for active .m3u8 requests
 */
function findM3u8FromPerformance(): string | null {
  if (typeof window === "undefined" || !window.performance?.getEntriesByType) {
    return null;
  }
  const resources = window.performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  // Scan newest to oldest
  for (let i = resources.length - 1; i >= 0; i--) {
    const name = resources[i]?.name;
    if (name && isM3u8Url(name)) {
      return name;
    }
  }
  return null;
}

/**
 * Intercept active stream token for an embed URL.
 * Checks active performance resource timings, browser storage, and network responses.
 */
export async function interceptStreamToken(
  embedUrl: string
): Promise<InterceptedStreamResult | null> {
  if (!embedUrl) return null;

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : DEFAULT_USER_AGENT;
  const cookies = typeof document !== "undefined" ? document.cookie : undefined;

  // 1. Check browser resource timings (if player iframe fired requests in browser)
  const perfUrl = findM3u8FromPerformance();
  if (perfUrl) {
    const token = extractSessionTokenFromUrl(perfUrl);
    return {
      streamUrl: formatProxyStreamUrl(perfUrl, embedUrl, token),
      tokenizedM3u8: perfUrl,
      sessionToken: token,
      referer: embedUrl,
      userAgent: ua,
      cookies,
    };
  }

  // 2. Check window/sessionStorage for any cached player stream manifests
  if (typeof window !== "undefined") {
    try {
      const keys = Object.keys(sessionStorage);
      for (const key of keys) {
        const val = sessionStorage.getItem(key);
        if (val && isM3u8Url(val)) {
          const token = extractSessionTokenFromUrl(val);
          return {
            streamUrl: formatProxyStreamUrl(val, embedUrl, token),
            tokenizedM3u8: val,
            sessionToken: token,
            referer: embedUrl,
            userAgent: ua,
            cookies,
          };
        }
      }
    } catch {}
  }

  // 3. Probe via server-side resolver with spoofed headers to capture initial handshake URL
  try {
    const res = await fetch(`/api/resolve?url=${encodeURIComponent(embedUrl)}`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      const rawCandidate = data.streamUrl || data.rawUrl;
      if (rawCandidate && isM3u8Url(rawCandidate)) {
        // If streamUrl is already proxied, extract underlying target
        let actualM3u8 = rawCandidate;
        if (rawCandidate.startsWith("/api/proxy/stream")) {
          const match = rawCandidate.match(/[?&]url=([^&]+)/);
          if (match) actualM3u8 = decodeURIComponent(match[1]);
        }

        const token = extractSessionTokenFromUrl(actualM3u8) || data.token || "";
        return {
          streamUrl: formatProxyStreamUrl(actualM3u8, embedUrl, token),
          tokenizedM3u8: actualM3u8,
          sessionToken: token,
          referer: embedUrl,
          userAgent: ua,
          cookies,
        };
      }
    }
  } catch {}

  return null;
}

/**
 * Attaches a continuous stream token observer to listen to active network traffic,
 * postMessage events from player iframes, and resource timings.
 * Returns an unbind function to detach all listeners.
 */
export function attachStreamInterceptor(
  embedUrl: string,
  onIntercepted: (result: InterceptedStreamResult) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  let isDestroyed = false;
  const ua = navigator.userAgent || DEFAULT_USER_AGENT;

  const handleInterceptedUrl = (candidateUrl: string) => {
    if (isDestroyed || !isM3u8Url(candidateUrl)) return;
    const token = extractSessionTokenFromUrl(candidateUrl);
    const cookies = document.cookie;
    onIntercepted({
      streamUrl: formatProxyStreamUrl(candidateUrl, embedUrl, token),
      tokenizedM3u8: candidateUrl,
      sessionToken: token,
      referer: embedUrl,
      userAgent: ua,
      cookies,
    });
  };

  // 1. Listen for iframe postMessage events (e.g. JWPlayer / Video.js / custom player handshakes)
  const messageListener = (event: MessageEvent) => {
    if (isDestroyed || !event.data) return;
    try {
      const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      const urlCandidate = data?.file || data?.url || data?.streamUrl || data?.src || data?.source;
      if (typeof urlCandidate === "string" && isM3u8Url(urlCandidate)) {
        handleInterceptedUrl(urlCandidate);
      }
    } catch {}
  };

  window.addEventListener("message", messageListener);

  // Hook XHR to catch iframe-leaked stream URLs
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method: string, url: any) {
    if (typeof url === 'string' && isM3u8Url(url)) {
      handleInterceptedUrl(url);
    }
    return origOpen.apply(this, arguments as any);
  };

  // Hook fetch to catch iframe-leaked stream URLs  
  const origFetch = window.fetch;
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as Request).url);
    if (typeof url === 'string' && isM3u8Url(url)) {
      handleInterceptedUrl(url);
    }
    return origFetch.apply(window, [input, init] as any);
  };

  // 2. Poll performance resource timings every 400ms for 12 seconds
  const startTime = Date.now();
  const pollInterval = setInterval(() => {
    if (isDestroyed || Date.now() - startTime > 12000) {
      clearInterval(pollInterval);
      return;
    }
    const found = findM3u8FromPerformance();
    if (found) {
      handleInterceptedUrl(found);
    }
  }, 400);

  // 3. Initial check
  interceptStreamToken(embedUrl).then((res) => {
    if (!isDestroyed && res) {
      onIntercepted(res);
    }
  });

  return () => {
    isDestroyed = true;
    window.removeEventListener("message", messageListener);
    clearInterval(pollInterval);
    XMLHttpRequest.prototype.open = origOpen;
    window.fetch = origFetch;
  };
}
