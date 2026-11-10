import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/utils";
import { RegistrationFlow } from "./RegistrationFlow";

describe("S3 RegistrationFlow", () => {
  it("blocks Continue until the attendance policy is accepted", async () => {
    renderWithProviders(<RegistrationFlow eventId="evt-hackathon" />);
    const continueBtn = await screen.findByRole("button", { name: "Continue →" });
    await userEvent.click(continueBtn);
    expect(await screen.findByRole("alert")).toHaveTextContent("attendance policy");

    await userEvent.click(screen.getByRole("checkbox", { name: /attendance policy/ }));
    await userEvent.click(continueBtn);
    expect(await screen.findByRole("heading", { name: "Review" })).toBeInTheDocument();
  });

  it("completes the flow to the success panel with a booking reference", async () => {
    renderWithProviders(<RegistrationFlow eventId="evt-hackathon" />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /attendance policy/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continue →" }));
    await userEvent.click(await screen.findByRole("button", { name: "Confirm registration" }));
    expect(await screen.findByText("You're registered!")).toBeInTheDocument();
    expect(screen.getByText("CP-2026-00999")).toBeInTheDocument();
  });

  it("shows a 409 recovery alert for already-registered events", async () => {
    renderWithProviders(<RegistrationFlow eventId="evt-sparql" />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /attendance policy/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continue →" }));
    await userEvent.click(await screen.findByRole("button", { name: "Confirm registration" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Already registered");
    });
    expect(screen.getByRole("link", { name: "View my tickets" })).toBeInTheDocument();
  });
});
