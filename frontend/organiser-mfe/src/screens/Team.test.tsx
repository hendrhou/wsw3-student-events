import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastRegion } from "@campus-pulse/ui";
import { renderWithProviders } from "../test/utils";
import { useToasts } from "../lib/toast";
import { Team } from "./Team";

function renderTeam() {
  function WithToasts() {
    const { toasts, dismiss } = useToasts();
    return (
      <>
        <ToastRegion toasts={toasts} onDismiss={dismiss} />
        <Team />
      </>
    );
  }
  return renderWithProviders(<WithToasts />);
}

describe("Team access (admin)", () => {
  it("lists staff with role badges, admins without a remove action", async () => {
    renderTeam();
    expect(await screen.findByText("Olga Ribeiro")).toBeInTheDocument();
    expect(screen.getByText("Rui Costa")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Organiser")).toBeInTheDocument();
    // only the organiser (not the admin) can be removed
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  it("rejects non-UFP emails before calling the API", async () => {
    renderTeam();
    await screen.findByText("Olga Ribeiro");
    await userEvent.type(screen.getByLabelText("UFP email"), "someone@gmail.com");
    await userEvent.click(screen.getByRole("button", { name: "Add organiser" }));
    expect(await screen.findByText("Only @ufp.edu.pt accounts can be organisers")).toBeInTheDocument();
  });

  it("rejects people who already have staff access", async () => {
    renderTeam();
    await screen.findByText("Olga Ribeiro");
    await userEvent.type(screen.getByLabelText("UFP email"), "rui@ufp.edu.pt");
    await userEvent.click(screen.getByRole("button", { name: "Add organiser" }));
    expect(await screen.findByText("This person already has staff access")).toBeInTheDocument();
  });

  it("grants organiser access and shows the next-sign-in note", async () => {
    renderTeam();
    await screen.findByText("Olga Ribeiro");
    await userEvent.type(screen.getByLabelText("UFP email"), "New@UFP.edu.pt");
    await userEvent.click(screen.getByRole("button", { name: "Add organiser" }));
    expect(await screen.findByText(/Organiser access granted/)).toBeInTheDocument();
    expect(screen.getByLabelText("UFP email")).toHaveValue("");
  });
});
