export function applyInitialTheme(storage: Pick<Storage, "getItem"> = localStorage, root: HTMLElement = document.documentElement): void {
  if (storage.getItem("theme") === "light") root.setAttribute("theme", "light");
}
