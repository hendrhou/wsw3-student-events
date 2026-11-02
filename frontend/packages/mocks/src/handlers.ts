import { http, HttpResponse } from "msw";
import { events, interests, myInterests, organiserEvents, recommendations, registrations, tickets } from "./fixtures";

/**
 * MSW handlers for the whole Kong gateway surface used by the MFEs.
 * Paths intentionally exclude the gateway prefix — both dev servers proxy
 * /api, and tests register these against any origin.
 */

function stripApi(path: string): string {
  return `*/${path.replace(/^\//, "")}`;
}

export const handlers = [
  http.get(stripApi("/api/events"), ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const category = url.searchParams.get("category") ?? "";
    // The discovery feed only lists upcoming events
    let result = events.filter((e) => !e.past);
    if (q) result = result.filter((e) => e.title.toLowerCase().includes(q));
    if (category) result = result.filter((e) => e.category === category);
    return HttpResponse.json(result.map(({ ...e }) => e));
  }),

  http.get(stripApi("/api/events/:id"), ({ params }) => {
    const event = events.find((e) => e.id === params.id);
    if (!event) return HttpResponse.json({ message: "Event not found" }, { status: 404 });
    return HttpResponse.json(event);
  }),

  http.get(stripApi("/api/recommendations/me"), () => HttpResponse.json(recommendations)),

  http.post(stripApi("/api/events/:id/register"), async ({ params }) => {
    const event = events.find((e) => e.id === params.id);
    if (!event) return HttpResponse.json({ message: "Event not found" }, { status: 404 });
    if (event.full) return HttpResponse.json({ message: "No seats left" }, { status: 409 });
    if (params.id === "evt-sparql") {
      return HttpResponse.json({ message: "Already registered" }, { status: 409 });
    }
    return HttpResponse.json({ bookingRef: "CP-2026-00999" }, { status: 201 });
  }),

  http.get(stripApi("/api/tickets"), () => HttpResponse.json(tickets)),

  http.get(stripApi("/api/tickets/:id/credential-status"), () => HttpResponse.json({ status: "Issued" })),

  http.get(stripApi("/api/ontology/interests"), ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    return HttpResponse.json(interests.filter((i) => i.label.toLowerCase().includes(q)));
  }),

  http.get(stripApi("/api/profile/interests"), () => HttpResponse.json(myInterests)),

  http.post(stripApi("/api/profile/interests"), async ({ request }) => {
    const body = (await request.json()) as { interests?: string[] };
    return HttpResponse.json({ saved: body.interests?.length ?? 0 });
  }),

  http.get(stripApi("/api/organiser/events"), () => HttpResponse.json(organiserEvents)),

  http.post(stripApi("/api/organiser/events"), () => HttpResponse.json({ id: "evt-new" }, { status: 201 })),

  http.patch(stripApi("/api/organiser/events/:id"), ({ params }) => HttpResponse.json({ id: params.id })),

  http.get(stripApi("/api/organiser/events/:id/registrations"), ({ request }) => {
    const url = new URL(request.url);
    const tab = url.searchParams.get("tab") ?? "registered";
    if (tab === "waitlist") return HttpResponse.json(registrations.filter((r) => r.status === "Waitlisted"));
    if (tab === "cancelled") return HttpResponse.json(registrations.filter((r) => r.status === "Cancelled"));
    return HttpResponse.json(registrations.filter((r) => r.status !== "Waitlisted" && r.status !== "Cancelled"));
  }),

  http.post(stripApi("/api/organiser/events/:id/check-in"), async ({ request }) => {
    const body = (await request.json()) as { vcToken?: string };
    if (!body.vcToken) return HttpResponse.json({ outcome: "invalid", detail: "Credential unreadable" }, { status: 200 });
    if (body.vcToken.includes("revoked")) {
      return HttpResponse.json({ outcome: "invalid", detail: "Credential revoked" });
    }
    if (body.vcToken.includes("seen")) {
      return HttpResponse.json({ outcome: "already_checked_in", name: "Ana Silva", studentNumber: "20220123", detail: "Checked in at 13:58" });
    }
    return HttpResponse.json({ outcome: "verified", name: "Ana Silva", studentNumber: "20220123" });
  }),

  http.get(stripApi("/api/organiser/events/:id/export.csv"), () => {
    const csv = "name,student_number,registered_at,status\nAna Silva,20220123,2026-10-01 14:22,Checked-in\n";
    return new HttpResponse(csv, { headers: { "Content-Type": "text/csv" } });
  }),
];
