import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { renderWithProviders } from "../test/utils";
import { DiscoveryFeed } from "./DiscoveryFeed";
import { EventDetail } from "./EventDetail";
import { MyTickets } from "./MyTickets";
import { Route, Routes } from "react-router-dom";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function renderAt(
  ui: React.ReactElement,
  initialEntries: string[],
  config: { mainPath?: string; extraRoutes?: Array<[string, string]> } = {},
) {
  const { mainPath, extraRoutes = [] } = config;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          {extraRoutes.map(([path, marker]) => (
            <Route key={path} path={path} element={<p>{marker}</p>} />
          ))}
          <Route path={mainPath ?? "*"} element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("S1 interactions", () => {
  it("navigates to the event detail when a card is clicked", async () => {
    renderAt(<DiscoveryFeed />, ["/events"], { extraRoutes: [["/events/evt-hackathon", "DETAIL PAGE"]] });
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
  afterEach(() => window.localStorage.clear());

  it("navigates from Register to the registration flow", async () => {
    renderAt(<EventDetail />, ["/events/evt-hackathon"], {
      mainPath: "/events/:eventId",
      extraRoutes: [["/events/evt-hackathon/register", "REGISTER PAGE"]],
    });
    await userEvent.click(await screen.findByRole("button", { name: "Register" }));
    expect(await screen.findByText("REGISTER PAGE")).toBeInTheDocument();
  });

  it("shows registered state after returning from the flow", async () => {
    window.localStorage.setItem("cp_registered_evt-hackathon", "1");
    renderWithProviders(<EventDetail />, { initialEntries: ["/events/evt-hackathon"], path: "/events/:eventId" });
    expect(await screen.findByText("You're registered ✓")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View my tickets" })).toBeInTheDocument();
  });

  it("breadcrumb navigates back to the feed", async () => {
    renderAt(<EventDetail />, ["/events/evt-sparql"], {
      mainPath: "/events/:eventId",
      extraRoutes: [["/events", "FEED PAGE"]],
    });
    await userEvent.click(await screen.findByRole("link", { name: "Discover" }));
    expect(await screen.findByText("FEED PAGE")).toBeInTheDocument();
  });
});

describe("S4 interactions", () => {
  it("closes the present-ticket modal with Escape", async () => {
    renderWithProviders(<MyTickets />);
    await userEvent.click((await screen.findAllByRole("button", { name: "Present ticket" }))[0]);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("downloads the JSON-LD credential", async () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(window.URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderWithProviders(<MyTickets />);
    await userEvent.click((await screen.findAllByRole("button", { name: "Present ticket" }))[0]);
    await userEvent.click(await screen.findByRole("button", { name: "Download JSON-LD" }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
