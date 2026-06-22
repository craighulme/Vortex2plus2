const fet = fetch;
const allowedHosts = new Set([
    "playvortex.io",
    "vortex.towerstats.com",
    "raw.githubusercontent.com"
]);

window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const type = event.data?.type;
    if (typeof type !== "string") return;
    if (!type.startsWith("fetch") || type.endsWith("Response")) return;

    const respond = (payload) => window.postMessage({ type: `${type}Response`, payload }, location.origin);

    try {
        const url = new URL(event.data.payload1, location.href);
        const method = String(event.data.payload2?.method || "GET").toUpperCase();
        if (!["GET", "HEAD"].includes(method)) throw new Error("blocked method");
        if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) throw new Error("blocked host");

        const fetched = await fet(url.href, {
            method,
            cache: "no-store",
            credentials: "omit",
            headers: { accept: String(event.data.payload2?.headers?.accept || "*/*").slice(0, 120) }
        });
        const text = method === "HEAD" ? "" : await fetched.text();
        let json = null;
        try {
            json = JSON.parse(text);
        } catch {}
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
            statusText: String(err && err.message || err),
            headers: [],
            body: "",
            bodyJson: null,
            url: String(event.data.payload1 || ""),
            type: "error"
        });
    }
});
