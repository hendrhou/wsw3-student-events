import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@campus-pulse/mocks/node";
import { renderWithProviders } from "../test/utils";
import { CheckIn, scanResultType } from "./CheckIn";
import { Registrations } from "./Registrations";

describe("scanResultType mapping (O4 result states)", () => {
  it.each([
    ["verified", "success"],
    ["already_checked_in", "warning"],
    ["invalid", "error"],
    ["unavailable", "info"],
  ] as const)("%s → %s", (outcome, expected) => {
    expect(scanResultType(outcome)).toBe(expected);
  });
});

function renderCheckIn() {
  return renderWithProviders(<CheckIn />, {
    initialEntries: ["/organiser/events/evt-sparql/check-in"],
    path: "/organiser/events/:eventId/check-in",
  });
}

describe("O4 CheckIn", () => {
  it("shows the counter, progress bar and manual entry", async () => {
    renderCheckIn();
    expect(await screen.findByText("41 / 42")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByLabelText("Search by name or student number")).toBeInTheDocument();
  });

  it("verifies a scanned credential with the success panel and optimistic counter", async () => {
    renderCheckIn();
    const input = await screen.findByLabelText("Scanner input — VC token");
    await userEvent.type(input, "vc-token-abc{Enter}");
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Ana Silva");
    await waitFor(() => expect(screen.getByText("42 / 42")).toBeInTheDocument());
  });

  it("warns when the credential was already checked in", async () => {
    renderCheckIn();
    const input = await screen.findByLabelText("Scanner input — VC token");
    await userEvent.type(input, "seen-token{Enter}");
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Checked in at 13:58");
  });

  it("fails loudly (never silently) on a revoked credential", async () => {
    renderCheckIn();
    const input = await screen.findByLabelText("Scanner input — VC token");
    await userEvent.type(input, "revoked-token{Enter}");
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Credential revoked");
  });

  it("queues check-ins offline with a pending-sync badge", async () => {
    server.use(
      http.post("*/api/organiser/events/:id/check-in", () => HttpResponse.error()),
    );
    renderCheckIn();
    const input = await screen.findByLabelText("Scanner input — VC token");
    await userEvent.type(input, "offline-token{Enter}");
    expect(await screen.findByText("1 pending sync")).toBeInTheDocument();
  });

  it("supports manual entry check-in", async () => {
    renderCheckIn();
    await screen.findByText("41 / 42");
    await userEvent.type(screen.getByLabelText("Search by name or student number"), "bruno");
    await userEvent.click(await screen.findByRole("button", { name: "Check in" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("O3 Registrations", () => {
  it("lists registrations with status badges and switches tabs via URL", async () => {
    renderWithProviders(<Registrations />, {
      initialEntries: ["/organiser/events/evt-sparql/registrations"],
      path: "/organiser/events/:eventId/registrations",
    });
    expect(await screen.findByText("Ana Silva")).toBeInTheDocument();
    expect(screen.getByText("Checked-in")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Waitlist" }));
    expect(await screen.findByText("Diogo Ferreira")).toBeInTheDocument();
    expect(screen.queryByText("Ana Silva")).not.toBeInTheDocument();
  });

  it("filters by name or student number instantly", async () => {
    renderWithProviders(<Registrations />, {
      initialEntries: ["/organiser/events/evt-sparql/registrations"],
      path: "/organiser/events/:eventId/registrations",
    });
    await screen.findByText("Ana Silva");
    await userEvent.type(screen.getByRole("searchbox", { name: "Search by name or number" }), "20210456");
    expect(screen.queryByText("Ana Silva")).not.toBeInTheDocument();
    expect(screen.getByText("Bruno Martins")).toBeInTheDocument();
  });
});
