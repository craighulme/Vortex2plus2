//Made by inuk
(() => {
  const u = new URL(location.href);
  if (!u.searchParams.get('Play') && !u.searchParams.get('V22GameId')) return;

  const extensionApi = globalThis.chrome || globalThis.browser;
  const scriptURL = extensionApi.runtime.getURL('js/features/MapLoader.js');
  if (document.querySelector(`script[src="${scriptURL}"]`)) return;

  const script = document.createElement('script');
  script.src = scriptURL;
  script.async = true;
  script.type = 'text/javascript';
  document.documentElement.appendChild(script);
})();
