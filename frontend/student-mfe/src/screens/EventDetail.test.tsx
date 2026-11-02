import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../test/utils";
import { EventDetail } from "./EventDetail";

describe("S2 EventDetail", () => {
  afterEach(() => window.localStorage.clear());

  it("renders title, organiser, capacity and schedule from the API", async () => {
    renderWithProviders(<EventDetail />, { initialEntries: ["/events/evt-sparql"], path: "/events/:eventId" });
    expect(await screen.findByRole("heading", { name: "Intro to SPARQL Workshop" })).toBeInTheDocument();
    expect(screen.getByText("Semantic Web Study Group")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("Hands-on: querying the event graph")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();
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

  it("replaces Register with Join waitlist when full", async () => {
    renderWithProviders(<EventDetail />, { initialEntries: ["/events/evt-ethics"], path: "/events/:eventId" });
    expect(await screen.findByRole("button", { name: "Join waitlist" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Register" })).not.toBeInTheDocument();
  });

  it("disables registration for past events", async () => {
    renderWithProviders(<EventDetail />, { initialEntries: ["/events/evt-reception"], path: "/events/:eventId" });
    expect(await screen.findByRole("button", { name: "Event ended" })).toBeDisabled();
  });

  it("renders a designed 404 state for unknown events", async () => {
    renderWithProviders(<EventDetail />, { initialEntries: ["/events/nope"], path: "/events/:eventId" });
    expect(await screen.findByRole("heading", { name: "Event not found" })).toBeInTheDocument();
  });
});
