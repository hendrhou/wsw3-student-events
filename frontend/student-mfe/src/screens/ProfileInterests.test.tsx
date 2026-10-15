import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastRegion } from "@campus-pulse/ui";
import { renderWithProviders } from "../test/utils";
import { ProfileInterests } from "./ProfileInterests";
import { useToasts } from "../lib/toast";

function ScreenWithToasts() {
  const { toasts, dismiss } = useToasts();
  return (
    <>
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
      <ProfileInterests />
    </>
  );
}

describe("S5 ProfileInterests", () => {
  beforeEach(() => {
    window.localStorage.setItem("cp_auth_user", JSON.stringify({ name: "Vítor Carvalho", studentNumber: "20220123", role: "student" }));
  });
  afterEach(() => window.localStorage.clear());

  it("loads saved interests as removable chips", async () => {
    renderWithProviders(<ScreenWithToasts />);
    expect(await screen.findByText("Semantic Web")).toBeInTheDocument();
    expect(screen.getByText("Web 3.0")).toBeInTheDocument();
  });

  it("shows the unsaved-changes footer after removing an interest and saves with a toast", async () => {
    renderWithProviders(<ScreenWithToasts />);
    await userEvent.click(await screen.findByRole("button", { name: "Remove filter Semantic Web" }));
    expect(await screen.findByText("Unsaved changes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(screen.getByText("Interests saved — recommendations updated")).toBeInTheDocument();
    });
  });

  it("adds an interest from the ontology combobox (no free text)", async () => {
    renderWithProviders(<ScreenWithToasts />);
    const combo = await screen.findByRole("combobox", { name: "Add interest" });
    await userEvent.click(combo);
    await userEvent.type(combo, "sparql");
    const option = await screen.findByRole("option", { name: /SPARQL/ });
    await userEvent.click(option);
    // committed as a chip with a remove button
    expect(await screen.findByRole("button", { name: "Remove filter SPARQL" })).toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });
});
