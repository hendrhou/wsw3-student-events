import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/utils";
import { RegistrationFlow } from "./RegistrationFlow";
import { registerCtaState } from "./EventDetail";

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

describe("S3 RegistrationFlow", () => {
  beforeEach(() => {
    window.localStorage.setItem("cp_auth_user", JSON.stringify({ name: "Vítor Carvalho", studentNumber: "20220123", role: "student" }));
  });
  afterEach(() => window.localStorage.clear());

  it("blocks Continue until the attendance policy is accepted", async () => {
    renderWithProviders(<RegistrationFlow />, { initialEntries: ["/events/evt-hackathon/register"], path: "/events/:eventId/register" });
    const continueBtn = await screen.findByRole("button", { name: "Continue →" });
    await userEvent.click(continueBtn);
    expect(await screen.findByRole("alert")).toHaveTextContent("attendance policy");

    await userEvent.click(screen.getByRole("checkbox", { name: /attendance policy/ }));
    await userEvent.click(continueBtn);
    expect(await screen.findByRole("heading", { name: "Review" })).toBeInTheDocument();
  });

  it("completes the flow to the success panel with a booking reference", async () => {
    renderWithProviders(<RegistrationFlow />, { initialEntries: ["/events/evt-hackathon/register"], path: "/events/:eventId/register" });
    await userEvent.click(await screen.findByRole("checkbox", { name: /attendance policy/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continue →" }));
    await userEvent.click(await screen.findByRole("button", { name: "Confirm registration" }));
    expect(await screen.findByText("You're registered!")).toBeInTheDocument();
    expect(screen.getByText("CP-2026-00999")).toBeInTheDocument();
  });

  it("shows a 409 recovery alert for already-registered events", async () => {
    renderWithProviders(<RegistrationFlow />, { initialEntries: ["/events/evt-sparql/register"], path: "/events/:eventId/register" });
    await userEvent.click(await screen.findByRole("checkbox", { name: /attendance policy/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continue →" }));
    await userEvent.click(await screen.findByRole("button", { name: "Confirm registration" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Already registered");
    });
    expect(screen.getByRole("link", { name: "View my tickets" })).toBeInTheDocument();
  });
});
