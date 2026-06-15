const fet = fetch;
window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const type = event.data?.type;
    if (typeof type !== 'string') return;
    if (!type.startsWith('fetch') || type.endsWith('Response')) return;
    const url = new URL(event.data.payload1, location.href).href;
    const corsio = (url.startsWith("http") && !url.match('towerstats.com'));
    const fetched = corsio ? await (await fet("https://cors.io/?u=" + encodeURIComponent(url), event.data.payload2)).json() : await fet(url, event.data.payload2);
    const text = corsio ? fetched.body : await fetched.text();
    let json = null;
    try {
        json = JSON.parse(text);
    } catch (e) {console.warn(e)}
    window.postMessage({
        type: type + "Response",
        payload: {
            status: fetched.status,
            statusText: fetched.statusText,
            headers: corsio ? fetched.headers : [...fetched.headers.entries()],
            body: text,
            bodyJson:json,
            url: url,
            type: fetched.type,
        }
    }, "*");
});
