import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, withEventId } from "../test/utils";
import { EventDetail as EventDetails, registerCtaState } from "./EventDetail";

const EventDetail = withEventId(EventDetails);

describe("registerCtaState (S2 button state machine)", () => {
  it.each([
    [{ full: false, past: false }, false, "register"],
    [{ full: false, past: false }, true, "registered"],
    [{ full: true, past: false }, false, "waitlist"],
    [{ full: false, past: true }, false, "ended"],
    [{ full: true, past: true }, false, "ended"],
  ] as const)("event=%o registered=%s → %s", (event, registered, expected) => {
    expect(registerCtaState(event, registered)).toBe(expected);
  });
});

describe("S2 EventDetail", () => {
  afterEach(() => window.localStorage.clear());

  it("renders title, organiser, capacity and schedule from the API", async () => {
    renderWithProviders(<EventDetail />, { initialEntries: ["/events/evt-sparql"], path: "/events/:eventId" });
    expect(await screen.findByRole("heading", { name: "Intro to SPARQL Workshop" })).toBeInTheDocument();
    expect(screen.getByText("Semantic Web Study Group")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("Hands-on: querying the event graph")).toBeInTheDocument();
  });

  it("shows semantic related events from the same category", async () => {
    renderWithProviders(<EventDetail />, { initialEntries: ["/events/evt-sparql"], path: "/events/:eventId" });
    expect(await screen.findByRole("heading", { name: "Related events" }, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "RDF Knowledge Graphs Lab" })).toBeInTheDocument();
  });

  it("hides the related section when no similar events exist", async () => {
    renderWithProviders(<EventDetail />, { initialEntries: ["/events/evt-careers"], path: "/events/:eventId" });
    expect(await screen.findByRole("heading", { name: "Careers Fair: Tech Edition" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Related events" })).not.toBeInTheDocument();
    });
  });

  it("renders host-composed actions without owning participation behaviour", async () => {
    renderWithProviders(<EventDetail actions={<button>Manage attendance</button>} />, { initialEntries: ["/events/evt-ethics"], path: "/events/:eventId" });
    expect(await screen.findByRole("button", { name: "Manage attendance" })).toBeInTheDocument();
  });

  it("renders a designed 404 state for unknown events", async () => {
    renderWithProviders(<EventDetail />, { initialEntries: ["/events/nope"], path: "/events/:eventId" });
    expect(await screen.findByRole("heading", { name: "Event not found" })).toBeInTheDocument();
  });
});
