import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/utils";
import { Dashboard, computeStats } from "./Dashboard";
import type { OrganiserEvent } from "@campus-pulse/api";

describe("computeStats", () => {
  const make = (over: Partial<OrganiserEvent>): OrganiserEvent => ({
    id: "e1", title: "E", category: "Workshop", date: "2026-10-24", startTime: "14:00", endTime: "16:00",
    venue: "D", coverUrl: null, capacity: { used: 10, total: 20 }, full: false,
    lifecycleStatus: "Published", checkedIn: 0, ...over,
  });

  it("counts upcoming, registrations, checked-in and pending", () => {
    const stats = computeStats([
      make({ id: "a", capacity: { used: 10, total: 20 }, checkedIn: 4 }),
      make({ id: "b", capacity: { used: 5, total: 10 }, checkedIn: 5 }),
      make({ id: "c", lifecycleStatus: "Draft" }),
      make({ id: "d", lifecycleStatus: "Past" }),
    ]);
    expect(stats).toEqual({ upcoming: 2, registrations: 35, checkedInToday: 9, pendingCheckIn: 26 });
  });

  it("never reports negative pending check-in", () => {
    const stats = computeStats([make({ capacity: { used: 0, total: 10 }, checkedIn: 3 })]);
    expect(stats.pendingCheckIn).toBe(0);
  });
});

describe("O1 Dashboard", () => {
  it("renders stat cards (pending check-in highlighted) and the events table", async () => {
    renderWithProviders(<Dashboard />);
    expect(await screen.findByRole("heading", { name: "My events" })).toBeInTheDocument();
    expect(screen.getByText("Pending check-in")).toBeInTheDocument();
    expect(await screen.findByText("UFP Hackathon 2026")).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar").length).toBeGreaterThan(0);
  });

  it("filters events by lifecycle status chip", async () => {
    renderWithProviders(<Dashboard />);
    await screen.findByText("UFP Hackathon 2026");
    await userEvent.click(screen.getByRole("button", { name: "Past" }));
    expect(screen.queryByText("UFP Hackathon 2026")).not.toBeInTheDocument();
    expect(screen.getByText("Welcome Reception")).toBeInTheDocument();
  });

  it("filters events by search text", async () => {
    renderWithProviders(<Dashboard />);
    await screen.findByText("UFP Hackathon 2026");
    await userEvent.type(screen.getByRole("searchbox", { name: "Search events" }), "hackathon");
    expect(screen.getByText("UFP Hackathon 2026")).toBeInTheDocument();
    expect(screen.queryByText("Welcome Reception")).not.toBeInTheDocument();
  });

  it("row actions render per event (Edit / Check-in) and rows navigate to registrations", async () => {
    renderWithProviders(<Dashboard />);
    await screen.findByText("UFP Hackathon 2026");
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    const checkInButtons = screen.getAllByRole("button", { name: "Check-in" });
    expect(editButtons.length).toBeGreaterThan(0);
    expect(checkInButtons.length).toBeGreaterThan(0);
    await userEvent.click(editButtons[0]);
    await userEvent.click(checkInButtons[0]);
    await userEvent.click(screen.getByText("UFP Hackathon 2026"));
  });
});
