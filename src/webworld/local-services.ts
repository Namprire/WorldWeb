/**
 * Local service adapter for the user-authorized WEBWORLD client derivative.
 * This is not recovered original TypeScript or an implementation of its servers.
 */
type Score = { handle: string; score: number; avatar: string };
const storageKey = "starry-local-scores-v1";
const diagnostics = {
  apiCalls: [] as { path: string; method: string }[],
  blockedSockets: 0,
  blockedExternalFetches: 0,
  blockedBeacons: 0,
};
function scores(): Score[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(data)
      ? data.filter(
          (x): x is Score =>
            !!x && typeof x.handle === "string" && typeof x.score === "number",
        )
      : [];
  } catch {
    return [];
  }
}
function board() {
  const top = scores()
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);
  return { top, count: scores().length };
}
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
const originalFetch = window.fetch.bind(window);
window.fetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const request = input instanceof Request ? input : null;
  const url = new URL(request?.url ?? String(input), location.href);
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  if (url.origin !== location.origin) {
    diagnostics.blockedExternalFetches++;
    return json(
      {
        ok: false,
        message: "External services are disabled in the local reproduction.",
      },
      503,
    );
  }
  if (
    !url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/_vercel/insights/")
  )
    return originalFetch(input, init);
  diagnostics.apiCalls.push({ path: url.pathname, method });
  if (url.pathname.startsWith("/_vercel/insights/"))
    return new Response(null, { status: 204 });
  if (
    url.pathname === "/api/sync" ||
    url.pathname === "/api/status" ||
    /^\/api\/(startups|signals|search|ask|connections|monitors)(\/|$)/.test(url.pathname)
  )
    return originalFetch(input, init);
  if (url.pathname === "/api/presence")
    return json({ count: 1, best: board().top[0]?.score ?? 0 });
  if (url.pathname === "/api/talk")
    return json(
      {
        ok: false,
        message: "Interactive online conversations are not available locally.",
      },
      503,
    );
  if (url.pathname !== "/api/leaderboard")
    return json({ ok: false, message: "Unknown local endpoint" }, 404);
  if (method === "GET") return json(board());
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(
      typeof init?.body === "string"
        ? init.body
        : request
          ? await request.clone().text()
          : "{}",
    );
  } catch {
    return json({ ok: false, message: "Invalid local request" }, 400);
  }
  if (data.action === "start")
    return json({ ok: true, token: "local-only-no-server-session" });
  const handle = String(data.handle ?? "").replace(/^@+/, "");
  const score = Number(data.score);
  if (
    !/^[A-Za-z0-9_]{1,15}$/.test(handle) ||
    !Number.isFinite(score) ||
    score < 0
  )
    return json(
      { ok: false, message: "Enter a valid local name and score." },
      400,
    );
  const all = scores();
  const old = all.find((s) => s.handle.toLowerCase() === handle.toLowerCase());
  const best = Math.max(old?.score ?? 0, Math.floor(score));
  const next = all.filter((s) => s !== old);
  next.push({ handle, score: best, avatar: "/local-avatar.svg" });
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    return json({ ok: false, message: "Browser storage is unavailable." }, 507);
  }
  const rank =
    next
      .sort((a, b) => b.score - a.score)
      .findIndex((s) => s.handle === handle) + 1;
  return json({ ok: true, handle, best, rank, ...board() });
};
class DisabledSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readyState = 3;
  bufferedAmount = 0;
  extensions = "";
  protocol = "";
  binaryType: BinaryType = "blob";
  onopen: ((ev: Event) => unknown) | null = null;
  onclose: ((ev: CloseEvent) => unknown) | null = null;
  onerror: ((ev: Event) => unknown) | null = null;
  onmessage: ((ev: MessageEvent) => unknown) | null = null;
  constructor(public readonly url: string) {
    super();
    diagnostics.blockedSockets++;
    queueMicrotask(() => this.close());
  }
  send() {
    throw new DOMException(
      "Online multiplayer is disabled locally.",
      "InvalidStateError",
    );
  }
  close() {
    const event = new CloseEvent("close", {
      code: 1000,
      reason: "local single-player mode",
      wasClean: true,
    });
    this.onclose?.(event);
    this.dispatchEvent(event);
  }
}
window.WebSocket = DisabledSocket as unknown as typeof WebSocket;
navigator.sendBeacon = () => {
  diagnostics.blockedBeacons++;
  return true;
};
// The analytics loader sees an existing script element and does not add its SDK.
const analyticsPlaceholder = document.createElement("script");
analyticsPlaceholder.type = "application/json";
analyticsPlaceholder.src = "/_vercel/insights/script.js";
document.head.appendChild(analyticsPlaceholder);
Object.defineProperty(window, "va", {
  value: () => {},
  writable: true,
  configurable: true,
});
Object.defineProperty(window, "__localReproduction", { value: diagnostics });

export {};
