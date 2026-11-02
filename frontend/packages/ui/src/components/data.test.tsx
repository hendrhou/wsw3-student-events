import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Table, type TableColumn } from "./Table";
import { EventCard, RecommendationCard } from "./EventCard";
import { StatCard } from "./StatCard";
import { TicketCard } from "./TicketCard";
import { CredentialCard } from "./CredentialCard";
import { Button } from "./Button";

describe("Table", () => {
  interface Row { name: string; capacity: string }
  const columns: Array<TableColumn<Row>> = [
    { key: "name", header: "Event", sortable: true, render: (r) => r.name },
    { key: "capacity", header: "Capacity", numeric: true, render: (r) => r.capacity },
  ];
  const rows: Row[] = [{ name: "Hackathon", capacity: "96/120" }];

  it("renders sortable headers with aria-sort", async () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} defaultSortKey="name" />);
    const th = screen.getByRole("columnheader", { name: /Event/ });
    expect(th).toHaveAttribute("aria-sort", "ascending");
    await userEvent.click(screen.getByRole("button", { name: /Event/ }));
    expect(th).toHaveAttribute("aria-sort", "descending");
  });

  it("renders skeleton rows while loading and empty state when empty", () => {
    const { container, rerender } = render(<Table columns={columns} rows={[]} rowKey={(r) => r.name} loading />);
    expect(container.querySelectorAll(".cp-skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByText("Hackathon")).not.toBeInTheDocument();
    rerender(
      <Table columns={columns} rows={[]} rowKey={(r) => r.name} emptyState={<p>No rows</p>} />,
    );
    expect(screen.getByText("No rows")).toBeInTheDocument();
  });

  it("invokes onRowClick for clickable rows", async () => {
    const onRowClick = vi.fn();
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} onRowClick={onRowClick} />);
    await userEvent.click(screen.getByText("Hackathon"));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});

describe("EventCard", () => {
  const base = {
    title: "Intro to SPARQL Workshop",
    category: "Workshop",
    dateLabel: "Fri 24 Oct",
    venueTimeLabel: "Building D, 2.14 · 14:00–16:00",
    capacity: { used: 42, total: 60 },
  };

  it("is a single link tab stop and opens on click and Enter", async () => {
    const onOpen = vi.fn();
    render(<EventCard {...base} onOpen={onOpen} />);
    const card = screen.getByRole("link", { name: base.title });
    await userEvent.click(card);
    card.focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("shows a Full badge at full capacity", () => {
    render(<EventCard {...base} full onOpen={() => {}} />);
    expect(screen.getByText("Full")).toBeInTheDocument();
  });
});

describe("RecommendationCard", () => {
  it("expands the SPARQL match explanation via Why this?", async () => {
    render(
      <RecommendationCard
        title="Linked Data Hackathon"
        category="Hackathon"
        dateLabel="Sat 25 Oct"
        venueTimeLabel="Main Hall · 09:00"
        capacity={{ used: 10, total: 40 }}
        matchReason="Semantic Web"
        whyExplanation="Recommended because you follow Semantic Web and this event teaches Linked Data."
        onOpen={() => {}}
      />,
    );
    const toggle = screen.getByRole("button", { name: /Why this\?/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Recommended because you follow/)).toBeVisible();
  });
});

describe("StatCard", () => {
  it("renders a tabular value with caption label", () => {
    render(<StatCard value={183} label="Registrations" />);
    expect(screen.getByText("183")).toBeInTheDocument();
    expect(screen.getByText("Registrations")).toBeInTheDocument();
  });
});

describe("TicketCard", () => {
  it("hides actions for cancelled tickets", () => {
    render(
      <TicketCard
        title="Welcome Reception"
        dateVenueLabel="Mon 15 Sep · Main Hall"
        bookingRef="CP-2026-00210"
        status="cancelled"
        statusBadge={{ type: "error", label: "Cancelled" }}
        actions={<Button size="sm">Present ticket</Button>}
      />,
    );
    expect(screen.queryByRole("button", { name: "Present ticket" })).not.toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });
});

describe("CredentialCard", () => {
  const jsonLd = { "@context": ["https://www.w3.org/ns/credentials/v2"], type: ["VerifiableCredential", "EventTicket"] };

  it("keeps the JSON-LD viewer collapsed by default and expands on demand", async () => {
    render(<CredentialCard issuer="Campus Pulse Ticket Service" status="Issued" jsonLd={jsonLd} />);
    expect(screen.queryByText(/VerifiableCredential/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View credential" }));
    expect(screen.getByText(/EventTicket/)).toBeInTheDocument();
  });

  it("maps credential status to a badge", () => {
    render(<CredentialCard issuer="Issuer" status="Revoked" jsonLd={{}} />);
    expect(screen.getByText("Revoked").closest(".cp-badge")).toHaveClass("cp-badge--error");
  });
});
