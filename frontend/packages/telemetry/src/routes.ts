const routes = [
  "/", "/login", "/auth/callback", "/events", "/events/:id", "/recommendations", "/tickets", "/profile",
  "/organiser", "/organiser/events", "/organiser/events/new", "/organiser/events/:id", "/organiser/events/:id/edit",
  "/organiser/events/:id/registrations", "/organiser/events/:id/check-in", "/organiser/team", "/team",
  "/api/auth/dev-login", "/api/auth/logout", "/api/auth/me", "/api/profile", "/api/profile/interests", "/api/events",
  "/api/events/:id", "/api/events/:id/register", "/api/tickets", "/api/tickets/:id", "/api/tickets/verify",
  "/api/recommendations", "/api/recommendations/me", "/api/ontology/interests", "/api/organiser/events", "/api/organiser/events/:id",
  "/api/organiser/events/:id/registrations", "/api/organiser/events/:id/check-in", "/api/organiser/events/:id/export.csv",
  "/api/admin/organisers", "/api/admin/organisers/:id",
];

export function normalizeRoute(path: string): string {
  const pathname = path.split(/[?#]/)[0];
  return routes.find((route) => route === pathname)
    ?? routes.find((route) => new RegExp(`^${route.replaceAll(".", "\\.").replaceAll(":id", "[^/]+")}$`).test(pathname))
    ?? "unmatched";
}

export function surface(path = location.pathname): string {
  if (path.startsWith("/organiser") || path === "/team") return "organiser-mfe";
  if (["/login", "/auth/callback", "/"].includes(path)) return "shell";
  return "student-mfe";
}