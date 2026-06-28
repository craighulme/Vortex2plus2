const allowedHosts = new Set([
  "playvortex.io",
  "vortex.towerstats.com",
  "raw.githubusercontent.com"
]);

type FetchBridgeRequest = {
  type?: unknown;
  payload1?: unknown;
  payload2?: {
    method?: unknown;
    headers?: {
      accept?: unknown;
    };
  };
};

export function installFetchBridge(windowRef: Window = window, fetcher: typeof fetch = fetch): void {
  windowRef.addEventListener("message", async (event: MessageEvent<FetchBridgeRequest>) => {
    if (event.source !== windowRef) return;
    const type = event.data?.type;
    if (typeof type !== "string") return;
    if (!type.startsWith("fetch") || type.endsWith("Response")) return;

    const respond = (payload: unknown) => windowRef.postMessage({ type: `${type}Response`, payload }, windowRef.location.origin);

    try {
      const url = new URL(String(event.data.payload1 || ""), windowRef.location.href);
      const method = String(event.data.payload2?.method || "GET").toUpperCase();
      if (!["GET", "HEAD"].includes(method)) throw new Error("blocked method");
      if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) throw new Error("blocked host");

      const fetched = await fetcher(url.href, {
        method,
        cache: "no-store",
        credentials: "omit",
        headers: { accept: String(event.data.payload2?.headers?.accept || "*/*").slice(0, 120) }
      });
      const text = method === "HEAD" ? "" : await fetched.text();
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      respond({
        status: fetched.status,
        statusText: fetched.statusText,
        headers: [...fetched.headers.entries()],
        body: text,
        bodyJson: json,
        url: url.href,
        type: fetched.type
      });
    } catch (err) {
      respond({
        status: 0,
        statusText: String(err instanceof Error ? err.message : err),
        headers: [],
        body: "",
        bodyJson: null,
        url: String(event.data?.payload1 || ""),
        type: "error"
      });
    }
  });
}
