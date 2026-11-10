import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";
import { server } from "@campus-pulse/mocks/node";
import { renderWithProviders } from "../test/utils";
import { CredentialVerifier } from "./CredentialVerifier";

/** Public credential verification (Web 3.0 story): a third party checks a VC-JWT. */
describe("CredentialVerifier", () => {
  it("confirms a valid credential and reports it to the host", async () => {
    server.use(
      http.get("*/api/tickets/verify", () =>
        HttpResponse.json({ valid: true, bookingRef: "CP-2026-00482", eventTitle: "Web 3.0: Verifiable Credentials Talk" }),
      ),
    );
    const onVerified = vi.fn();
    renderWithProviders(<CredentialVerifier onVerified={onVerified} />);

    await userEvent.type(screen.getByLabelText(/Credential token/), "vc-token-abc");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByText("Valid credential")).toBeInTheDocument();
    expect(screen.getByText("Web 3.0: Verifiable Credentials Talk")).toBeInTheDocument();
    await waitFor(() =>
      expect(onVerified).toHaveBeenCalledWith({ token: "vc-token-abc", bookingRef: "CP-2026-00482" }),
    );
  });

  it("reports an invalid credential with the reason and no callback", async () => {
    server.use(
      http.get("*/api/tickets/verify", () => HttpResponse.json({ valid: false, reason: "Credential revoked" })),
    );
    const onVerified = vi.fn();
    renderWithProviders(<CredentialVerifier onVerified={onVerified} />);

    await userEvent.type(screen.getByLabelText(/Credential token/), "revoked-token");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByText("Invalid credential")).toBeInTheDocument();
    expect(screen.getByText("Credential revoked")).toBeInTheDocument();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("fails loudly when verification is unavailable", async () => {
    server.use(http.get("*/api/tickets/verify", () => HttpResponse.error()));
    renderWithProviders(<CredentialVerifier />);

    await userEvent.type(screen.getByLabelText(/Credential token/), "vc-token-abc");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Verification unavailable");
  });

  it("keeps Verify disabled until a token is entered", async () => {
    renderWithProviders(<CredentialVerifier />);
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Credential token/), "x");
    expect(screen.getByRole("button", { name: "Verify" })).toBeEnabled();
  });
});
