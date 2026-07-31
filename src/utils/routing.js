export const ROUTE_PAGES = ["overview", "pipeline", "vacancies", "interviews", "invoicing", "approvals", "archived", "team", "administration", "followups", "requests"];
export const ROUTE_ALIASES = { settings: "administration" };
const routeSet = new Set(ROUTE_PAGES);

export const pageFromPath = (path) => {
  const page = String(path || "").replace(/^\/+|\/+$/g, "");
  const resolved = ROUTE_ALIASES[page] || page;
  return routeSet.has(resolved) ? resolved : "overview";
};

export const pathFromPage = (page) => {
  const resolved = ROUTE_ALIASES[page] || page;
  return `/${routeSet.has(resolved) ? resolved : "overview"}`;
};
