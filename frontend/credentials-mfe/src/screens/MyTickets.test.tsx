import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../test/utils";
import { MyTickets } from "./MyTickets";

describe("S4 MyTickets", () => {
  it("lists upcoming tickets with booking refs and credential badges", async () => {
    renderWithProviders(<MyTickets />);
    expect(await screen.findByText("Web 3.0: Verifiable Credentials Talk")).toBeInTheDocument();
    expect(screen.getByText("CP-2026-00482")).toBeInTheDocument();
    expect(screen.getAllByText("Issued").length).toBeGreaterThan(0);
  });

  it("switches between Upcoming and Past tabs", async () => {
    renderWithProviders(<MyTickets />);
    await screen.findByText("CP-2026-00482");
    await userEvent.click(screen.getByRole("tab", { name: "Past" }));
    expect(screen.getByText("Welcome Reception")).toBeInTheDocument();
    expect(screen.queryByText("CP-2026-00482")).not.toBeInTheDocument();
  });

  it("opens the present-ticket modal with QR and verify-online link", async () => {
    renderWithProviders(<MyTickets />);
    const presentButtons = await screen.findAllByRole("button", { name: "Present ticket" });
    await userEvent.click(presentButtons[0]);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Verify online/ })).toHaveAttribute("href", "https://verifier.example.org/verify");
    expect(screen.getByRole("button", { name: "Download JSON-LD" })).toBeInTheDocument();
  });

  it("opens the JSON-LD credential viewer", async () => {
    renderWithProviders(<MyTickets />);
    const viewButtons = await screen.findAllByRole("button", { name: "View credential" });
    await userEvent.click(viewButtons[0]);
    const dialog = await screen.findByRole("dialog", { name: "Verifiable credential" });
    await userEvent.click(within(dialog).getByRole("button", { name: "View credential" }));
    expect(within(dialog).getByText(/EventTicket/)).toBeInTheDocument();
  });

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
