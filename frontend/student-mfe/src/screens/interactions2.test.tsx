import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/utils";
import { DiscoveryFeed } from "./DiscoveryFeed";
import { EventDetail } from "./EventDetail";
import { RegistrationFlow } from "./RegistrationFlow";
import { ProfileInterests } from "./ProfileInterests";

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
});

describe("S2 extra interactions", () => {
  afterEach(() => window.localStorage.clear());

  it("Save button is clickable (bookmark toggle placeholder)", async () => {
    renderWithProviders(<EventDetail />, { initialEntries: ["/events/evt-hackathon"], path: "/events/:eventId" });
    const save = await screen.findByRole("button", { name: "Save" });
    await userEvent.click(save);
    expect(save).toBeEnabled();
  });
});

describe("S3 extra interactions", () => {
  beforeEach(() => {
    window.localStorage.setItem("cp_auth_user", JSON.stringify({ name: "Vítor Carvalho", studentNumber: "20220123", role: "student" }));
  });
  afterEach(() => window.localStorage.clear());

  it("Back returns from Review to Confirm details", async () => {
    renderWithProviders(<RegistrationFlow />, { initialEntries: ["/events/evt-hackathon/register"], path: "/events/:eventId/register" });
    await userEvent.click(await screen.findByRole("checkbox", { name: /attendance policy/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continue →" }));
    await screen.findByRole("heading", { name: "Review" });
    await userEvent.click(screen.getByRole("button", { name: "← Back" }));
    expect(await screen.findByRole("heading", { name: "Confirm details" })).toBeInTheDocument();
  });
});

describe("S5 extra interactions", () => {
  beforeEach(() => {
    window.localStorage.setItem("cp_auth_user", JSON.stringify({ name: "Vítor Carvalho", studentNumber: "20220123", role: "student" }));
  });
  afterEach(() => window.localStorage.clear());

  it("Discard reverts unsaved changes", async () => {
    renderWithProviders(<ProfileInterests />);
    await userEvent.click(await screen.findByRole("button", { name: "Remove filter Semantic Web" }));
    expect(await screen.findByText("Unsaved changes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());
    expect(await screen.findByText("Semantic Web")).toBeInTheDocument();
  });
});
