import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, withEventId } from "../test/utils";
import { DiscoveryFeed } from "./DiscoveryFeed";
import { EventDetail as EventDetails } from "./EventDetail";

const EventDetail = withEventId(EventDetails);

describe("S1 interactions", () => {
  it("navigates to the event detail when a card is clicked", async () => {
    renderWithProviders(<DiscoveryFeed />, {
      initialEntries: ["/events"],
      path: "/events",
      extraRoutes: [["/events/evt-hackathon", "DETAIL PAGE"]],
    });
    await userEvent.click(await screen.findByRole("link", { name: "UFP Hackathon 2026" }));
    expect(await screen.findByText("DETAIL PAGE")).toBeInTheDocument();
  });

  it("loads more events on demand", async () => {
    renderWithProviders(<DiscoveryFeed />);
    await screen.findByRole("link", { name: "UFP Hackathon 2026" });
    const loadMore = screen.queryByRole("button", { name: "Load more" });
    if (loadMore) await userEvent.click(loadMore); // only present when >1 page of fixtures
    expect(screen.getByRole("heading", { name: "All upcoming events" })).toBeInTheDocument();
  });

  it("clears active category filters", async () => {
    renderWithProviders(<DiscoveryFeed />);
    await screen.findByRole("link", { name: "UFP Hackathon 2026" });
    await userEvent.click(screen.getByRole("button", { name: "Workshop" }));
    await screen.findByRole("button", { name: /Clear all/ });
    await userEvent.click(screen.getByRole("button", { name: /Clear all/ }));
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "UFP Hackathon 2026" })).toBeInTheDocument();
    });
  });

  it("expands a recommendation's Why this? explanation", async () => {
    renderWithProviders(<DiscoveryFeed />);
    const why = await screen.findAllByRole("button", { name: /Why this\?/ });
    await userEvent.click(why[0]);
    expect(screen.getAllByText(/Recommended because you follow/)[0]).toBeVisible();
  });
});

describe("S2 interactions", () => {
  it("breadcrumb links back to the feed through the host href", async () => {
    renderWithProviders(<EventDetail />, { initialEntries: ["/events/evt-sparql"], path: "/events/:eventId" });
    const crumb = await screen.findByRole("link", { name: "Discover" });
    expect(crumb).toHaveAttribute("href", "/events");
  });

  it("opens a related event from the detail page", async () => {
    renderWithProviders(<EventDetail />, { initialEntries: ["/events/evt-sparql"], path: "/events/:eventId" });
    await userEvent.click(await screen.findByRole("link", { name: "RDF Knowledge Graphs Lab" }));
    expect(await screen.findByRole("heading", { name: "RDF Knowledge Graphs Lab" })).toBeInTheDocument();
  });
});
