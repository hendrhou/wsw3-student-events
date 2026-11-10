import { screen, waitFor } from "@testing-library/react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithProviders, TestHost } from "../test/utils";
import { EventForm } from "./EventForm";
import { validateEventForm, hasErrors } from "../lib/validation";
import type { EventPayload } from "@campus-pulse/api";

const VALID: EventPayload = {
  title: "Linked Data Seminar",
  shortDescription: "A seminar on linked data.",
  fullDescription: "",
  category: "Seminar",
  date: "2026-11-05",
  startTime: "14:00",
  endTime: "16:00",
  venue: "Room 1.02",
  online: false,
  onlineUrl: null,
  capacity: 60,
  waitlist: true,
  registrationDeadline: null,
  topics: ["linked-data"],
};

describe("validateEventForm (pure)", () => {
  it("accepts a valid payload", () => {
    expect(hasErrors(validateEventForm(VALID))).toBe(false);
  });

  it("requires title, date, times, venue and topics", () => {
    const errors = validateEventForm({ ...VALID, title: "", date: "", endTime: "", venue: "", topics: [] });
    expect(errors.title).toBeDefined();
    expect(errors.date).toBeDefined();
    expect(errors.endTime).toBeDefined();
    expect(errors.venue).toBeDefined();
    expect(errors.topics).toBeDefined();
  });

  it("enforces length limits and capacity minimum", () => {
    const errors = validateEventForm({ ...VALID, title: "x".repeat(81), capacity: 0 });
    expect(errors.title).toMatch(/80 characters/);
    expect(errors.capacity).toBeDefined();
  });

  it("requires a URL instead of a venue for online events", () => {
    const errors = validateEventForm({ ...VALID, online: true, venue: "", onlineUrl: "" });
    expect(errors.onlineUrl).toBeDefined();
    expect(errors.venue).toBeUndefined();
  });
});

describe("O2 EventForm", () => {
  afterEach(() => window.localStorage.clear());

  it("validates on blur", async () => {
    renderWithProviders(<EventForm mode="create" />, { initialEntries: ["/organiser/events/new"], path: "/organiser/events/new" });
    const title = await screen.findByLabelText(/Title/);
    await userEvent.click(title);
    await userEvent.tab();
    expect(await screen.findByRole("alert")).toHaveTextContent("Title is required");
  });

  it("shows an error summary on Publish with invalid data", async () => {
    renderWithProviders(<EventForm mode="create" />, { initialEntries: ["/organiser/events/new"], path: "/organiser/events/new" });
    await userEvent.click(await screen.findByRole("button", { name: "Publish" }));
    const alert = await screen.findByRole("alert", { name: "Form errors" });
    expect(alert).toHaveTextContent("Please fix the following");
    expect(alert).toHaveTextContent("Title is required");
  });

  it("publishes a valid event and navigates to registrations", { timeout: 15_000 }, async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/organiser/events/new"]}>
          <TestHost>
            <Routes>
              <Route path="/organiser/events/new" element={<EventForm mode="create" />} />
              <Route path="/organiser/events/:eventId/registrations" element={<p>REGISTRATIONS PAGE</p>} />
            </Routes>
          </TestHost>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await userEvent.type(await screen.findByLabelText(/Title/), "Linked Data Seminar");
    await userEvent.type(screen.getByLabelText(/Short description/), "A seminar on linked data.");
    await userEvent.selectOptions(screen.getByLabelText(/Category/), "Seminar");
    await userEvent.type(screen.getByLabelText(/^Date/), "2026-11-05");
    await userEvent.type(screen.getByLabelText(/^Start time/), "14:00");
    await userEvent.type(screen.getByLabelText(/^End time/), "16:00");
    await userEvent.selectOptions(screen.getByLabelText(/Venue/), "Auditorium A");
    // topic tag via combobox
    const combo = screen.getByRole("combobox", { name: "Topic tags" });
    await userEvent.click(combo);
    await userEvent.type(combo, "linked");
    await userEvent.click(await screen.findByRole("option", { name: /Linked Data/ }));
    const cover = new File(["image bytes"], "cover.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("Cover image"), cover);
    await userEvent.type(screen.getByLabelText(/Cover image alt text/), "Students at the seminar");
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("REGISTRATIONS PAGE")).toBeInTheDocument();
  });

  it("saves a draft without validating", async () => {
    renderWithProviders(<EventForm mode="create" />, { initialEntries: ["/organiser/events/new"], path: "/organiser/events/new" });
    const title = await screen.findByLabelText(/Title/);
    await userEvent.type(title, "Partial draft");
    // Keystrokes land asynchronously on slow runners — wait for state to settle.
    await waitFor(() => expect(title).toHaveValue("Partial draft"));
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(window.localStorage.getItem("cp_draft_new")).toContain("Partial draft");
  });

  it("rejects unsupported cover file types", async () => {
    renderWithProviders(<EventForm mode="create" />, { initialEntries: ["/organiser/events/new"], path: "/organiser/events/new" });
    const file = new File(["not an image"], "cover.svg", { type: "image/svg+xml" });
    await userEvent.upload(await screen.findByLabelText("Cover image"), file, { applyAccept: false });
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a JPEG, PNG, or WebP image");
  });

  it("edit mode prefills from the API and saves changes", { timeout: 15_000 }, async () => {
    renderWithProviders(<EventForm mode="edit" eventId="evt-sparql" />, {
      initialEntries: ["/organiser/events/evt-sparql/edit"],
      path: "/organiser/events/:eventId/edit",
      extraRoutes: [["/organiser/events/evt-sparql/registrations", "REGISTRATIONS PAGE"]],
    });
    const title = await screen.findByLabelText(/Title/);
    await waitFor(() => expect(title).toHaveValue("Intro to SPARQL Workshop"));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();

    await userEvent.clear(title);
    await userEvent.type(title, "Intro to SPARQL Workshop (updated)");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("REGISTRATIONS PAGE")).toBeInTheDocument();
  });
});
