export function injectMapLoader(documentRef: Document = document, locationRef: Location = location): void {
  const url = new URL(locationRef.href);
  if (!url.searchParams.get("Play")) return;

  const scriptUrl = extensionUrl("extension/page-world/map-loader.js");
  if (documentRef.querySelector(`script[src="${scriptUrl}"]`)) return;

  const script = documentRef.createElement("script");
  script.src = scriptUrl;
  script.async = false;
  script.type = "text/javascript";
  documentRef.documentElement.appendChild(script);
}

function extensionUrl(path: string): string {
  const api = (globalThis as typeof globalThis & { browser?: MinimalExtensionApi; chrome?: MinimalExtensionApi }).chrome
    || (globalThis as typeof globalThis & { browser?: MinimalExtensionApi; chrome?: MinimalExtensionApi }).browser;
  if (!api?.runtime?.getURL) throw new Error("extension runtime API is unavailable");
  return api.runtime.getURL(path);
}
