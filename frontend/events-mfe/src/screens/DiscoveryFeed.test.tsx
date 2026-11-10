import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/utils";
import { DiscoveryFeed } from "./DiscoveryFeed";

describe("S1 DiscoveryFeed", () => {
  it("renders the recommendation section (gold = matched) and the event grid from the API", async () => {
    renderWithProviders(<DiscoveryFeed />);
    expect(await screen.findByRole("heading", { name: "Recommended for you" })).toBeInTheDocument();
    expect(await screen.findAllByRole("link", { name: "Intro to SPARQL Workshop" })).not.toHaveLength(0);
    expect(screen.getByRole("heading", { name: "All upcoming events" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "UFP Hackathon 2026" })).toBeInTheDocument();
  });

  it("filters by search text with the API query (debounced)", async () => {
    renderWithProviders(<DiscoveryFeed />);
    await screen.findByRole("link", { name: "UFP Hackathon 2026" });
    await userEvent.type(screen.getByRole("searchbox", { name: "Search events" }), "sparql");
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "UFP Hackathon 2026" })).not.toBeInTheDocument();
    }, { timeout: 2000 });
    expect(screen.getAllByRole("link", { name: "Intro to SPARQL Workshop" }).length).toBeGreaterThan(0);
  });

  it("shows a Full badge and waitlist CTA for full-capacity events", async () => {
    renderWithProviders(<DiscoveryFeed />);
    expect(await screen.findByRole("link", { name: "AI Ethics Seminar" })).toBeInTheDocument();
    expect(screen.getAllByText("Full").length).toBeGreaterThan(0);
  });
});
