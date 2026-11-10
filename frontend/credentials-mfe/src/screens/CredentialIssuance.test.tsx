import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/utils";
import { CredentialIssuance } from "./CredentialIssuance";

/** Post-registration issuance: polls credential-status until it leaves Pending. */
describe("CredentialIssuance", () => {
  it("starts in the pending state while the credential is issued", () => {
    renderWithProviders(<CredentialIssuance bookingRef="CP-2026-00482" eventTitle="Web 3.0 Talk" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText(/Issuing your verifiable credential/)).toBeInTheDocument();
  });

  it("shows the issued badge once the status resolves", async () => {
    // MSW answers /api/tickets/:id/credential-status with { status: "Issued" }.
    renderWithProviders(<CredentialIssuance bookingRef="CP-2026-00482" eventTitle="Web 3.0 Talk" />);
    expect(await screen.findByText("Issued")).toBeInTheDocument();
  });
});
