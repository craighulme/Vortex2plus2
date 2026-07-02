export const FRIEND_ICON = '<i class="fa-solid fa-user lb-friend-icon"></i>';
export const STAFF_ICON = '<i class="fa-solid fa-shield-halved lb-staff-icon"></i>';
export const MOD_ICON = '<i class="fa-solid fa-gavel lb-mod-icon"></i>';
export const BOOST_ICON =
  '<svg class="lb-boost-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="#FF4DA5" d="M12.4801 1.42383C12.202 1.19206 11.798 1.19206 11.5199 1.42383L5.51986 6.42383C5.34887 6.56633 5.25 6.77742 5.25 7V17C5.25 17.2226 5.34887 17.4337 5.51986 17.5762L11.5199 22.5762C11.798 22.8079 12.202 22.8079 12.4801 22.5762L18.4801 17.5762C18.6511 17.4337 18.75 17.2226 18.75 17V7C18.75 6.77742 18.6511 6.56633 18.4801 6.42383L12.4801 1.42383Z"/><path fill="#ECEFF1" fill-rule="evenodd" d="M11.4932 5.44713C11.7799 5.18429 12.2201 5.18429 12.5068 5.44713L15.5068 8.19713C15.6618 8.33919 15.75 8.53977 15.75 8.75V15.25C15.75 15.4602 15.6618 15.6608 15.5068 15.8029L12.5068 18.5529C12.2201 18.8157 11.7799 18.8157 11.4932 18.5529L8.49321 15.8029C8.33823 15.6608 8.25 15.4602 8.25 15.25V8.75C8.25 8.53977 8.33823 8.33919 8.49321 8.19713L11.4932 5.44713ZM9.75 9.07993V14.9201L12 16.9826L14.25 14.9201V9.07993L12 7.01743L9.75 9.07993Z" clip-rule="evenodd"/><path fill="#E54594" fill-rule="evenodd" d="M12 1.25V22.75C11.8295 22.75 11.6589 22.6921 11.5199 22.5762L5.51986 17.5762C5.34887 17.4337 5.25 17.2226 5.25 17V7C5.25 6.77742 5.34887 6.56633 5.51986 6.42383L11.5199 1.42383C11.6589 1.30794 11.8295 1.25 12 1.25Z" clip-rule="evenodd"/><path fill="#D4D6D8" fill-rule="evenodd" d="M12 5.25C11.8183 5.25 11.6366 5.31571 11.4932 5.44713L8.49321 8.19713C8.33823 8.33919 8.25 8.53977 8.25 8.75V15.25C8.25 15.4602 8.33823 15.6608 8.49321 15.8029L11.4932 18.5529C11.6366 18.6843 11.8183 18.75 12 18.75V16.9826L9.75 14.9201V9.07993L12 7.01743V5.25Z" clip-rule="evenodd"/></svg>';

export function badgeDescription(badge: unknown): string {
  const kind = String((badge as { kind?: unknown } | null)?.kind || "community");
  if (kind === "developer") return "Project developer badge";
  if (kind === "sponsor") return "Monthly project sponsor badge";
  if (kind === "supporter") return "One-time project supporter badge";
  if (kind === "contributor") return "Code, design, testing, or community contribution badge";
  return "Community recognition badge";
}

export function badgeIcon(kind: unknown): string {
  if (kind === "developer") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.293 11.293l4-4a1 1 0 1 1 1.414 1.414L3.414 12l3.293 3.293a1 1 0 1 1-1.414 1.414l-4-4a1 1 0 0 1 0-1.414Zm17.414-4a1 1 0 1 0-1.414 1.414L20.586 12l-3.293 3.293a1 1 0 1 0 1.414 1.414l4-4a1 1 0 0 0 0-1.414ZM13.039 4.726l-4 14a1 1 0 0 0 .686 1.236A1.053 1.053 0 0 0 10 20a1 1 0 0 0 .961-.726l4-14a1 1 0 1 0-1.922-.548Z"/></svg>';
  if (kind === "sponsor") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.269 4.411c.232-.519.347-.779.509-.859a.5.5 0 0 1 .444 0c.161.08.277.34.508.859l1.845 4.137c.068.154.102.23.155.289a.5.5 0 0 0 .168.122c.073.032.156.041.323.059l4.505.475c.565.06.848.09.974.218a.5.5 0 0 1 .137.423c-.026.178-.237.368-.66.749l-3.365 3.032c-.124.113-.187.169-.226.237a.5.5 0 0 0-.065.198c-.008.079.01.161.045.326l.939 4.43c.118.557.177.835.094.994a.5.5 0 0 1-.36.261c-.177.03-.423-.112-.916-.396L12.4 17.702c-.146-.084-.219-.125-.296-.142a.5.5 0 0 0-.208 0c-.077.017-.15.058-.296.142l-3.923 2.263c-.493.284-.739.426-.917.397a.5.5 0 0 1-.359-.262c-.083-.159-.024-.437.094-.994l.939-4.43c.035-.165.053-.247.044-.326a.5.5 0 0 0-.064-.198c-.04-.068-.102-.124-.227-.237l-3.365-3.032c-.422-.38-.633-.57-.659-.749a.5.5 0 0 1 .137-.423c.126-.128.409-.158.974-.218l4.504-.475c.168-.018.252-.027.324-.059a.5.5 0 0 0 .168-.122c.053-.059.087-.135.155-.289l1.844-4.137Z"/></svg>';
  if (kind === "supporter") return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.243 8.243 8 15l6.757-6.757A4.243 4.243 0 0 0 16 5.243v-.191A4.052 4.052 0 0 0 11.948 1a4.052 4.052 0 0 0-3.165 1.521L8 3.5l-.783-.979A4.052 4.052 0 0 0 4.052 1 4.052 4.052 0 0 0 0 5.052v.191c0 1.125.447 2.204 1.243 3Z"/></svg>';
  if (kind === "contributor") return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 13.058.442A4.981 4.981 0 0 0 11 0a5 5 0 0 0-5 5c0 .458.062.902.177 1.323L0 12.5 3.5 16l6.177-6.177c.421.115.865.177 1.323.177a5 5 0 0 0 4.558-7.058L12.5 6H10V3.5Z"/></svg>';
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M3 18c0-2.606 1.661-4.823 3.982-5.652A5.987 5.987 0 0 1 9 12c.708 0 1.388.123 2.018.348.343.122.671.275.982.455.311-.18.639-.333.982-.455A5.987 5.987 0 0 1 15 12c.708 0 1.388.123 2.018.348C19.339 13.177 21 15.394 21 18v3h-5.25v-1.5h3.75V18a4.5 4.5 0 0 0-6.188-4.173A5.983 5.983 0 0 1 15 18v3H3v-3Zm6-6.75a3.75 3.75 0 1 1 3-6 3.75 3.75 0 1 1 1.111 5.49A3.74 3.74 0 0 1 12 9.75a3.74 3.74 0 0 1-1.111.99A3.73 3.73 0 0 1 9 11.25ZM13.5 18v1.5h-9V18a4.5 4.5 0 0 1 9 0Zm-2.25-10.5a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0ZM15 5.25a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/></svg>';
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeAttr(value: unknown): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

export function cssUrl(value: unknown): string {
  return String(value || "").replace(/["'\\\n\r]/g, "");
}
