import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/utils";
import { ProfileInterests } from "./ProfileInterests";

describe("S5 ProfileInterests", () => {
  it("loads saved interests as removable chips", async () => {
    renderWithProviders(<ProfileInterests />);
    expect(await screen.findByText("Semantic Web")).toBeInTheDocument();
    expect(screen.getByText("Web 3.0")).toBeInTheDocument();
  });

  it("shows the unsaved-changes footer after removing an interest and saves with a toast", async () => {
    renderWithProviders(<ProfileInterests />);
    await userEvent.click(await screen.findByRole("button", { name: "Remove filter Semantic Web" }));
    expect(await screen.findByText("Unsaved changes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(screen.getByText("Interests saved — recommendations updated")).toBeInTheDocument();
    });
  });

  it("adds an interest from the ontology combobox (no free text)", async () => {
    renderWithProviders(<ProfileInterests />);
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
