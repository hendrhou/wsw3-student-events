import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@campus-pulse/mocks/node";
import { renderWithProviders } from "../test/utils";
import { RegistrationPanel } from "./RegistrationPanel";

/**
 * S2 registration CTA states: the panel reads the event and the wallet and
 * renders the only participation action that applies (student-mfe.md S2).
 */
describe("RegistrationPanel", () => {
  it("shows the registered state for events already in the wallet", async () => {
    // evt-sparql has a ticket in the MSW wallet fixture (CP-2026-00471).
    renderWithProviders(<RegistrationPanel eventId="evt-sparql" />);
    expect(await screen.findByText("You're registered ✓")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View my tickets" })).toBeInTheDocument();
  });

  it("offers an enabled Register action for open events", async () => {
    renderWithProviders(<RegistrationPanel eventId="evt-hackathon" />);
    expect(await screen.findByRole("button", { name: "Register" })).toBeEnabled();
  });

  it("disables the waitlist action for full events", async () => {
    // evt-ethics is full in the MSW fixtures and not in the wallet.
    renderWithProviders(<RegistrationPanel eventId="evt-ethics" />);
    expect(await screen.findByRole("button", { name: "Join waitlist" })).toBeDisabled();
  });

  it("fails loudly with a retry when the registration status is unavailable", async () => {
    server.use(http.get("*/api/tickets", () => HttpResponse.error()));
    renderWithProviders(<RegistrationPanel eventId="evt-hackathon" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Registration status unavailable");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Registration status unavailable");
  });
});
