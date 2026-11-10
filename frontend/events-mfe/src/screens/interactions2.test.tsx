import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, withEventId } from "../test/utils";
import { DiscoveryFeed } from "./DiscoveryFeed";
import { EventDetail as EventDetails } from "./EventDetail";

const EventDetail = withEventId(EventDetails);

describe("S1 extra interactions", () => {
  it("clears the search via the × button", async () => {
    renderWithProviders(<DiscoveryFeed />);
    await screen.findByRole("link", { name: "UFP Hackathon 2026" });
    await userEvent.type(screen.getByRole("searchbox", { name: "Search events" }), "hack");
    await userEvent.click(await screen.findByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("searchbox", { name: "Search events" })).toHaveValue("");
  });

  it("removes an active category chip via its × button", async () => {
    renderWithProviders(<DiscoveryFeed />);
    await screen.findByRole("link", { name: "UFP Hackathon 2026" });
    await userEvent.click(screen.getByRole("button", { name: "Workshop" }));
    await userEvent.click(await screen.findByRole("button", { name: "Remove filter Category: Workshop" }));
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "UFP Hackathon 2026" })).toBeInTheDocument();
    });
  });

  it("shows the empty state for unmatched searches and clears filters from it", async () => {
    renderWithProviders(<DiscoveryFeed />);
    await screen.findByRole("link", { name: "UFP Hackathon 2026" });
    await userEvent.type(screen.getByRole("searchbox", { name: "Search events" }), "zzzz-no-match");
    expect(await screen.findByText("No events match your filters")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByRole("link", { name: "UFP Hackathon 2026" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search events" })).toHaveValue("");
  });
});

describe("S2 extra interactions", () => {
  it("Save button is clickable (bookmark toggle placeholder)", async () => {
    renderWithProviders(<EventDetail />, { initialEntries: ["/events/evt-hackathon"], path: "/events/:eventId" });
    const save = await screen.findByRole("button", { name: "Save" });
    await userEvent.click(save);
    expect(save).toBeEnabled();
  });
});
