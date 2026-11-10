import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/utils";
import { AttendanceSummary } from "./AttendanceSummary";

/** O3 attendance stats: counts derive from the registrations list. */
describe("AttendanceSummary", () => {
  it("renders registration and check-in counts", async () => {
    renderWithProviders(<AttendanceSummary eventId="evt-sparql" />);
    const summary = await screen.findByLabelText("Attendance summary");
    // MSW fixture: 3 registered-tab rows, one of them Checked-in.
    expect(summary).toHaveTextContent("Registrations");
    expect(summary).toHaveTextContent("Checked in");
    expect(summary).toHaveTextContent("3");
    expect(summary).toHaveTextContent("1");
  });
});
